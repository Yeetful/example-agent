// Example agent with a Yeetful expense account.
//
// One wrapper — yeetful({ wallet, grant }) — turns plain fetch into a
// spend-controlled paid fetch: an allowlist plus per-call / per-day budgets is
// enforced BEFORE any x402 payment is signed, and every decision (settlement
// or denial) emits a receipt.
//
// Default run is FREE: a throwaway key, a free API call through the expense
// account, and a blocked off-allowlist call. Set PRIVATE_KEY + LIVE=1 in .env
// to make one real paid call (~$0.01 USDC on Base) against TripAdvisor's x402
// API.

import 'dotenv/config'
import { createWalletClient, http } from 'viem'
import { base } from 'viem/chains'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { yeetful, GrantError } from 'yeetful/agent'

const LIVE = process.env.LIVE === '1' && !!process.env.PRIVATE_KEY

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY ?? generatePrivateKey(), // throwaway in demo mode
)
const wallet = createWalletClient({ account, chain: base, transport: http() })

// The expense account: which hosts this agent may pay, and how much.
const pay = yeetful({
  wallet,
  grant: {
    // Mirrors a hosted grant when YEETFUL_GRANT_ID is set (yeetful.com dashboard).
    id: process.env.YEETFUL_GRANT_ID || undefined,
    allow: [
      'tripadvisor.x402.paysponge.com', // paid x402 API ($0.01/call)
      'api.github.com', // free API — the wrapper passes non-402 calls through
    ],
    perCallUsd: 0.05,
    perDayUsd: 1,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  },
  // With an API key + grant id, receipts also sync to your yeetful.com
  // dashboard ledger.
  apiKey: process.env.YEETFUL_API_KEY || undefined,
  onReceipt: (r) =>
    console.log(
      `  receipt → ${r.ok ? 'OK ' : 'DENY'} ${r.host}  $${r.amountUsd}` +
        (r.txHash ? `  tx ${r.txHash.slice(0, 14)}…` : '') +
        `  (${r.note})`,
    ),
  onEvent: (m) => console.log(`  ${m}`),
})

console.log(`\nAgent wallet: ${account.address}  (${LIVE ? 'LIVE' : 'demo — no spending'})\n`)

// 1. A free call THROUGH the expense account — non-402 responses pass through,
//    still allowlist-checked and receipted ($0).
console.log('1) Free call via the expense account (api.github.com/zen):')
const zen = await pay('https://api.github.com/zen', {
  headers: { 'user-agent': 'yeetful-example-agent' },
})
console.log(`   "${await zen.text()}"\n`)

// 2. A host that is NOT on the allowlist — denied before any network call,
//    with a receipt for the audit trail.
console.log('2) Off-allowlist call (denied before any network I/O):')
try {
  await pay('https://api.openai.com/v1/models')
} catch (err) {
  if (err instanceof GrantError) console.log(`   blocked: ${err.code}\n`)
  else throw err
}

// 3. LIVE only: one real x402 payment — 402 challenge → USDC payment signed
//    (grant-checked first) → 200 + settlement receipt.
if (LIVE) {
  console.log('3) Paid x402 call (TripAdvisor location search, ~$0.01):')
  const res = await pay(
    'https://tripadvisor.x402.paysponge.com/api/v1/location/search?searchQuery=tokyo&language=en',
  )
  const body = await res.json()
  console.log(`   ${res.status} — ${JSON.stringify(body).slice(0, 120)}…\n`)
} else {
  console.log('3) Paid call skipped (set PRIVATE_KEY and LIVE=1 in .env to spend ~$0.01).\n')
}

console.log(
  `Spent today: $${pay.spentTodayUsd().toFixed(2)} · remaining: $${pay
    .remainingTodayUsd()
    .toFixed(2)}`,
)

// Drain hosted-ledger sync before exit (no-op without YEETFUL_API_KEY).
await pay.flushLedger()
