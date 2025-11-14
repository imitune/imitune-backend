#!/usr/bin/env python3
"""
Simple validation test that only tests the validation logic,
without requiring actual Pinecone or Blob storage credentials.
"""

import base64
import json

import requests

BASE_URL = "http://localhost:3000"
SEARCH_URL = f"{BASE_URL}/api/search"
FEEDBACK_URL = f"{BASE_URL}/api/feedback"

print("\n" + "=" * 60)
print("  QUICK VALIDATION TEST (No Credentials Required)")
print("=" * 60)

# Test 1: Invalid embedding size
print("\n🔍 Test 1: Embedding with invalid size")
print("Sending embedding with only 5 values (should reject)...")
try:
    response = requests.post(
        SEARCH_URL, json={"embedding": [0.1, 0.2, 0.3, 0.4, 0.5]}, timeout=5
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    if response.status_code == 400:
        print("✅ PASS: Invalid size correctly rejected!")
    else:
        print("❌ FAIL: Should have been rejected")
except Exception as e:
    print(f"Error: {e}")

# Test 2: Valid embedding size
print("\n🔍 Test 2: Embedding with valid size")
print("Sending embedding with 512 values (should validate, may fail on Pinecone)...")
try:
    response = requests.post(SEARCH_URL, json={"embedding": [0.1] * 512}, timeout=5)
    print(f"Status: {response.status_code}")
    if response.status_code == 400:
        error_msg = response.json().get("error", "")
        if "Invalid embedding size" in error_msg:
            print("❌ FAIL: Valid size was rejected")
        else:
            print(f"Response: {json.dumps(response.json(), indent=2)}")
            print("✅ PASS: Validation passed (Pinecone error is OK)")
    elif response.status_code == 500:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        print("✅ PASS: Validation passed (Pinecone credentials needed)")
    else:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        print("✅ PASS: Valid embedding accepted!")
except Exception as e:
    print(f"Error: {e}")

# Test 3: Invalid MIME type
print("\n🔍 Test 3: Audio with invalid MIME type")
print("Sending video/mp4 instead of audio (should reject)...")
try:
    audio_bytes = b"\x00" * 1024
    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
    response = requests.post(
        FEEDBACK_URL,
        json={
            "audioQuery": f"data:video/mp4;base64,{audio_base64}",
            "freesound_urls": [None, None, None],
            "ratings": [None, None, None],
        },
        timeout=5,
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    if (
        response.status_code == 400
        and "Unsupported audio format" in response.json().get("error", "")
    ):
        print("✅ PASS: Invalid MIME type correctly rejected!")
    else:
        print("❌ FAIL: Should have been rejected")
except Exception as e:
    print(f"Error: {e}")

# Test 4: Oversized audio
print("\n🔍 Test 4: Oversized audio file")
print("Sending 12MB audio file (should reject)...")
try:
    # Create 12MB of data
    size_bytes = 12 * 1024 * 1024
    audio_bytes = b"\x00" * size_bytes
    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
    print(f"Generated {len(audio_base64) / (1024 * 1024):.2f}MB base64 data...")

    response = requests.post(
        FEEDBACK_URL,
        json={
            "audioQuery": f"data:audio/webm;base64,{audio_base64}",
            "freesound_urls": [None, None, None],
            "ratings": [None, None, None],
        },
        timeout=30,
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    if response.status_code == 413:
        print("✅ PASS: Oversized file correctly rejected!")
    else:
        print("❌ FAIL: Should have been rejected with 413")
except Exception as e:
    print(f"Error: {e}")

# Test 5: Valid small audio
print("\n🔍 Test 5: Valid small audio file")
print("Sending 100KB audio file (should validate)...")
try:
    size_bytes = 100 * 1024
    audio_bytes = b"\x00" * size_bytes
    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

    response = requests.post(
        FEEDBACK_URL,
        json={
            "audioQuery": f"data:audio/webm;base64,{audio_base64}",
            "freesound_urls": [None, None, None],
            "ratings": [None, None, None],
        },
        timeout=30,
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 400:
        error = response.json().get("error", "")
        if "too large" in error.lower():
            print("❌ FAIL: Valid size was rejected")
        else:
            print(f"Response: {json.dumps(response.json(), indent=2)}")
            print("✅ PASS: Size validation passed (other error is OK)")
    elif response.status_code == 500:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        print("✅ PASS: Size validation passed (Blob credentials needed)")
    else:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        print("✅ PASS: Valid audio accepted!")
except Exception as e:
    print(f"Error: {e}")

print("\n" + "=" * 60)
print("  TEST SUMMARY")
print("=" * 60)
print("\nKey things to verify:")
print("✅ Invalid embedding sizes are rejected (Test 1)")
print("✅ Invalid MIME types are rejected (Test 3)")
print("✅ Oversized files are rejected (Test 4)")
print("✅ Valid inputs pass validation (Tests 2, 5)")
print("\nNote: Pinecone/Blob errors AFTER validation are expected!")
print("=" * 60 + "\n")
