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

    # 3. Prepare the test payload
    payload = {
        "audioQuery": audio_base64,
        "freesound_url": "https://freesound.org/people/user/sounds/12345/",
        "ratings": {
            "result_1_id": 5,
            "result_2_id": 4,
            "result_3_id": 1
        }
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

    except requests.exceptions.RequestException as e:
        print(f"\n❌ An error occurred while communicating with the server:")
        print(e)
        if e.response:
            print("Raw server error response:", e.response.text)


if __name__ == "__main__":
    test_feedback_api()
# ```

# #### 3단계: 테스트 실행하기

# 1.  **라이브러리 설치:** `package.json` 파일이 변경되었으므로, 터미널에서 `npm install`을 다시 실행하여 `@vercel/blob`과 `uuid` 라이브러리를 설치합니다.
# 2.  **서버 실행:** 하나의 터미널 창에서 `vercel dev`를 실행하여 로컬 서버를 켭니다.
# 3.  **테스트 실행:** **별도의 새 터미널 창**을 열고, `imitune-backend` 폴더에서 아래 명령어를 실행하여 피드백 API 테스트를 시작하세요!
#     ```bash
#     python feedback_test.py
