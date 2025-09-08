import os
import csv
import numpy as np
import json
from pinecone import Pinecone
from tqdm import tqdm
import getpass

# --- Configuration ---
NPY_FILE = "../data/fsd_embeddings.npy"
CSV_FILE = "../data/fsd50k_with_freesound_urls.csv"
OUTPUT_JSON = "../data/embeddings.json"
INDEX_NAME = "imitune-search"


def npy_csv_to_json():
    """
    Converts .npy and .csv files into a single JSON file.
    This function uses the exact format you provided.
    """
    print(f"Starting conversion to {OUTPUT_JSON}...")

    # 1. Load embeddings and metadata
    embeddings = np.load(NPY_FILE).astype(np.float32)

    freesound_urls = []
    with open(CSV_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            freesound_urls.append(row["freesound_url"])

    if len(freesound_urls) != embeddings.shape[0]:
        raise ValueError("The number of embeddings and CSV rows do not match!")

    # 2. Build the list of data objects in the required format
    data_to_write = []
    for i, embedding in enumerate(embeddings):
        item = {
            "id": f"{(i + 1):012d}",  # 12-digit zero-padded ID
            "embedding": embedding.tolist(),
            "freesound_url": freesound_urls[i]
        }
        data_to_write.append(item)

    # 3. Save the combined data to the output JSON file
    print(f"Saving {len(data_to_write)} items to {OUTPUT_JSON}...")
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data_to_write, f)

    print("JSON file creation complete.")


def upload_to_pinecone():
    """
    Reads data from the generated JSON file and upserts it to Pinecone.
    """
    if not os.path.exists(OUTPUT_JSON):
        print(f"Error: {OUTPUT_JSON} not found. Please create it first.")
        return

    # Get API Key securely and initialize Pinecone
    api_key = os.getenv("PINECONE_API_KEY") or getpass.getpass("Please enter your Pinecone API Key: ")
    if not api_key:
        raise ValueError("Pinecone API Key was not provided.")

    pc = Pinecone(api_key=api_key)
    index = pc.Index(INDEX_NAME)
    print(f"\nSuccessfully connected to Pinecone index '{INDEX_NAME}'.")

    # Load data from the JSON file
    print(f"Loading data from {OUTPUT_JSON}...")
    with open(OUTPUT_JSON, "r", encoding="utf-8") as f:
        embeddings_data = json.load(f)

    # Upsert data in batches
    batch_size = 100
    print(f"Starting upsert process in batches of {batch_size}...")

    for i in tqdm(range(0, len(embeddings_data), batch_size)):
        batch = embeddings_data[i:i + batch_size]
        vectors_to_upsert = [{
            "id": item['id'],
            "values": item['embedding'],
            "metadata": {
                "freesound_url": item['freesound_url']
            }
        } for item in batch]

        try:
            index.upsert(vectors=vectors_to_upsert)
        except Exception as e:
            print(f"An error occurred during upsert for batch {i // batch_size + 1}: {e}")

    print("\nData upsert process has been completed.")
    print(index.describe_index_stats())


if __name__ == "__main__":
    should_create_json = True
    if os.path.exists(OUTPUT_JSON):
        overwrite = input(f"{OUTPUT_JSON} already exists. Overwrite? [y/N]: ").lower().strip()
        if overwrite != 'y':
            print("Skipping JSON file creation.")
            should_create_json = False

    if should_create_json:
        npy_csv_to_json()

    upload_to_pinecone()
