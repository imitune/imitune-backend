#!/usr/bin/env python3
"""
Test script to verify rate limiting is working correctly.
"""

import base64
import time

import requests

BASE_URL = "http://localhost:3000"
SEARCH_URL = f"{BASE_URL}/api/search"
FEEDBACK_URL = f"{BASE_URL}/api/feedback"


def print_section(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def test_search_rate_limit():
    """Test search API rate limit (10 requests per minute)"""
    print_section("TEST: Search API Rate Limit (10/minute)")

    # Valid embedding for testing
    embedding = [0.1] * 512

    print("\nSending 12 requests rapidly...")
    print("Expected: First 10 succeed, requests 11-12 get 429 (rate limited)\n")

    for i in range(1, 13):
        try:
            response = requests.post(
                SEARCH_URL, json={"embedding": embedding}, timeout=5
            )

            # Check rate limit headers
            limit = response.headers.get("X-RateLimit-Limit", "N/A")
            remaining = response.headers.get("X-RateLimit-Remaining", "N/A")

            if response.status_code == 429:
                data = response.json()
                print(f"Request {i:2d}: ❌ RATE LIMITED (429)")
                print(f"            Error: {data.get('error')}")
                print(f"            Retry after: {data.get('retryAfter')} seconds")
                print(f"            Limit: {limit}, Remaining: {remaining}")
            elif response.status_code == 500:
                # Pinecone error is OK - it means rate limiting passed
                print(
                    f"Request {i:2d}: ✅ ALLOWED (500 - Pinecone error, validation passed)"
                )
                print(f"            Limit: {limit}, Remaining: {remaining}")
            elif response.status_code == 200:
                print(f"Request {i:2d}: ✅ ALLOWED (200 - Success)")
                print(f"            Limit: {limit}, Remaining: {remaining}")
            else:
                print(f"Request {i:2d}: ⚠️  Unexpected status {response.status_code}")
                print(f"            Response: {response.json()}")

            time.sleep(0.1)  # Small delay to see rate limit counting down

        except Exception as e:
            print(f"Request {i:2d}: ❌ ERROR: {e}")

    print("\n✓ Rate limiting test complete!")
    print("  Expected behavior: First 10 allowed, then 429 errors")


def test_feedback_rate_limit():
    """Test feedback API rate limit (10 submissions per hour)"""
    print_section("TEST: Feedback API Rate Limit (10/hour)")

    print("\nSending 12 feedback submissions rapidly...")
    print("Expected: First 10 succeed, requests 11-12 get 429 (rate limited)\n")

    for i in range(1, 13):
        try:
            # Create small audio data
            audio_bytes = b"\x00" * 1024  # 1KB
            audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

            response = requests.post(
                FEEDBACK_URL,
                json={
                    "audioQuery": f"data:audio/webm;base64,{audio_base64}",
                    "freesound_urls": [None, None, None],
                    "ratings": [None, None, None],
                },
                timeout=10,
            )

            # Check rate limit headers
            limit = response.headers.get("X-RateLimit-Limit", "N/A")
            remaining = response.headers.get("X-RateLimit-Remaining", "N/A")

            if response.status_code == 429:
                data = response.json()
                print(f"Request {i:2d}: ❌ RATE LIMITED (429)")
                print(f"            Error: {data.get('error')}")
                print(f"            Retry after: {data.get('retryAfter')} seconds")
                print(f"            Limit: {limit}, Remaining: {remaining}")
            elif response.status_code == 200:
                print(f"Request {i:2d}: ✅ ALLOWED (200 - Success)")
                print(f"            Limit: {limit}, Remaining: {remaining}")
            else:
                print(f"Request {i:2d}: ⚠️  Status {response.status_code}")
                print(f"            Response: {response.json()}")

            time.sleep(0.1)

        except Exception as e:
            print(f"Request {i:2d}: ❌ ERROR: {e}")

    print("\n✓ Rate limiting test complete!")
    print("  Expected behavior: First 10 allowed, then 429 errors")


def check_rate_limit_headers():
    """Check that rate limit headers are present"""
    print_section("TEST: Rate Limit Headers")

    try:
        response = requests.post(SEARCH_URL, json={"embedding": [0.1] * 512}, timeout=5)

        print("\nRate Limit Headers:")
        print(
            f"  X-RateLimit-Limit: {response.headers.get('X-RateLimit-Limit', 'MISSING')}"
        )
        print(
            f"  X-RateLimit-Remaining: {response.headers.get('X-RateLimit-Remaining', 'MISSING')}"
        )
        print(
            f"  X-RateLimit-Reset: {response.headers.get('X-RateLimit-Reset', 'MISSING')}"
        )

        if "X-RateLimit-Limit" in response.headers:
            print("\n✅ PASS: Rate limit headers are present")
        else:
            print("\n❌ FAIL: Rate limit headers are missing")
            print("   This might mean Upstash is not configured")

    except Exception as e:
        print(f"❌ ERROR: {e}")


def main():
    print("\n" + "🔒" * 30)
    print("RATE LIMITING TEST SUITE")
    print("🔒" * 30)
    print("\nThis will test that rate limiting is working correctly.")
    print("Make sure your Vercel dev server is running with Upstash configured.")
    print("\nServer URL:", BASE_URL)

    input("\nPress ENTER to start tests...")

    try:
        # Test 1: Check headers are present
        check_rate_limit_headers()

        input(
            "\n\nPress ENTER to test search API rate limit (will make 12 requests)..."
        )
        # Test 2: Search rate limiting
        test_search_rate_limit()

        input(
            "\n\nPress ENTER to test feedback API rate limit (will make 12 requests)..."
        )
        # Test 3: Feedback rate limiting
        test_feedback_rate_limit()

    except KeyboardInterrupt:
        print("\n\nTests interrupted by user.")
        return

    print_section("SUMMARY")
    print(
        "\n✅ If you saw 429 errors after the 10th request, rate limiting is working!"
    )
    print("✅ Check your Upstash dashboard to see the rate limit keys stored in Redis")
    print("\nNext steps:")
    print("1. Deploy to production: vercel --prod")
    print("2. Add environment variables to Vercel dashboard")
    print("3. Test again with production URL")
    print("\n" + "=" * 60 + "\n")


if __name__ == "__main__":
    main()
