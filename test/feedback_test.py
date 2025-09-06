import os
import requests
import base64
import json

# --- Configuration ---
LOCAL_API_URL = "http://localhost:3000/api/feedback"
SAMPLE_AUDIO_FILE = "../data/sample_query.webm"


def test_feedback_api():
    """
    Simulates a frontend request by sending a sample audio file and feedback
    data to the local Vercel development server.
    """
    # 1. Check if the sample audio file exists
    if not os.path.exists(SAMPLE_AUDIO_FILE):
        print(f"❌ Error: Sample audio file not found at '{SAMPLE_AUDIO_FILE}'.")
        print("Please create a short .webm or .wav file and place it there to run this test.")
        return

    # 2. Read the audio file and encode it as a base64 string
    print(f"Reading and encoding audio file: {SAMPLE_AUDIO_FILE}")
    with open(SAMPLE_AUDIO_FILE, "rb") as f:
        audio_bytes = f.read()

    # The frontend will send the audio in this Data URL format
    audio_base64 = f"data:audio/webm;base64,{base64.b64encode(audio_bytes).decode('utf-8')}"

    # 3. Prepare the test payload with new format
    payload = {
        "audioQuery": audio_base64,
        "freesound_urls": [
            "https://freesound.org/people/user/sounds/12345/", None, "https://freesound.org/people/user/sounds/67890/"
        ],
        "ratings": ["like", None, "dislike"]
    }

    # 4. Send the POST request to the local Vercel API
    print(f"Sending feedback to local server: {LOCAL_API_URL}...")
    try:
        response = requests.post(LOCAL_API_URL, json=payload, timeout=30)
        response.raise_for_status()

        # 5. Print the successful response from the server
        response_data = response.json()
        print("\n✅ Success! Feedback submitted successfully.")
        print("Server response:")
        print(json.dumps(response_data, indent=2))

        # 6. Print the expected storage format
        print("\n📦 Expected storage format in metadata:")
        expected_metadata = {
            "audioUrl": response_data.get("audioUrl", "URL_WILL_BE_HERE"),
            "audioId": response_data.get("audioId", "ID_WILL_BE_HERE"),
            "freesound_urls": payload["freesound_urls"],
            "ratings": payload["ratings"],
            "createdAt": "TIMESTAMP_WILL_BE_HERE"
        }
        print(json.dumps(expected_metadata, indent=2))

    except requests.exceptions.RequestException as e:
        print(f"\n❌ An error occurred while communicating with the server:")
        print(e)
        if e.response:
            print("Raw server error response:", e.response.text)


if __name__ == "__main__":
    test_feedback_api()
