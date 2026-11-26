// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {LorvaAgentRegistry} from "../src/LorvaAgentRegistry.sol";
import {LorvaLimitMath as M} from "../src/LorvaLimitMath.sol";

contract LorvaAgentRegistryTest is Test {
    LorvaAgentRegistry internal R;
    address internal owner = address(0xA11CE);
    address internal op = address(0x0BE5);
    address internal stranger = address(0xBAD);
    bytes32 internal constant CFG = keccak256("trend ETH sma 24");
    uint256 internal A;

    function lim(uint64 pos, uint64 loss, uint16 trades) internal view returns (M.Limits memory) {
        return M.Limits({maxPosition: pos, maxDailyLoss: loss, maxTradesPerDay: trades, stopLossBps: 500, validUntil: uint64(block.timestamp + 30 days)});
    }

    function setUp() public {
        vm.warp(1_800_000_000);
        R = new LorvaAgentRegistry();
        vm.prank(owner);
        A = R.register(CFG, lim(1_000e6, 50e6, 3), op);
    }

    function act(bytes32 h, uint64 pos, int64 pnl) internal {
        uint32 v = R.agentOf(A).version;
        vm.prank(op);
        R.recordAction(A, v, h, pos, pnl);
    }

    function test_registerStoresEverything() public view {
        LorvaAgentRegistry.Agent memory a = R.agentOf(A);
        assertEq(a.owner, owner);
        assertEq(a.operator, op);
        assertEq(uint8(a.status), uint8(LorvaAgentRegistry.Status.Active));
        assertEq(a.version, 1);
        assertEq(a.configHash, CFG);
        assertEq(R.agentsOf(owner).length, 1);
    }

    function test_badLimitsRefusedWithEveryReason() public {
        M.Limits memory l = M.Limits({maxPosition: 0, maxDailyLoss: 0, maxTradesPerDay: 0, stopLossBps: 0, validUntil: uint64(block.timestamp)});
        vm.expectRevert(abi.encodeWithSelector(LorvaAgentRegistry.BadLimits.selector, M.L_ZERO_POSITION | M.L_ZERO_LOSS | M.L_ZERO_TRADES | M.L_BAD_STOP | M.L_BAD_EXPIRY));
        R.register(CFG, l, op);
        l = lim(1, 1, 1);
        l.stopLossBps = 5_001;
        l.validUntil = uint64(block.timestamp + 367 days);
        vm.expectRevert(abi.encodeWithSelector(LorvaAgentRegistry.BadLimits.selector, M.L_BAD_STOP | M.L_BAD_EXPIRY));
        R.register(CFG, l, op);
    }

    function test_operatorRecordsWithinLimits() public {
        act(keccak256("a1"), 400e6, 0);
        act(keccak256("a2"), 0, -10e6);
        LorvaAgentRegistry.Usage memory u = R.usageOf(A);
        assertEq(u.trades, 2);
        assertEq(u.loss, 10e6);
        assertEq(u.position, 0);
        assertEq(u.actions, 2);
    }

    function test_overPositionRefused() public {
        assertEq(R.canAct(A, op, 1, 1_000e6 + 1), M.R_OVER_POSITION);
        vm.prank(op);
        vm.expectRevert(abi.encodeWithSelector(LorvaAgentRegistry.Refused.selector, M.R_OVER_POSITION));
        R.recordAction(A, 1, keccak256("x"), 1_000e6 + 1, 0);
    }

    function test_tradesPerDayAndReset() public {
        act(keccak256("1"), 1, 0);
        act(keccak256("2"), 1, 0);
        act(keccak256("3"), 1, 0);
        assertEq(R.canAct(A, op, 1, 1), M.R_TRADES_PER_DAY);
        vm.warp(block.timestamp + 1 days);
        assertEq(R.canAct(A, op, 1, 1), 0, "new UTC day resets the count");
        assertEq(R.usageOf(A).trades, 0);
    }

    function test_dailyLossStopsTheAgentForTheDay() public {
        act(keccak256("1"), 0, -50e6);
        assertEq(R.canAct(A, op, 1, 0), M.R_DAILY_LOSS_HIT);
        vm.warp(block.timestamp + 1 days);
        assertEq(R.canAct(A, op, 1, 0), 0);
    }

    function test_exitsAreNeverBlockedByLimits() public {
        act(keccak256("buy"), 600e6, 0);
        act(keccak256("sell"), 0, -50e6);
        assertEq(R.canAct(A, op, 1, 100e6), M.R_DAILY_LOSS_HIT, "no new risk after the loss limit");
    }

    function test_exitAllowedAfterTradeLimit() public {
        act(keccak256("1"), 300e6, 0);
        act(keccak256("2"), 600e6, 0);
        act(keccak256("3"), 900e6, 0);
        assertEq(R.canAct(A, op, 1, 950e6), M.R_TRADES_PER_DAY);
        assertEq(R.canAct(A, op, 1, 0), 0, "closing is allowed");
        act(keccak256("4"), 0, -5e6);
        vm.warp(block.timestamp + 1 days);
        act2(keccak256("5"), 300e6);
        vm.prank(owner);
        R.pause(A);
        assertEq(R.canAct(A, op, 1, 0), M.R_PAUSED, "a paused agent does nothing, not even exits");
    }

    function act2(bytes32 h, uint64 pos) internal {
        act(h, pos, 0);
    }

    function test_gainsDoNotOffsetLoss() public {
        act(keccak256("1"), 0, -30e6);
        act(keccak256("2"), 0, 25e6);
        assertEq(R.usageOf(A).loss, 30e6);
    }

    function test_onlyOperatorRecords() public {
        assertEq(R.canAct(A, stranger, 1, 0), M.R_NOT_OPERATOR);
        assertEq(R.canAct(A, owner, 1, 0), M.R_NOT_OPERATOR, "owner is not the operator");
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(LorvaAgentRegistry.Refused.selector, M.R_NOT_OPERATOR));
        R.recordAction(A, 1, keccak256("x"), 0, 0);
        assertEq(R.canAct(99, op, 1, 0), M.R_UNKNOWN_AGENT);
    }

    function test_zeroActionHashRefused() public {
        vm.prank(op);
        vm.expectRevert(abi.encodeWithSelector(LorvaAgentRegistry.Refused.selector, M.R_ZERO_ACTION));
        R.recordAction(A, 1, bytes32(0), 0, 0);
    }

    function test_staleVersionRefusedAfterNewLimits() public {
        vm.prank(owner);
        R.setLimits(A, keccak256("v2"), lim(500e6, 20e6, 2));
        assertEq(R.agentOf(A).version, 2);
        assertEq(R.canAct(A, op, 1, 0), M.R_STALE_VERSION);
        assertEq(R.canAct(A, op, 2, 0), 0);
        assertEq(R.canAct(A, op, 2, 600e6), M.R_OVER_POSITION);
    }

    function test_pauseSameBlockAndResume() public {
        vm.prank(op);
        R.pause(A);
        assertEq(R.canAct(A, op, 1, 0), M.R_PAUSED);
        vm.prank(op);
        vm.expectRevert(LorvaAgentRegistry.NotOwner.selector);
        R.resume(A);
        vm.prank(owner);
        R.resume(A);
        assertEq(R.canAct(A, op, 1, 0), 0);
        vm.prank(stranger);
        vm.expectRevert(LorvaAgentRegistry.NotOwnerOrOperator.selector);
        R.pause(A);
    }

    function test_killIsFinalAndUnbindsOperator() public {
        vm.prank(owner);
        R.kill(A);
        LorvaAgentRegistry.Agent memory a = R.agentOf(A);
        assertEq(uint8(a.status), uint8(LorvaAgentRegistry.Status.Killed));
        assertEq(a.operator, address(0));
        assertEq(R.canAct(A, op, 1, 0), M.R_NOT_OPERATOR | M.R_KILLED);
        vm.startPrank(owner);
        vm.expectRevert(LorvaAgentRegistry.BadStatus.selector);
        R.resume(A);
        vm.expectRevert(LorvaAgentRegistry.AlreadyKilled.selector);
        R.setLimits(A, CFG, lim(1, 1, 1));
        vm.expectRevert(LorvaAgentRegistry.AlreadyKilled.selector);
        R.setOperator(A, op);
        vm.expectRevert(LorvaAgentRegistry.AlreadyKilled.selector);
        R.kill(A);
        vm.stopPrank();
    }

    function test_killManyAllOrNothing() public {
        vm.startPrank(owner);
        uint256 b = R.register(CFG, lim(1, 1, 1), op);
        vm.stopPrank();
        vm.prank(stranger);
        uint256 c = R.register(CFG, lim(1, 1, 1), op);
        uint256[] memory ids = new uint256[](3);
        ids[0] = A;
        ids[1] = b;
        ids[2] = c;
        vm.prank(owner);
        vm.expectRevert(LorvaAgentRegistry.NotOwner.selector);
        R.killMany(ids);
        assertEq(uint8(R.agentOf(A).status), uint8(LorvaAgentRegistry.Status.Active), "nothing killed");
        uint256[] memory mine = new uint256[](2);
        mine[0] = A;
        mine[1] = b;
        vm.prank(owner);
        R.killMany(mine);
        assertEq(uint8(R.agentOf(b).status), uint8(LorvaAgentRegistry.Status.Killed));
        vm.prank(owner);
        vm.expectRevert(LorvaAgentRegistry.BatchTooLarge.selector);
        R.killMany(new uint256[](33));
    }

    function test_operatorCanOnlyTighten() public {
        M.Limits memory looser = lim(2_000e6, 50e6, 3);
        vm.prank(op);
        vm.expectRevert(LorvaAgentRegistry.NotTighter.selector);
        R.tighten(A, looser);
        M.Limits memory tighter = lim(800e6, 40e6, 2);
        tighter.validUntil = R.agentOf(A).limits.validUntil;
        vm.prank(op);
        R.tighten(A, tighter);
        assertEq(R.agentOf(A).limits.maxPosition, 800e6);
        assertEq(R.agentOf(A).version, 2);
        vm.prank(stranger);
        vm.expectRevert(LorvaAgentRegistry.NotOwnerOrOperator.selector);
        R.tighten(A, tighter);
    }

    function test_onlyOwnerManages() public {
        vm.startPrank(op);
        vm.expectRevert(LorvaAgentRegistry.NotOwner.selector);
        R.setLimits(A, CFG, lim(1, 1, 1));
        vm.expectRevert(LorvaAgentRegistry.NotOwner.selector);
        R.setOperator(A, op);
        vm.expectRevert(LorvaAgentRegistry.NotOwner.selector);
        R.kill(A);
        vm.stopPrank();
        vm.expectRevert(LorvaAgentRegistry.UnknownAgent.selector);
        R.kill(77);
    }

    function test_operatorChangeMovesTheKey() public {
        vm.prank(owner);
        R.setOperator(A, stranger);
        assertEq(R.canAct(A, op, 1, 0), M.R_NOT_OPERATOR);
        assertEq(R.canAct(A, stranger, 1, 0), 0);
    }

    function test_limitsExpire() public {
        vm.warp(block.timestamp + 30 days);
        assertEq(R.canAct(A, op, 1, 0), M.R_LIMITS_EXPIRED);
    }

    function test_noFunds() public {
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        (bool ok,) = address(R).call{value: 1}("");
        assertFalse(ok);
    }

    function testFuzz_lossAccumulates(int64[8] memory pnls) public {
        uint64 expect;
        for (uint256 i = 0; i < 3; i++) {
            int64 p = int64(bound(int256(pnls[i]), -10e6, 10e6));
            if (R.canAct(A, op, 1, 0) != 0) break;
            act(keccak256(abi.encode(i)), 0, p);
            if (p < 0) expect += uint64(-p);
        }
        assertEq(R.usageOf(A).loss, expect);
    }

    function testFuzz_canActMatchesRecord(uint64 pos, uint8 n) public {
        n = uint8(bound(n, 0, 5));
        for (uint8 i = 0; i < n; i++) if (R.canAct(A, op, 1, 0) == 0) act(keccak256(abi.encode(i)), 0, 0);
        uint256 r = R.canAct(A, op, 1, pos);
        vm.prank(op);
        if (r == 0) R.recordAction(A, 1, keccak256("z"), pos, 0);
        else {
            vm.expectRevert(abi.encodeWithSelector(LorvaAgentRegistry.Refused.selector, r));
            R.recordAction(A, 1, keccak256("z"), pos, 0);
        }
    }
}
