# portfolio-tracker (retired)

The personal portfolio now consists of static pages without visitor tracking or an AI chatbot. The `ask` and `track` source endpoints return HTTP 410 without reading request bodies, environment secrets, visitor IPs or sending provider/database requests.

Deploying these replacements is a separate step. Changing the source does not disable an already deployed Edge Function. No database schema, RLS policy, credentials or existing records were changed by this cleanup.

## Why retire it

The earlier chat endpoint checked daily quotas with separate count and insert operations, which could race or fail open on database errors. The tracking endpoint sent visitor IPs to an HTTP geolocation service. Removing unused data collection and LLM processing avoids retaining those paths solely for a portfolio.

## Offline verification

Node.js 24+:

```sh
node --test tests/*.test.mjs
```

Tests exercise both handlers with malformed and large bodies and assert that they return 410 without reading data, looking up secrets or fetching any URL. They do not contact Supabase or change production state.

`bericht.mjs` is retained for reading historical analytics locally. It requires owner-authorized access to the old table; do not grant public table access just to run a report. Database retention and permissions must be reviewed separately in the actual project.

Earlier implementation is retained in Git history. License remains all rights reserved; see [LICENSE](LICENSE).
