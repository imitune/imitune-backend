#!/usr/bin/env python3
"""
Test CORS origin validation
"""

import requests

BASE_URL = "http://localhost:3000"
SEARCH_URL = f"{BASE_URL}/api/search"


def print_section(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def test_allowed_origin():
    """Test request from allowed origin (localhost)"""
    print_section("TEST 1: Allowed Origin (localhost:5173)")

    headers = {"Origin": "http://localhost:5173", "Content-Type": "application/json"}

    try:
        response = requests.post(
            SEARCH_URL, json={"embedding": [0.1] * 512}, headers=headers, timeout=5
        )

        cors_header = response.headers.get("Access-Control-Allow-Origin")
        print(f"Status: {response.status_code}")
        print(f"CORS Header: {cors_header}")

        if cors_header == "http://localhost:5173":
            print("✅ PASS: Allowed origin accepted, correct CORS header set")
        else:
            print(
                f"❌ FAIL: Expected CORS header 'http://localhost:5173', got '{cors_header}'"
            )

    except Exception as e:
        print(f"❌ ERROR: {e}")


def test_blocked_origin():
    """Test request from blocked origin"""
    print_section("TEST 2: Blocked Origin (evil-site.com)")

    headers = {"Origin": "https://evil-site.com", "Content-Type": "application/json"}

    try:
        response = requests.post(
            SEARCH_URL, json={"embedding": [0.1] * 512}, headers=headers, timeout=5
        )

        cors_header = response.headers.get("Access-Control-Allow-Origin")
        print(f"Status: {response.status_code}")
        print(f"CORS Header: {cors_header}")
        print(f"Response: {response.json()}")

        if response.status_code == 403:
            print("✅ PASS: Blocked origin rejected with 403")
        elif not cors_header:
            print("✅ PASS: No CORS header set for blocked origin")
        else:
            print("❌ FAIL: Blocked origin should be rejected")

    except Exception as e:
        print(f"❌ ERROR: {e}")


def test_production_origin():
    """Test request from production origin"""
    print_section("TEST 3: Production Origin (thatsoundslike.me)")

    headers = {
        "Origin": "https://thatsoundslike.me",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            SEARCH_URL, json={"embedding": [0.1] * 512}, headers=headers, timeout=5
        )

        cors_header = response.headers.get("Access-Control-Allow-Origin")
        print(f"Status: {response.status_code}")
        print(f"CORS Header: {cors_header}")

        if cors_header == "https://thatsoundslike.me":
            print("✅ PASS: Production origin accepted, correct CORS header set")
        else:
            print(
                f"❌ FAIL: Expected CORS header 'https://thatsoundslike.me', got '{cors_header}'"
            )

    except Exception as e:
        print(f"❌ ERROR: {e}")


def test_no_origin():
    """Test request without Origin header (like curl)"""
    print_section("TEST 4: No Origin Header (curl/Postman)")

    try:
        response = requests.post(SEARCH_URL, json={"embedding": [0.1] * 512}, timeout=5)

        cors_header = response.headers.get("Access-Control-Allow-Origin")
        print(f"Status: {response.status_code}")
        print(f"CORS Header: {cors_header}")

        if response.status_code == 403:
            print("✅ PASS: Requests without origin are blocked")
            print(f"Response: {response.json()}")
        else:
            print("⚠️  Note: Requests without origin header are allowed")
            print("   This is OK for API testing tools like curl/Postman")

    except Exception as e:
        print(f"❌ ERROR: {e}")


def test_preflight():
    """Test CORS preflight (OPTIONS) request"""
    print_section("TEST 5: CORS Preflight (OPTIONS)")

    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
    }

    try:
        response = requests.options(SEARCH_URL, headers=headers, timeout=5)

        print(f"Status: {response.status_code}")
        print(f"CORS Origin: {response.headers.get('Access-Control-Allow-Origin')}")
        print(f"CORS Methods: {response.headers.get('Access-Control-Allow-Methods')}")
        print(f"CORS Headers: {response.headers.get('Access-Control-Allow-Headers')}")

        if response.status_code == 204:
            print("✅ PASS: Preflight request handled correctly")
        else:
            print(f"❌ FAIL: Expected 204, got {response.status_code}")

    except Exception as e:
        print(f"❌ ERROR: {e}")


def main():
    print("\n" + "🌐" * 30)
    print("CORS ORIGIN VALIDATION TEST SUITE")
    print("🌐" * 30)
    print("\nThis will test that only allowed origins can access your API.")
    print("Make sure your Vercel dev server is running.")
    print("\nServer URL:", BASE_URL)

    input("\nPress ENTER to start tests...")

    try:
        test_allowed_origin()
        test_blocked_origin()
        test_production_origin()
        test_no_origin()
        test_preflight()

    except KeyboardInterrupt:
        print("\n\nTests interrupted by user.")
        return

    print_section("SUMMARY")
    print("\n✅ Allowed origins (localhost, thatsoundslike.me) should be accepted")
    print("❌ Blocked origins (evil-site.com) should be rejected with 403")
    print("✅ Preflight requests should return 204")
    print("\nAllowed origins are configured in: api/utils/cors.js")
    print("To add more origins, edit the ALLOWED_ORIGINS array")
    print("\n" + "=" * 60 + "\n")


if __name__ == "__main__":
    main()
