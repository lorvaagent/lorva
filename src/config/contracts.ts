import { isAddress } from "@/config/brand";

/*
 * Lorva Agent's own contract on Robinhood Chain (chain 4663). Deployed 26 Nov 2026 by the owner.
 * Address, deployment block and creation transaction below; check with
 * `npm run verify-deployment -- --registry <address> --registry-tx <tx>` (prints MATCH).
 *   registry  LorvaAgentRegistry (+ internal library LorvaLimitMath, inlined): agents owned by a wallet, versioned limits, one bound
 *             operator key, Active / Paused / Killed, per-UTC-day usage, canAct reason bits, recorded paper actions as events.
 *             No funds, no admin, no upgrade.
 */
const DEPLOYED = {
  registry: "0x10601674a388e26c8236ff67d531fbd9b1f86126",
  /** Block of the deployment transaction (log scans start here). */
  block: 123517295,
  /** Creation transaction. */
  tx: "0x7a6bd8a8700b2daeea2ec691951a86d11ea8b27cb31bdc91ca2bd4b4524019a1",
};

/**
 * Local tests only: NEXT_PUBLIC_LORVA_TEST_CONTRACTS='{"registry":"0x…","block":1}' at build time points a second build at a contract
 * on an anvil chain. Never set it on Vercel.
 */
function testOverride(): typeof DEPLOYED | null {
  const raw = process.env.NEXT_PUBLIC_LORVA_TEST_CONTRACTS;
  if (!raw) return null;
  try {
    const v = { ...DEPLOYED, ...(JSON.parse(raw) as Partial<typeof DEPLOYED>) };
    return isAddress(v.registry) ? v : null;
  } catch {
    return null;
  }
}

export const CONTRACTS = testOverride() ?? DEPLOYED;
export const registryLive = () => isAddress(CONTRACTS.registry);
export const CONTRACT_NAME = "LorvaAgentRegistry" as const;
