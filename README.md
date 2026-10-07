# portfolio-tracker (retired)

The personal portfolio now consists of static pages without visitor tracking or an AI chatbot. The `ask` and `track` source endpoints return HTTP 410 without reading request bodies, environment secrets, visitor IPs or sending provider/database requests.

The replacements were deployed to the verified `portfolio-tracker` project on October 8, 2026 (local time). JWT settings are unchanged. No records or credentials were deleted.

## Why retire it

The earlier chat endpoint checked daily quotas with separate count and insert operations, which could race or fail open on database errors. The tracking endpoint sent visitor IPs to an HTTP geolocation service. Removing unused data collection and LLM processing avoids retaining those paths solely for a portfolio.

## Offline verification

Node.js 24+:

```sh
node --test tests/*.test.mjs
```

Tests exercise both handlers with malformed and large bodies and assert that they return 410 without reading data, looking up secrets or fetching any URL. They do not contact Supabase or change production state.

## Historical data access

Live inspection found RLS enabled with `anon` SELECT policies using `true` on both log tables. The [migration](supabase/migrations/20261007211944_protect_portfolio_logs.sql) removes those policies and revokes table privileges from PUBLIC, anon and authenticated. Existing owner/service-role access and all records are retained. Post-migration metadata checks confirm client SELECT/TRUNCATE access is denied and owner SELECT remains available.

`bericht.mjs` can read historical visits locally with explicit owner credentials in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never use that key in browser code or publish an environment file. The CLI restricts its destination to a hosted HTTPS Supabase origin, bounds the time window and warns if its 1,000-record limit may truncate totals. No visitor records were read during this audit.

The Supabase Advisor now reports RLS with no client policies as an informational notice. This is intentional for owner-only retained logs; see [the notice documentation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Earlier implementation is retained in Git history. License remains all rights reserved; see [LICENSE](LICENSE).
