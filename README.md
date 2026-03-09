# ImiTune Backend


## Installation

```bash
bash install.sh
```

## Upload embeddings to pinecone
You can skip this, once done.

First make sure `fsd_embeddings.npy` and `fsd50k_with_freesound_utls.csv` in `/data`.
```
pip install -r requirements.txt
cd db_manager
upload.py
```

The generated `data/embeddings.json` will look like, and it will upload it to pinecone:
```
{
    "id": "000000000001",
    "values": [0.123, -0.456, 0.789, ...],
    "metadata": {
        "freesound_url": "https://freesound.org/people/looplicator/sounds/825441/"
    }
}

```

## Run the server (dev-mode) & Test query

```bash
# Start vercel server...
vercel login
vercel dev
```

```bash
# Open another terminal & test search
cd test
query_test.py
feedback_test.py
```

## Deploy vercel product
```bash
vercel --prod
```
Then you will see the deployed vercel product info like this:

```
✅  Production: https://imitune-ba....1234.vercel.app 
```
The API is `https://imitune-ba....1234.vercel.app/api/search` (add `/api/search` or `/api/feedback`).
Next, modify the `VERCEL_API_URL` in `test/query_test_prod.py` and `test/feedback_test_prod.py`.
Also make sure of adding keys (`BLOB_READ_WRITE_TOKEN`, `PINECONE_API_KEY`, `PINECONE_ENVIRONMENT`)
in `Dashboard > Settings > Environment Variables`.  
For a quick test, go to vercel `Settings > Deployment Protection` and disable `Vercel Authentication`.

```
# Test the deployed vercel server search
cd test
python query_test_prod.py
python feedback_test_prod.py
```

## Done!!
- ImiTune API Reference is [here](ImiTune_API_Reference.md).
- Example code for Frontend Integration is [here](Frontend_Integration_Guidline.md)

## Optional multi-index dev mode

The backend can optionally power a comparison page that queries multiple Pinecone indexes in parallel while keeping the normal single-index behavior unchanged.

Production single-index mode:

- `PINECONE_API_KEY`
- `PINECONE_INDEX_HOST`

Optional comparison-mode envs:

- `ENABLE_DEV_MODE=true`
- `PINECONE_DEV_INDEXES_JSON`
- `PINECONE_DEV_INDEX_ORDER` (optional comma-separated order for rows)

Example for 3 indexes:

```bash
ENABLE_DEV_MODE=true
PINECONE_DEV_INDEXES_JSON={"baseline":{"host":"https://baseline-host.pinecone.io","label":"Baseline"},"fsd50k":{"host":"https://fsd50k-host.pinecone.io","label":"FSD50K"},"hybrid":{"host":"https://hybrid-host.pinecone.io","label":"Hybrid"}}
PINECONE_DEV_INDEX_ORDER=baseline,fsd50k,hybrid
```

The JSON value is an object keyed by your own logical index ids. Each entry can be either:

- a full object with `host` and optional `label`
- a plain host string, in which case the key is also used as the label

Readable JSON for the same 3-index example:

```json
{
    "baseline": {
        "host": "https://baseline-host.pinecone.io",
        "label": "Baseline"
    },
    "fsd50k": {
        "host": "https://fsd50k-host.pinecone.io",
        "label": "FSD50K"
    },
    "hybrid": {
        "host": "https://hybrid-host.pinecone.io",
        "label": "Hybrid"
    }
}
```

Minimal shorthand version:

```bash
PINECONE_DEV_INDEXES_JSON={"baseline":"https://baseline-host.pinecone.io","fsd50k":"https://fsd50k-host.pinecone.io","hybrid":"https://hybrid-host.pinecone.io"}
```

Suggested Vercel setup:

1. In Vercel, open the backend project settings.
2. Add `ENABLE_DEV_MODE=true`.
3. Add `PINECONE_DEV_INDEXES_JSON` as one single-line JSON string.
4. Optionally add `PINECONE_DEV_INDEX_ORDER` if you want a stable row order in `/dev`.

Are more than 3 supported?

- Backend: yes. The API will query however many configured indexes you provide.
- Frontend `/dev`: yes. It will render one row per configured index.
- Practical limit: latency and page length will grow roughly linearly with the number of indexes, because each search fans out to all configured hosts and each row renders up to 3 Freesound embeds.

In practice, 3 to 5 indexes should still be reasonable. Once you get much beyond that, the page will become long and the request fan-out will be heavier, so it is still supported but less smooth.

API behavior:

- Normal requests keep returning `{ results: [...] }`
- Dev requests send `{ embedding, mode: "dev" }` and receive `{ mode: "multi-index", rows: [...] }`
- Feedback submissions may include `result_contexts` so stored metadata preserves which index produced each rated result
---
*Last Updated: September 2025 Sat 6 23:35*