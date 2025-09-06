import os
import json
import requests
import random

# --- Configuration ---
# This is the real, deployed production URL for your Vercel API
VERCEL_API_URL = "https://imitune-backend-bptzlaz7e-chris-projects-3c0d9932.vercel.app/api/search"
JSON_FILE = "../data/embeddings.json"


def test_production_api_query():
    """
    Loads a random embedding from the local JSON file, sends it as a query
    to the DEPLOYED Vercel API, and prints the search results.
    """
    # 1. Check if the JSON file exists
    if not os.path.exists(JSON_FILE):
        print(f"Error: {JSON_FILE} not found. Please create it first.")
        return

    # 2. Load the data and select a random item to use as the query
    print(f"Loading query data from {JSON_FILE}...")
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        all_data = json.load(f)

    if not all_data:
        print("Error: The JSON file is empty.")
        return

    query_item = random.choice(all_data)
    query_vector = query_item['embedding']

    print("-" * 50)
    print(f"Querying production server with a random sound:")
    print(f"  ID: {query_item['id']}")
    print(f"  Freesound URL: {query_item.get('freesound_url', 'N/A')}")
    print("-" * 50)

    # 3. Prepare the request payload
    payload = {"embedding": query_vector}

    # 4. Send the POST request to the Vercel API
    print(f"Sending query to production URL: {VERCEL_API_URL}...")
    try:
        response = requests.post(VERCEL_API_URL, json=payload, timeout=20)
        response.raise_for_status()

        # 5. Process and display the results
        search_results = response.json()

        print("\n✅ Success! Received search results from the production server:\n")
        for result in search_results.get('results', []):
            print(f"  - ID: {result['id']}")
            print(f"    Score: {result.get('score', 0):.4f}")
            print(f"    Freesound URL: {result.get('freesound_url', 'N/A')}\n")

    except requests.exceptions.RequestException as e:
        print(f"\n❌ An error occurred while communicating with the server:")
        print(e)
    except json.JSONDecodeError:
        print("\n❌ Failed to parse the server's response. It was not valid JSON.")
        print("Raw server response:", response.text)


if __name__ == "__main__":
    test_production_api_query()
