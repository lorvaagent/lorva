/* TypeScript mirror of LorvaLimitMath.sol reason bits (bits.test.ts reads the .sol). The engine, the monitor and canAct() share them. */

export const ACT_BITS = {
  UNKNOWN_AGENT: 1n << 0n,
  NOT_OPERATOR: 1n << 1n,
  PAUSED: 1n << 2n,
  KILLED: 1n << 3n,
  LIMITS_EXPIRED: 1n << 4n,
  OVER_POSITION: 1n << 5n,
  TRADES_PER_DAY: 1n << 6n,
  DAILY_LOSS_HIT: 1n << 7n,
  STALE_VERSION: 1n << 8n,
  ZERO_ACTION: 1n << 9n,
} as const;

export const LIMIT_BITS = {
  ZERO_POSITION: 1n << 16n,
  ZERO_LOSS: 1n << 17n,
  ZERO_TRADES: 1n << 18n,
  BAD_STOP: 1n << 19n,
  BAD_EXPIRY: 1n << 20n,
} as const;

export type ActBit = keyof typeof ACT_BITS;
export type LimitBit = keyof typeof LIMIT_BITS;

export const BIT_WORDS: Record<ActBit | LimitBit, string> = {
  UNKNOWN_AGENT: "Unknown agent",
  NOT_OPERATOR: "Not this agent's operator key",
  PAUSED: "Agent paused",
  KILLED: "Agent killed",
  LIMITS_EXPIRED: "Limits expired",
  OVER_POSITION: "Over the max position",
  TRADES_PER_DAY: "Trades-per-day limit reached",
  DAILY_LOSS_HIT: "Daily loss limit reached",
  STALE_VERSION: "Engine runs an old limits version",
  ZERO_ACTION: "Empty action",
  ZERO_POSITION: "Max position is zero",
  ZERO_LOSS: "Max daily loss is zero",
  ZERO_TRADES: "Max trades per day is zero",
  BAD_STOP: "Stop-loss must be 0.01–50 %",
  BAD_EXPIRY: "Limits must expire within 366 days",
};

const ALL = { ...ACT_BITS, ...LIMIT_BITS } as const;
export const bitNames = (mask: bigint) => (Object.keys(ALL) as (ActBit | LimitBit)[]).filter((k) => (mask & ALL[k]) !== 0n);
export const bitWords = (mask: bigint) => bitNames(mask).map((n) => BIT_WORDS[n]);
