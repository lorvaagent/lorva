// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {LorvaAgentRegistry} from "../src/LorvaAgentRegistry.sol";
import {LorvaLimitMath as M} from "../src/LorvaLimitMath.sol";

interface ILorvaFeed {
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
    function getRoundData(uint80) external view returns (uint80, int256, uint256, uint256, uint80);
    function decimals() external view returns (uint8);
}

/// @notice Runs against a fork of Robinhood Chain mainnet (chain id 4663):
///   forge test --match-contract Fork --fork-url <rpc> --evm-version cancun
/// Deploys the registry on real chain state, and proves the Chainlink feeds the site reads for price history answer getRoundData
/// back through the current phase (the backtest source).
contract LorvaForkTest is Test {
    address constant ETH_USD = 0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9;
    address constant NVDA_247 = 0x321A36e441DfBadA01Aa6f9884F14a344E133D1F;

    function test_fork_registryOnRobinhood() public {
        assertEq(block.chainid, 4663);
        LorvaAgentRegistry R = new LorvaAgentRegistry();
        assertLt(address(R).code.length, 24_576);
        address op = makeAddr("lorva-op");
        uint256 id = R.register(keccak256("fork"), M.Limits({maxPosition: 500e6, maxDailyLoss: 20e6, maxTradesPerDay: 5, stopLossBps: 400, validUntil: uint64(block.timestamp + 7 days)}), op);
        vm.prank(op);
        R.recordAction(id, 1, keccak256("buy"), 250e6, 0);
        R.kill(id);
        assertEq(R.canAct(id, op, 1, 0), M.R_NOT_OPERATOR | M.R_KILLED);
    }

    function test_fork_feedsHaveHistory() public view {
        for (uint256 k = 0; k < 2; k++) {
            ILorvaFeed f = ILorvaFeed(k == 0 ? ETH_USD : NVDA_247);
            (uint80 rid, int256 p, , uint256 t, ) = f.latestRoundData();
            assertGt(p, 0);
            (, int256 p2, , uint256 t2, ) = f.getRoundData(rid - 100);
            assertGt(p2, 0);
            assertLt(t2, t);
            assertEq(f.decimals(), 8);
        }
    }
}
