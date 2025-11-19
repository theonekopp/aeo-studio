## AEO Counterfactual Impact Lab — Beta API

Backend API scaffolding for the AEO Counterfactual Impact Lab per PRD. Includes:

- Express API with endpoints from the PRD
- Prisma + Postgres schema (Railway compatible)
- Seeded `engines` table (chatgpt, perplexity)
- OpenRouter integration wrapper (with `USE_MOCKS` option)
- Simple sequential workers for capture → score → counterfactuals
- Basic password auth (single password)

### Requirements

- Node 18+
- Railway Postgres (or any Postgres)

### Environment

Copy `.env.example` to `.env` and set values:

- `DATABASE_URL` — Railway Postgres URL
- `OPENROUTER_API_KEY` — OpenRouter API key
- `BRAND_NAMES` — comma-separated list used by evaluators
- `ADMIN_PASSWORD` — required for Basic Auth
- `USE_MOCKS` — `true` to avoid external calls in dev
- `CHATGPT_MODEL` — OpenRouter model for ChatGPT engine (default `openai/gpt-4o-mini`)
- `PERPLEXITY_MODEL` — OpenRouter model for Perplexity engine (default `perplexity/sonar-small-online`)
- `DEFAULT_ANSWER_MODEL` — fallback model for unknown engines
- `EVALUATOR_MODEL` — model for scoring + counterfactual JSON outputs (default `openai/gpt-4o-mini`)

### Setup

```bash
npm install
npm run prisma:generate
# Create DB and run migrations (you can use `prisma migrate dev` during dev)
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

The API listens on `:3000` by default. Railway sets `PORT` automatically.

### Web UI (Next.js)

Located in `web/`. Deploy as a separate Railway service pointing to the `web` subdirectory (Root Directory setting) or run locally.

Local run:

```
cd web
npm install
npm run dev
```

You have two ways to connect the web UI to the API:

- Server-side proxy (works with Railway internal URL):
  - In the web service, set `API_BASE_INTERNAL` to your API internal URL (e.g., `https://<api>.railway.internal`).
  - The web app proxies browser requests from `/api/*` to the API.
  - No `NEXT_PUBLIC_API_BASE` needed.

- Direct browser calls (requires public API URL):
  - In the web service, set `NEXT_PUBLIC_API_BASE` to your public API URL (e.g., `https://<api>.up.railway.app`).
  - Requests go straight from the browser to the API.

Railway (monorepo) steps:
- Add a new service from the same repo
- In service settings, set Root Directory to `web`
- Choose one of the env approaches above
- Deploy — Next will bind to `PORT` automatically
Visit `/login` to save the API password, then use the Runs dashboard.

### Endpoints (subset)

- `POST /runs/start` — creates a run and executes capture → score → counterfactuals
- `GET /runs/:id` — run info
- `GET /runs/:id/summary` — matrix of `query × engine` scores
- `GET /queries` — list queries
- `POST /queries` — create query `{ text, funnel_stage, priority?, target_url? }`
- `GET /observations?run_id=...`
- `GET /counterfactuals?observation_id=...`
- `GET /brand-deltas?observation_id=...`
- `POST /jobs/capture-run` — run capture phase only
- `POST /jobs/score-run` — run scoring phase only
- `POST /jobs/counterfactual-run` — run counterfactuals phase only

All endpoints require Basic Auth. Use any username with `ADMIN_PASSWORD` as password.

### OpenRouter

The wrapper at `src/services/openrouter.ts` sends chat completions with `response_format: json_object` and validates with Zod. Set `USE_MOCKS=true` to bypass network for local dev.

Answer capture uses `chatText()` (no JSON format) and maps engine names → models via env vars above.

### Deployment (Railway)

- Create a new project and add a Postgres database
- Add a service from this repo; Railway auto-detects Node and sets `PORT`
- Set environment variables in Railway (see above)
- Add a deploy hook/cron for weekly runs (optional): POST `https://<host>/runs/start`

### Next Steps

- Add Next.js dashboard consuming these APIs
- Add proper job queue + retries
 - Optional: add Playwright capture as a future alternative if needed
