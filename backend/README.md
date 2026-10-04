# Backend options

The static frontend calls an HTTP API. Both backends expose `GET /api/health` and `POST /api/convert` with one image in the multipart field `image`.

## Cloudflare Worker

`cf-worker/src/index.js` calls Cloudflare Workers AI using the LLaVA vision model. The Worker also exposes `GET /api/region`, which returns the visitor's two-letter country code from Cloudflare request metadata. The frontend uses this only to choose the YallaSawi or uPilote maker link; it does not need or receive the visitor's IP address from this endpoint. When country is unavailable, the frontend falls back to browser language.

To deploy, install dependencies in `cf-worker`, create your own KV namespace, replace the KV IDs in `wrangler.toml`, configure the `AI` binding, and run `npx wrangler deploy`. See [Worker setup](cf-worker/SETUP.md). The default rate limit is 3 conversions per IP per day. Check current Cloudflare pricing and model availability for your account.

## Docker backend

`docker/server.js` uses an OpenAI-compatible vision API. Copy `docker/.env.example` to `docker/.env`, set `OPENAI_API_KEY`, `MODEL`, and `CORS_ORIGIN`, then run `docker compose up -d --build` in `docker`.

The Docker backend has no country endpoint, so the maker link falls back to browser language. Its rate limit is held in process memory and resets on restart. For an internet-facing deployment, put it behind HTTPS, configure trusted client IP handling, and use durable rate limiting.

## Frontend configuration

The frontend defaults to the project's public Worker. To use your own backend, set `window.IMAGE_TO_PROMPT_API_URL` before each page's inline application script. This is a backend URL, not a provider key. Do not put `OPENAI_API_KEY` or any other secret into public HTML or JavaScript.
