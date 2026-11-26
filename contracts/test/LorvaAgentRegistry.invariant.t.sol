// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {LorvaAgentRegistry} from "../src/LorvaAgentRegistry.sol";
import {LorvaLimitMath as M} from "../src/LorvaLimitMath.sol";

/// @notice Operators act, owners pause/resume/kill/change limits, strangers try everything, days pass.
contract LorvaRegistryActor is Test {
    LorvaAgentRegistry public R;
    address public owner = address(0xA11CE);
    address public op = address(0x0BE5);
    address public stranger = address(0xBAD);
    uint256 public id;
    uint256 public overLimit; // risk-adding actions recorded over a limit, or any action while not active
    uint256 public afterKill;
    uint256 public strangerWins;
    uint256 public raisedByOperator;
    bool public killed;

    constructor() {
        vm.warp(1_800_000_000);
        R = new LorvaAgentRegistry();
        vm.prank(owner);
        id = R.register(keccak256("c"), M.Limits({maxPosition: 1000, maxDailyLoss: 100, maxTradesPerDay: 4, stopLossBps: 300, validUntil: uint64(block.timestamp + 300 days)}), op);
    }

    function action(uint64 pos, int64 pnl) external {
        pnl = int64(bound(int256(pnl), -60, 60));
        pos = uint64(bound(pos, 0, 1500));
        LorvaAgentRegistry.Agent memory a = R.agentOf(id);
        LorvaAgentRegistry.Usage memory before = R.usageOf(id);
        vm.prank(op);
        try R.recordAction(id, a.version, keccak256(abi.encode(pos, pnl, block.timestamp)), pos, pnl) {
            if (killed) afterKill++;
            bool reducing = pos < before.position;
            if (a.status != LorvaAgentRegistry.Status.Active) overLimit++;
            if (!reducing && (pos > a.limits.maxPosition || before.trades >= a.limits.maxTradesPerDay || before.loss >= a.limits.maxDailyLoss)) overLimit++;
        } catch {}
    }

    function pauseOrResume(bool p) external {
        vm.prank(owner);
        if (p) try R.pause(id) {} catch {}
        else try R.resume(id) {} catch {}
    }

    function kill(uint8 dice) external {
        if (dice % 9 != 0) return;
        vm.prank(owner);
        try R.kill(id) {
            killed = true;
        } catch {}
    }

    function operatorTriesToRaise(uint64 pos) external {
        LorvaAgentRegistry.Agent memory a = R.agentOf(id);
        M.Limits memory l = a.limits;
        l.maxPosition = uint64(bound(pos, uint256(l.maxPosition) + 1, uint256(l.maxPosition) + 10_000));
        vm.prank(op);
        try R.tighten(id, l) {
            raisedByOperator++;
        } catch {}
    }

    function strangerTries() external {
        vm.startPrank(stranger);
        try R.recordAction(id, 1, keccak256("s"), 0, 0) {
            strangerWins++;
        } catch {}
        try R.resume(id) {
            strangerWins++;
        } catch {}
        try R.setOperator(id, stranger) {
            strangerWins++;
        } catch {}
        vm.stopPrank();
    }

    function passTime(uint32 dt) external {
        vm.warp(block.timestamp + (dt % 2 days));
    }
}

contract LorvaAgentRegistryInvariant is Test {
    LorvaRegistryActor internal actor;

    function setUp() public {
        actor = new LorvaRegistryActor();
        targetContract(address(actor));
    }

    function invariant_neverOverLimit() public view {
        assertEq(actor.overLimit(), 0);
    }

    function invariant_nothingAfterKill() public view {
        assertEq(actor.afterKill(), 0);
    }

    function invariant_strangersNeverWin() public view {
        assertEq(actor.strangerWins(), 0);
    }

    function invariant_operatorNeverRaises() public view {
        assertEq(actor.raisedByOperator(), 0);
    }

    function invariant_holdsNoEther() public view {
        assertEq(address(actor.R()).balance, 0);
    }
}
