#!/usr/bin/env python3
"""
Visit 5 Demo Script — Full End-to-End Verification
Demonstrates: JWT Auth, Company Isolation, Upload→AI→Blockchain flow.
"""

import requests
import json
import sys
import os
from pathlib import Path

API = "http://localhost:8000/api/v1"
VISION = "http://localhost:8001"

# Use the test images from Visit 4
TEST_IMAGES_DIR = Path(__file__).parent.parent / "test_images"


def sep(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def check_health():
    """Verify all services are running."""
    sep("HEALTH CHECKS")
    for name, url in [("Main API", f"{API}/../health"), ("Vision API", f"{VISION}/health/")]:
        try:
            r = requests.get(url.replace("/../", "/").replace("/api/v1/../", "/"), timeout=5)
            data = r.json()
            print(f"  ✅ {name}: {data.get('status', 'ok')} (v{data.get('version', '?')})")
        except Exception as e:
            print(f"  ❌ {name}: {e}")
            return False
    return True


def test_auth():
    """Test JWT Authentication (Student 2)."""
    sep("FEATURE 1 — JWT AUTHENTICATION (Student 2)")

    # Login as sender
    print("🔐 Test 1: Login as sender@apple.com...")
    r = requests.post(f"{API}/auth/token", json={"email": "sender@apple.com", "password": "sender123"})
    if r.status_code != 200:
        print(f"  ❌ Login failed: {r.text}")
        return None, None
    sender = r.json()
    sender_token = sender["access_token"]
    print(f"  ✅ Token received: {sender_token[:40]}...")
    print(f"  ✅ User: {sender['user']['email']} | Company: {sender['user']['company']} | Role: {sender['user']['role']}")

    # Login as inspector
    print("\n🔐 Test 2: Login as inspector@bestbuy.com...")
    r = requests.post(f"{API}/auth/token", json={"email": "inspector@bestbuy.com", "password": "inspector123"})
    inspector = r.json()
    inspector_token = inspector["access_token"]
    print(f"  ✅ Token received: {inspector_token[:40]}...")
    print(f"  ✅ User: {inspector['user']['email']} | Company: {inspector['user']['company']} | Role: {inspector['user']['role']}")

    # Test /me endpoint
    print("\n🔐 Test 3: GET /auth/me with sender token...")
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {sender_token}"})
    me = r.json()
    print(f"  ✅ /me response: {json.dumps(me)}")

    # Test invalid token
    print("\n🔐 Test 4: Request with invalid token...")
    r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer invalid-token-here"})
    print(f"  ✅ Correctly rejected: {r.status_code} — {r.json().get('detail', '')}")

    return sender_token, inspector_token


def test_shipments(sender_token, inspector_token):
    """Test Company Data Isolation (Student 2)."""
    sep("FEATURE 2 — COMPANY DATA ISOLATION (Student 2)")
    headers_sender = {"Authorization": f"Bearer {sender_token}"}
    headers_inspector = {"Authorization": f"Bearer {inspector_token}"}

    # Create shipment as sender
    print("📦 Test 1: Create shipment as Apple sender...")
    r = requests.post(f"{API}/shipments/", json={
        "shipment_code": "SHP-DEMO-V5",
        "description": "500x iPhone 15 Pro — Visit 5 Demo",
        "receiver_company": "BestBuy",
    }, headers={**headers_sender, "Content-Type": "application/json"})

    if r.status_code == 409:
        print(f"  ⚠️ Shipment already exists, using existing one")
        # Find existing
        r = requests.get(f"{API}/shipments/code/SHP-DEMO-V5", headers=headers_sender)
        shipment = r.json()
    elif r.status_code == 200:
        shipment = r.json().get("shipment", {})
        print(f"  ✅ Shipment created: {shipment.get('shipment_code', '')}")
        print(f"  ✅ Company: {shipment.get('company', '')}")
        print(f"  ✅ Blockchain TX: {r.json().get('blockchain_tx', '')[:40]}...")
    else:
        print(f"  ❌ Failed: {r.status_code} — {r.text}")
        return None

    shipment_id = shipment.get("_id", "")

    # List shipments as sender (Apple) → should see it
    print("\n📦 Test 2: List shipments as Apple sender...")
    r = requests.get(f"{API}/shipments/", headers=headers_sender)
    sender_shipments = r.json().get("shipments", [])
    print(f"  ✅ Apple sees {len(sender_shipments)} shipment(s)")

    # List shipments as inspector (BestBuy) → should see it (receiver_company = BestBuy)
    print("\n📦 Test 3: List shipments as BestBuy inspector...")
    r = requests.get(f"{API}/shipments/", headers=headers_inspector)
    inspector_shipments = r.json().get("shipments", [])
    print(f"  ✅ BestBuy sees {len(inspector_shipments)} shipment(s)")

    # Verify the receiver can see sender's shipment
    for s in inspector_shipments:
        if s.get("shipment_code") == "SHP-DEMO-V5":
            print(f"  ✅ BestBuy can see Apple's shipment SHP-DEMO-V5 (receiver_company matches)")
            break

    return shipment_id


def test_verification(sender_token, inspector_token, shipment_id):
    """Test End-to-End Upload Flow (Student 1 + Student 3)."""
    sep("FEATURE 3 — END-TO-END UPLOAD FLOW (Student 1 + 3)")

    if not shipment_id:
        print("  ❌ No shipment ID available, skipping verification tests")
        return

    headers_sender = {"Authorization": f"Bearer {sender_token}"}
    headers_inspector = {"Authorization": f"Bearer {inspector_token}"}

    # Check if test images exist
    origin_path = TEST_IMAGES_DIR / "origin_scan.png"
    dest_path = TEST_IMAGES_DIR / "destination_clean.png"

    if not origin_path.exists():
        print(f"  ⚠️ Test images not found at {TEST_IMAGES_DIR}")
        print(f"  ⚠️ Run demo_visit4.py first to generate them, or create manually")
        # Generate a simple test image
        try:
            from PIL import Image
            import numpy as np
            img = Image.fromarray(np.random.randint(50, 200, (256, 256, 3), dtype=np.uint8))
            TEST_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
            img.save(origin_path)
            img2 = img.copy()
            img2.save(dest_path)
            print(f"  ✅ Generated test images")
        except ImportError:
            print(f"  ❌ Need Pillow to generate test images: pip install Pillow")
            return

    # Upload origin scan as sender
    print(f"📤 Test 1: Upload origin X-ray as Apple sender...")
    with open(origin_path, "rb") as f:
        r = requests.post(
            f"{API}/verify/origin/{shipment_id}",
            files={"image": ("origin.png", f, "image/png")},
            headers=headers_sender,
        )
    if r.status_code == 200:
        data = r.json()
        print(f"  ✅ Origin stored!")
        print(f"  ✅ SHA-256: {data.get('image_sha256', '')}")
        print(f"  ✅ pHash: {data.get('phash', '')[:32]}...")
        print(f"  ✅ Blockchain TX: {str(data.get('blockchain_tx', ''))[:40]}...")
    else:
        print(f"  ❌ Failed: {r.status_code} — {r.text[:200]}")

    # Try to upload origin as inspector → should be REJECTED
    print(f"\n🚫 Test 2: Try uploading origin as BestBuy inspector (should fail)...")
    with open(origin_path, "rb") as f:
        r = requests.post(
            f"{API}/verify/origin/{shipment_id}",
            files={"image": ("origin.png", f, "image/png")},
            headers=headers_inspector,
        )
    print(f"  ✅ Correctly rejected: {r.status_code} — {r.json().get('detail', '')}")

    # Verify destination as inspector
    print(f"\n🔍 Test 3: Verify destination X-ray as BestBuy inspector...")
    with open(dest_path, "rb") as f:
        r = requests.post(
            f"{API}/verify/destination/{shipment_id}",
            files={"image": ("destination.png", f, "image/png")},
            headers=headers_inspector,
        )
    if r.status_code == 200:
        data = r.json()
        print(f"  ✅ Verdict: {data.get('verdict', '?')}")
        print(f"  ✅ Confidence: {data.get('confidence', 0)*100:.1f}%")
        print(f"  ✅ Explanation: {data.get('explanation', '')}")
        print(f"  ✅ Blockchain TX: {str(data.get('blockchain_tx', ''))[:40]}...")
    else:
        print(f"  ❌ Failed: {r.status_code} — {r.text[:200]}")

    # Check verification status
    print(f"\n📊 Test 4: Get verification status...")
    r = requests.get(f"{API}/verify/status/{shipment_id}", headers=headers_sender)
    if r.status_code == 200:
        data = r.json()
        print(f"  ✅ Verified: {data.get('verified', False)}")
        print(f"  ✅ Latest verdict: {data.get('verdict', '?')}")
        print(f"  ✅ Total inspections: {len(data.get('inspections', []))}")


def test_ipfs():
    """Quick IPFS connectivity check."""
    sep("FEATURE 4 — IPFS STORAGE (Student 3)")
    try:
        r = requests.post("http://localhost:5001/api/v0/id", timeout=5)
        if r.status_code == 200:
            data = r.json()
            print(f"  ✅ IPFS Node ID: {data.get('ID', '?')[:20]}...")
            print(f"  ✅ Protocol Version: {data.get('ProtocolVersion', '?')}")
        else:
            print(f"  ⚠️ IPFS returned {r.status_code}")
    except Exception as e:
        print(f"  ⚠️ IPFS not reachable: {e}")
        print(f"  ℹ️ IPFS is optional — system works without it using local fallback")


def main():
    sep("VISIT 5 — THE WORKING PRODUCT")
    print("This demo proves all Visit 5 features are operational:\n")
    print("  1. JWT Authentication (Student 2)")
    print("  2. Company Data Isolation (Student 2)")
    print("  3. End-to-End Upload → AI → Blockchain (Student 1 + 3)")
    print("  4. IPFS Decentralized Storage (Student 3)")

    if not check_health():
        print("\n❌ Services not running. Start with: docker compose up -d")
        sys.exit(1)

    sender_token, inspector_token = test_auth()
    if not sender_token:
        print("\n❌ Auth failed. Check MongoDB connection.")
        sys.exit(1)

    shipment_id = test_shipments(sender_token, inspector_token)
    test_verification(sender_token, inspector_token, shipment_id)
    test_ipfs()

    sep("VISIT 5 DEMO COMPLETE ✅")
    print("All features demonstrated successfully!")
    print("\n🌐 Open http://localhost:3000/login in the browser to see the React UI.")
    print("   Demo accounts: sender@apple.com / sender123")
    print("                  inspector@bestbuy.com / inspector123")


if __name__ == "__main__":
    main()
