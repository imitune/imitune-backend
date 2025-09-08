import os
import csv
from pinecone import Pinecone
from tqdm import tqdm
import getpass
import time

# --- Configuration ---
# Use the NEW CSV file that indicates which items to delete.
CSV_FILE_FOR_DELETION = "../data/fsd50k_with_freesound_urls_novoices.csv"
INDEX_NAME = "imitune-search"


def get_pinecone_api_key():
    """
    Finds the API key from environment variables or securely prompts the user for it.
    """
    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        print("PINECONE_API_KEY environment variable not found.")
        api_key = getpass.getpass("Please enter your Pinecone API Key: ")
    return api_key


def delete_vectors_from_pinecone():
    """
    Reads a CSV file, identifies rows with empty 'freesound_url',
    generates the corresponding vector IDs, and deletes them from Pinecone.
    """
    # 1. Find the IDs to delete
    print(f"Reading {CSV_FILE_FOR_DELETION} to identify vectors for deletion...")
    ids_to_delete = []
    with open(CSV_FILE_FOR_DELETION, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        # We use enumerate to get the row number (0-indexed)
        for i, row in enumerate(reader):
            # Check if the freesound_url is empty or does not exist
            if not row.get("freesound_url"):
                # Generate the ID based on the same logic as upload.py (1-based index)
                vector_id = f"{(i + 1):012d}"
                ids_to_delete.append(vector_id)

    if not ids_to_delete:
        print("No empty 'freesound_url' entries found. Nothing to delete.")
        return

    print(f"Found {len(ids_to_delete)} vectors to delete.")
    # --- NEW: Show a sample of IDs to be deleted ---
    print("Sample IDs to be deleted:", ids_to_delete[:5])

    # 2. Safety Check: Ask the user for confirmation
    confirm = input(
        f"Are you sure you want to delete {len(ids_to_delete)} vectors from the '{INDEX_NAME}' index? This action cannot be undone. [y/N]: "
    ).lower().strip()
    if confirm != 'y':
        print("Deletion cancelled by user.")
        return

    # 3. Initialize Pinecone client
    pinecone_api_key = get_pinecone_api_key()
    if not pinecone_api_key:
        raise ValueError("Pinecone API Key was not provided.")

    pc = Pinecone(api_key=pinecone_api_key)
    index = pc.Index(INDEX_NAME)
    print(f"\nSuccessfully connected to Pinecone index '{INDEX_NAME}'.")

    # Get initial stats for comparison
    initial_stats = index.describe_index_stats()
    print("Vector count before deletion:", initial_stats['total_vector_count'])

    # 4. Delete the vectors in batches
    # Pinecone's delete operation can handle up to 1,000 IDs per request.
    batch_size = 1000
    print(f"Starting deletion process in batches of {batch_size}...")

    for i in tqdm(range(0, len(ids_to_delete), batch_size)):
        batch_ids = ids_to_delete[i:i + batch_size]
        try:
            index.delete(ids=batch_ids)
            # --- NEW: Add confirmation log for each batch ---
            tqdm.write(f"Deletion request sent for batch {i // batch_size + 1} containing {len(batch_ids)} IDs.")
        except Exception as e:
            tqdm.write(f"An error occurred during deletion for batch {i // batch_size + 1}: {e}")

    # --- NEW: Increased wait time for eventual consistency ---
    wait_time = 30
    print(f"\nDeletion process has been completed. Waiting {wait_time} seconds for index stats to update...")
    time.sleep(wait_time)

    final_stats = index.describe_index_stats()
    print("Vector count after deletion:", final_stats['total_vector_count'])

    # --- NEW: Final confirmation ---
    expected_count = initial_stats['total_vector_count'] - len(ids_to_delete)
    print(f"Expected final vector count: ~{expected_count}")
    print("Note: The final count might take a few minutes to be perfectly accurate due to eventual consistency.")
    print("Please also check the vector count in the Pinecone dashboard for final confirmation.")


if __name__ == "__main__":
    delete_vectors_from_pinecone()
