# ImageToPrompt

An open source image-to-prompt web app. Upload a JPG, PNG, or WebP and receive a general visual description you can refine for an image generator.

- [Try the hosted demo](https://image-to-prompt.github.io/)
- [Image to prompt guide](https://image-to-prompt.github.io/blog/image-to-prompt-guide/)
- [Self-hosting guide](https://image-to-prompt.github.io/blog/self-host-image-to-prompt/)

The public demo currently allows **3 conversions per IP per day**. It sends the uploaded image to the project's Cloudflare Worker for AI analysis. The output is a general description; it does not automatically add Midjourney parameters, Stable Diffusion weights, or negative prompts.

The small maker sidebar links visitors from Arabic countries to YallaSawi and other visitors to uPilote. It uses the Worker's `/api/region` country response, with browser language as a fallback. Deploy the updated Worker as well as the static files for country routing to work. No customer quotes are included without verified attribution.

## Repository layout

- `index.html` and translated pages in `es/`, `zh/`, `ru/`, `ar/`: static frontend
- `blog/`: practical guide and self-hosting instructions
- `backend/cf-worker/`: Cloudflare Workers AI backend
- `backend/docker/`: Docker and OpenAI-compatible backend
- `sitemap.xml`, `robots.txt`: search discovery

## Run locally

```bash
python -m http.server 8000
```

Open `http://localhost:8000`. By default, the frontend calls the project's public API. To point it at your own backend, define `window.IMAGE_TO_PROMPT_API_URL` before the inline application script in each page you deploy:

```html
<script>window.IMAGE_TO_PROMPT_API_URL = 'https://your-api.example.com';</script>
```

This is a public backend URL, **not** an API key. Keep provider credentials on the server.

## Deploy your own backend

### Cloudflare Workers AI

1. Create a Cloudflare account and install the dependencies in `backend/cf-worker` with `npm install`.
2. Set your own `account_id` in `wrangler.toml`, create your own KV namespace with Wrangler, and replace the namespace ID.
3. Configure the Workers AI binding named `AI` and deploy with `npx wrangler deploy`.
4. Set the frontend API URL to your Worker URL.

See [Worker setup](backend/cf-worker/SETUP.md). Review the current Cloudflare plan and model availability in your account; usage can incur costs.

### Docker and an OpenAI-compatible provider

1. Copy `backend/docker/.env.example` to `backend/docker/.env`.
2. Set `OPENAI_API_KEY`, `MODEL`, and `CORS_ORIGIN` in `.env`.
3. Run `docker compose up -d --build` from `backend/docker`.
4. Set the frontend API URL to your HTTPS backend URL.

The Docker rate limiter is in memory and resets on restart. Configure trusted client IP handling, HTTPS, and durable rate limiting before exposing it broadly.

## API

- `GET /api/health` checks availability.
- `POST /api/convert` accepts one image in multipart form field `image` and returns a JSON `prompt` on success.

The frontend accepts JPG, PNG, and WebP up to 10 MB and may resize or recompress an image in the browser before upload. The backend code does not intentionally save uploaded image files. Your host and AI provider may still process request data under their own policies.

## Contributing

Issues and pull requests are welcome. Please avoid including private images, credentials, or generated `.env` files. This project is released under the [MIT License](LICENSE).

ImageToPrompt is made by the team behind [uPilote](https://upilote.com/).
