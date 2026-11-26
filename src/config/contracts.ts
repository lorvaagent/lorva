import { isAddress } from "@/config/brand";

/*
 * Lorva Agent's own contract on Robinhood Chain (chain 4663). Not deployed yet: the owner deploys it from the local-only /deploy page.
 * Once deployed, put the address, the deployment block and the creation transaction below and run
 * `npm run verify-deployment -- --registry <address> --registry-tx <tx>` (prints MATCH).
 *   registry  LorvaAgentRegistry (+ internal library LorvaLimitMath, inlined): agents owned by a wallet, versioned limits, one bound
 *             operator key, Active / Paused / Killed, per-UTC-day usage, canAct reason bits, recorded paper actions as events.
 *             No funds, no admin, no upgrade.
 */
const DEPLOYED = {
  registry: "",
  /** Block of the deployment transaction (log scans start here). */
  block: 0,
  /** Creation transaction. */
  tx: "",
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
