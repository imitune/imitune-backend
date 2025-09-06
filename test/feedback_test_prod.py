import os
import requests
import base64
import json

# --- Production Configuration ---
PROD_API_URL = "https://imitune-backend-bptzlaz7e-chris-projects-3c0d9932.vercel.app/api/feedback"  # Replace with your actual Vercel URL
SAMPLE_AUDIO_FILE = "../data/sample_query.webm"


def test_feedback_api_prod():
    """
    Test the feedback API on Vercel production environment
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

    # 3. Prepare the test payload
    payload = {
        "audioQuery": audio_base64,
        "freesound_urls": [
            "https://freesound.org/people/user/sounds/12345/", None, "https://freesound.org/people/user/sounds/67890/"
        ],
        "ratings": ["like", None, "dislike"]
    }

    # 4. Send the POST request to the production API
    print(f"Sending feedback to production server: {PROD_API_URL}...")
    try:
        response = requests.post(PROD_API_URL, json=payload, timeout=60)  # Increased timeout for production
        response.raise_for_status()

        # 5. Print the successful response from the server
        response_data = response.json()
        print("\n✅ Success! Feedback submitted successfully to production.")
        print("Server response:")
        print(json.dumps(response_data, indent=2))

    except requests.exceptions.RequestException as e:
        print(f"\n❌ An error occurred while communicating with the production server:")
        print(f"Error: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Status Code: {e.response.status_code}")
            print("Error Response:", e.response.text)
        print("\n💡 Troubleshooting tips:")
        print("1. Make sure your Vercel app is deployed and running")
        print("2. Check if the API URL is correct")
        print("3. Verify that CORS is properly configured on Vercel")
        print("4. Check Vercel logs for any deployment errors")


def test_without_audio_file():
    """
    Alternative test without audio file - just test the API connectivity
    """
    print("\n🧪 Testing API connectivity without audio file...")

    payload = {
        "audioQuery": "data:audio/webm;base64,dGVzdA==",  # Minimal test base64
        "freesound_urls": [
            "https://freesound.org/people/user/sounds/99999/", "https://freesound.org/people/user/sounds/88888/",
            "https://freesound.org/people/user/sounds/77777/"
        ],
        "ratings": ["like", "dislike", "like"]
    }

    try:
        response = requests.post(PROD_API_URL, json=payload, timeout=30)
        response.raise_for_status()
        print("✅ API connectivity test passed!")
        print("Response:", response.json())
    except requests.exceptions.RequestException as e:
        print(f"❌ API connectivity test failed: {e}")


if __name__ == "__main__":
    print("🚀 Testing Feedback API on Production Environment")
    print(f"API URL: {PROD_API_URL}")
    print("-" * 50)

    # Run the main test
    test_feedback_api_prod()

    print("\n" + "=" * 50)

    # Optional: Run connectivity test
    run_connectivity_test = input("\nRun connectivity test without audio file? (y/n): ")
    if run_connectivity_test.lower() == 'y':
        test_without_audio_file()
