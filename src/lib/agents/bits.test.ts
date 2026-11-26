import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACT_BITS, BIT_WORDS, LIMIT_BITS, bitNames } from "@/lib/agents/bits";

const SOL = readFileSync(new URL("../../../contracts/src/LorvaLimitMath.sol", import.meta.url), "utf8");

test("every bit matches LorvaLimitMath.sol, and the .sol has no bit the site lacks", () => {
  const found = [...SOL.matchAll(/uint256 internal constant ([RL])_([A-Z_]+) = 1 << (\d+);/g)];
  assert.equal(found.length, Object.keys(ACT_BITS).length + Object.keys(LIMIT_BITS).length);
  for (const [, kind, name, shift] of found) assert.equal(((kind === "R" ? ACT_BITS : LIMIT_BITS) as Record<string, bigint>)[name], 1n << BigInt(shift), name);
  for (const k of Object.keys(BIT_WORDS)) assert.ok(BIT_WORDS[k as keyof typeof BIT_WORDS]);
  assert.deepEqual(bitNames(ACT_BITS.PAUSED | ACT_BITS.KILLED), ["PAUSED", "KILLED"]);
});
