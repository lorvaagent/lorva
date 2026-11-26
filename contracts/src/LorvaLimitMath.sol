// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title LorvaLimitMath
/// @notice The limit rules of a Lorva agent, as pure functions: one reason bit per refusal, so the site and the operator can ask
///         canAct() before sending anything (a reverted transaction leaves no log). Mirror: src/lib/agents/bits.ts.
library LorvaLimitMath {
    /// @dev Amounts are USD with 6 decimals (the same unit as USDG). Loss is a positive number.
    struct Limits {
        uint64 maxPosition; // largest position the agent may hold after one action
        uint64 maxDailyLoss; // realised loss per UTC day that stops the agent for the rest of that day
        uint16 maxTradesPerDay; // actions per UTC day
        uint16 stopLossBps; // per-position stop the engine must honour (recorded, checked off chain)
        uint64 validUntil; // the limits expire; an expired agent cannot act until the owner sets new ones
    }

    uint256 internal constant R_UNKNOWN_AGENT = 1 << 0;
    uint256 internal constant R_NOT_OPERATOR = 1 << 1;
    uint256 internal constant R_PAUSED = 1 << 2;
    uint256 internal constant R_KILLED = 1 << 3;
    uint256 internal constant R_LIMITS_EXPIRED = 1 << 4;
    uint256 internal constant R_OVER_POSITION = 1 << 5;
    uint256 internal constant R_TRADES_PER_DAY = 1 << 6;
    uint256 internal constant R_DAILY_LOSS_HIT = 1 << 7;
    uint256 internal constant R_STALE_VERSION = 1 << 8;
    uint256 internal constant R_ZERO_ACTION = 1 << 9;

    uint256 internal constant L_ZERO_POSITION = 1 << 16;
    uint256 internal constant L_ZERO_LOSS = 1 << 17;
    uint256 internal constant L_ZERO_TRADES = 1 << 18;
    uint256 internal constant L_BAD_STOP = 1 << 19;
    uint256 internal constant L_BAD_EXPIRY = 1 << 20;

    uint64 internal constant MAX_LIFE = 366 days;

    /// @notice Why a set of limits cannot be stored (0 = valid).
    function check(Limits memory l, uint256 nowTs) internal pure returns (uint256 r) {
        if (l.maxPosition == 0) r |= L_ZERO_POSITION;
        if (l.maxDailyLoss == 0) r |= L_ZERO_LOSS;
        if (l.maxTradesPerDay == 0) r |= L_ZERO_TRADES;
        if (l.stopLossBps == 0 || l.stopLossBps > 5_000) r |= L_BAD_STOP;
        if (l.validUntil <= nowTs || l.validUntil > nowTs + MAX_LIFE) r |= L_BAD_EXPIRY;
    }

    /// @notice Why an action of `positionAfter` would be refused given today's usage (0 = allowed).
    function actReasons(Limits memory l, uint256 nowTs, uint64 positionAfter, uint16 tradesToday, uint64 lossToday) internal pure returns (uint256 r) {
        if (nowTs >= l.validUntil) r |= R_LIMITS_EXPIRED;
        if (positionAfter > l.maxPosition) r |= R_OVER_POSITION;
        if (tradesToday >= l.maxTradesPerDay) r |= R_TRADES_PER_DAY;
        if (lossToday >= l.maxDailyLoss) r |= R_DAILY_LOSS_HIT;
    }

    /// @notice True when `b` is at least as strict as `a` on every limit (used to let the operator only ever tighten).
    function tighterOrEqual(Limits memory a, Limits memory b) internal pure returns (bool) {
        return b.maxPosition <= a.maxPosition && b.maxDailyLoss <= a.maxDailyLoss && b.maxTradesPerDay <= a.maxTradesPerDay && b.stopLossBps <= a.stopLossBps && b.validUntil <= a.validUntil;
    }

    function day(uint256 ts) internal pure returns (uint32) {
        return uint32(ts / 1 days);
    }
}
