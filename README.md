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
---
*Last Updated: September 2025 Sat 6 23:35*