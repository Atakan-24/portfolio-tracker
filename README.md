# portfolio-tracker

Privacy-conscious visitor analytics and a grounded "ask me anything" chat
for [my portfolio site](https://atakan-24.github.io/). Two small Supabase
Edge Functions, a rate limit, and no IP address ever stored.

## What it does

**`functions/track`** — logs anonymous pageviews and outbound link clicks
from the portfolio site. Resolves the visitor's country via a transient IP
geolocation lookup (ip-api.com), then discards the IP — only the country and
region are ever written to the database.

**`functions/ask`** — a small AI chat backend for the "Ask me directly"
section of the portfolio. It answers only from a fixed knowledge block (my
real CV, goals document and project write-ups) and is instructed to say "I
don't know" rather than invent an answer. Runs on Groq's free tier
(`openai/gpt-oss-20b`), so it costs nothing to operate. Rate-limited per
visitor (hashed IP, never stored in plaintext) and globally per day, so one
visitor can't exhaust the free quota for everyone else.

**`bericht.mjs`** — a small CLI script that prints a summary of recent
visits: country breakdown, top referrers, most-clicked links.

## Why it's built this way

- **No identity, ever.** The database has no IP column and no name/email
  column. `ask`'s rate limiting works off a SHA-256 hash of the IP, not the
  IP itself.
- **The AI is grounded, not open-ended.** Its knowledge is a fixed text
  block, not a live search — it can't say something about me that isn't in
  that block, and it's told explicitly to admit when it doesn't know
  something instead of guessing.
- **Free by construction, not by promise.** Groq's free tier and Supabase's
  free tier cost nothing at this scale; the rate limits exist so that stays
  true even under a burst of traffic or an automated bot, not just under
  normal use.

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
