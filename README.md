# example-agent

> Give your agent an expense account.
> An allowlist + per-call / per-day budget, enforced **before** any x402 payment is signed.
> A receipt for every decision — and a dashboard that sees them all.

This is the smallest end-to-end example of adding [Yeetful](https://yeetful.com) spend
control to an agent: one standalone Node script that wraps `fetch` with the
[`yeetful`](https://www.npmjs.com/package/yeetful) SDK and pays x402 APIs in USDC on
Base — within a budget it cannot exceed.

```js
import { yeetful } from 'yeetful/agent'

const pay = yeetful({
  wallet, // viem WalletClient
  grant: {
    allow: ['tripadvisor.x402.paysponge.com'],
    perCallUsd: 0.05,
    perDayUsd: 1,
  },
})

await pay('https://tripadvisor.x402.paysponge.com/api/v1/location/search?searchQuery=tokyo')
// 402 challenge → grant check → USDC payment signed → 200 + receipt
```

## Run it

```sh
npm install
npm start          # FREE demo: throwaway wallet, no spending
```

The free demo shows the two halves of the expense account:

1. an allowlisted **free** API call passes through (still receipted, $0), and
2. an off-allowlist call is **denied before any network I/O** (`GrantError: NOT_ALLOWED`),
   with a denial receipt for the audit trail.

### Live mode (real money, ~$0.01)

```sh
cp .env.example .env   # add PRIVATE_KEY (small dedicated burner!) and LIVE=1
npm start
```

Makes one real x402 call: TripAdvisor location search, $0.01 USDC on Base, settled
via the standard 402-challenge → payment → 200 flow. The grant caps the blast
radius: $0.05/call, $1/day, expires in 24h — even a runaway loop can't spend more.

## Dashboard sync (optional)

Create your expense account at [yeetful.com/dashboard](https://yeetful.com/dashboard),
mint an API key, and set `YEETFUL_API_KEY` + `YEETFUL_GRANT_ID` in `.env` — every
receipt (settlements *and* denials) then syncs to your hosted ledger, so budgets and
the audit feed include this agent.

## Files

| file | what |
|---|---|
| `index.js` | the whole integration — ~40 lines without comments |
| `.env.example` | the only env file that ships; copy to `.env` (gitignored) |

MIT
