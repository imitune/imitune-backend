# Dev Mode Deploy

This project supports an optional comparison mode at `/dev`.

- Main app at `/` always keeps the normal single-index search flow.
- Dev mode at `/dev` queries all configured Pinecone indexes and shows one row per index.

## Backend

Deploy the backend on Vercel as usual.

Required normal-mode envs:

- `PINECONE_API_KEY`
- `PINECONE_INDEX_HOST`
- `BLOB_READ_WRITE_TOKEN`

Optional dev-mode envs:

- `ENABLE_DEV_MODE=true`
- `PINECONE_DEV_INDEXES_JSON`
- `PINECONE_DEV_INDEX_ORDER=baseline,fsd50k,hybrid`

Example:

```bash
ENABLE_DEV_MODE=true
PINECONE_DEV_INDEXES_JSON={"baseline":{"host":"https://baseline-host.pinecone.io","label":"Baseline"},"fsd50k":{"host":"https://fsd50k-host.pinecone.io","label":"FSD50K"},"hybrid":{"host":"https://hybrid-host.pinecone.io","label":"Hybrid"}}
PINECONE_DEV_INDEX_ORDER=baseline,fsd50k,hybrid
```

Notes:

- `PINECONE_DEV_INDEXES_JSON` must be a single-line JSON string in Vercel.
- More than 3 indexes are supported, but latency and page length will increase.
- If `ENABLE_DEV_MODE` is off, `/dev` requests to the backend are rejected and normal mode still works.

## Frontend

The frontend is deployed with GitHub Actions from `imitune-frontend/web`.

Normal frontend envs:

- `VITE_BACKEND_BASE`
- `VITE_MODEL_URL`

Optional dev-mode switch:

- `VITE_ENABLE_DEV_MODE=true`

If `VITE_ENABLE_DEV_MODE=false`, the `/dev` page is hidden and `/` still works normally.

## Recommended combinations

Normal-only deploy:

- Frontend: `VITE_ENABLE_DEV_MODE=false`
- Backend: `ENABLE_DEV_MODE=false`

Comparison deploy:

- Frontend: `VITE_ENABLE_DEV_MODE=true`
- Backend: `ENABLE_DEV_MODE=true`
- Backend: set `PINECONE_DEV_INDEXES_JSON`

## Deploy flow

1. Set or update Vercel backend env vars.
2. Deploy the backend.
3. Set or update GitHub Actions secrets for the frontend.
4. Trigger the GitHub Pages build.
5. Open `/` for normal mode or `/dev` for comparison mode.