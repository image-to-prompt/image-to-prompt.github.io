# Cloudflare Worker setup

This backend uses the Cloudflare Workers AI binding and the `@cf/llava-hf/llava-1.5-7b-hf` image-to-text model. Cloudflare currently documents that model as beta. Confirm availability and pricing in your own Cloudflare account before deploying.

## Deploy

1. Install Node.js, create a Cloudflare account, and sign in with Wrangler.

   ```bash
   cd backend/cf-worker
   npm install
   npx wrangler login
   ```

2. Create a KV namespace for rate limiting:

   ```bash
   npx wrangler kv namespace create IMAGE_TO_PROMPT_KV
   ```

3. Replace `account_id` in `wrangler.toml` with your Cloudflare account ID and replace the KV `id` with your new namespace ID. Do not reuse the example project's account or namespace ID.

4. The `AI` binding is declared in `wrangler.toml` under `[ai]`. Deploy:

   ```bash
   npx wrangler deploy
   ```

5. Test your deployed URL:

   ```bash
   curl https://your-worker.your-subdomain.workers.dev/api/health
   curl -F "image=@your-image.jpg" https://your-worker.your-subdomain.workers.dev/api/convert
   ```

Point the frontend at your Worker by setting `window.IMAGE_TO_PROMPT_API_URL` before its inline app script. The Worker also serves `GET /api/region` for country-based maker links; Cloudflare supplies `request.cf.country` on incoming requests. Local or dashboard previews may have no country value, and the frontend then uses browser language.

Keep rate limits and provider costs in mind when exposing a public endpoint. The current code accepts JPG, PNG, or WebP images up to 10 MB and allows 3 conversions per IP per day when KV is configured.
