import os
import json
import requests
import random

# --- Configuration ---
VERCEL_API_URL = "http://localhost:3000/api/search"
JSON_FILE = "../data/embeddings.json"


def test_api_query():
    """
    Loads a random embedding from the JSON file, sends it as a query to the
    Vercel API, and prints the search results.
    """
    if not os.path.exists(JSON_FILE):
        print(f"Error: {JSON_FILE} not found. Please create it first.")
        return

    print(f"Loading query data from {JSON_FILE}...")
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        all_data = json.load(f)

    if not all_data:
        print("Error: The JSON file is empty.")
        return

    query_item = random.choice(all_data)
    query_vector = query_item['embedding']

    print("-" * 50)
    print(f"Querying with a random sound from your local data:")
    print(f"  ID: {query_item['id']}")
    print(f"  Freesound URL: {query_item.get('freesound_url', 'N/A')}")
    print("-" * 50)

    payload = {"embedding": query_vector}

    print(f"Sending query to {VERCEL_API_URL}...")
    try:
        response = requests.post(VERCEL_API_URL, json=payload, timeout=20)
        response.raise_for_status()

        search_results = response.json()

        print("\n✅ Success! Received search results from the server:\n")
        # The server now returns 'freesound_url'
        for result in search_results.get('results', []):
            print(f"  - ID: {result['id']}")
            print(f"    Score: {result.get('score', 0):.4f}")
            print(f"    Freesound URL: {result.get('freesound_url', 'N/A')}\n")

    except requests.exceptions.RequestException as e:
        print(f"\n❌ An error occurred while communicating with the server:")
        print(e)
    except json.JSONDecodeError:
        print("\n❌ Failed to parse the server's response. The response was not valid JSON.")
        print("Raw server response:", response.text)


if __name__ == "__main__":
    test_api_query()
