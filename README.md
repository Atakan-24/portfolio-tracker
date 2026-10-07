# portfolio-tracker

Privacy-conscious visitor analytics and a grounded "ask me anything" chat
for [my portfolio site](https://atakan-24.github.io/). Two small Supabase
Edge Functions with rate limiting; raw IP addresses are not written to the application database.

## What it does

**`functions/track`** — logs pageviews and outbound link clicks
from the portfolio site. Resolves the visitor's country via a transient IP
geolocation lookup (ip-api.com), and does not write the raw IP to the database. Event records include country,
region and page/referrer metadata. The geolocation provider receives the IP.

**`functions/ask`** — a small AI chat backend for the "Ask me directly"
section of the portfolio. Its prompt supplies a fixed knowledge block (my
real CV, goals document and project write-ups) and is instructed to say "I
don't know" rather than invent an answer. Runs on Groq's free tier
(`openai/gpt-oss-20b`); operating cost depends on provider quotas and usage. Rate-limited per
visitor (hashed IP) and globally per day to reduce quota exhaustion.

**`bericht.mjs`** — a small CLI script that prints a summary of recent
visits: country breakdown, top referrers, most-clicked links.

## Why it's built this way

- **No raw IP in application records.** `ask` stores a SHA-256 hash of the
  IP for rate limiting. A hash is a pseudonymous identifier, not a guarantee
  of anonymity. Page/referrer metadata and free-text questions can also
  contain information supplied by visitors.
- **The AI is grounded, not open-ended.** Its knowledge is a fixed text
  block rather than a live search. The prompt asks it to admit uncertainty;
  that instruction reduces unsupported answers but cannot guarantee accuracy.
- **Quota-conscious operation.** Per-visitor and daily limits help manage
  provider usage. They do not guarantee zero cost under every configuration
  or future pricing policy.

## Stack

- Supabase (Postgres + Edge Functions, Deno runtime)
- Groq API (free tier, `openai/gpt-oss-20b`)

## Running the report locally

```bash
cp .env.example .env.local   # fill in your own Supabase project URL + anon key
node bericht.mjs             # last 7 days
node bericht.mjs --tage=30   # last 30 days
```

The Edge Functions themselves are deployed straight to Supabase (Dashboard
or `supabase functions deploy`) — `functions/*/index.ts` here is the
version-controlled source, not something you run directly with Node.

## License

All rights reserved — see [LICENSE](LICENSE). Published for demonstration
and portfolio purposes; feel free to read the code, not to reuse it.
