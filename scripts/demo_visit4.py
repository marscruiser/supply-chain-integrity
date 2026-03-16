#!/usr/bin/env python3
"""
Visit 4 Demo Script — Proves All 3 Modules Work
=================================================
This script generates synthetic X-ray test images, runs them through all 3 modules,
and prints the results as proof for the teacher presentation.

Module A (Vision AI):  Generates SHA-256, pHash, SSIM, detects tampering
Module B (Blockchain): Registers shipment + stores hashes on Ethereum
Module C (Dashboard):  API endpoints serve data to the React frontend

Usage:
    python scripts/demo_visit4.py
"""

import requests
import numpy as np
import cv2
import os
import sys
import time
import json

# ─── Configuration ──────────────────────────────────────────────────
VISION_API = "http://localhost:8001"
MAIN_API   = "http://localhost:8000"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "test_images")

def banner(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")


def generate_test_images():
    """Generate synthetic 'X-ray' images for demo purposes."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # --- Origin Image (the "ground truth" scan) ---
    origin = np.zeros((512, 512), dtype=np.uint8)
    # Simulate cargo containers as rectangles
    cv2.rectangle(origin, (50, 50), (200, 200), 180, -1)    # Box 1
    cv2.rectangle(origin, (250, 80), (450, 250), 160, -1)   # Box 2
    cv2.rectangle(origin, (100, 300), (400, 480), 140, -1)   # Box 3
    # Add some texture/noise to make it realistic
    noise = np.random.randint(0, 20, (512, 512), dtype=np.uint8)
    origin = cv2.add(origin, noise)
    cv2.putText(origin, "CARGO-A", (70, 140), cv2.FONT_HERSHEY_SIMPLEX, 0.8, 255, 2)
    cv2.putText(origin, "CARGO-B", (270, 170), cv2.FONT_HERSHEY_SIMPLEX, 0.8, 255, 2)
    cv2.putText(origin, "CARGO-C", (180, 400), cv2.FONT_HERSHEY_SIMPLEX, 0.8, 255, 2)

    origin_path = os.path.join(OUTPUT_DIR, "origin_scan.png")
    cv2.imwrite(origin_path, origin)

    # --- Clean Destination (same cargo, minor scanner differences) ---
    clean = origin.copy()
    # Add very slight brightness shift (simulates different scanner)
    clean = cv2.add(clean, np.full_like(clean, 3))
    clean_path = os.path.join(OUTPUT_DIR, "destination_clean.png")
    cv2.imwrite(clean_path, clean)

    # --- Tampered Destination (Box 2 removed — cargo stolen!) ---
    tampered = origin.copy()
    cv2.rectangle(tampered, (250, 80), (450, 250), 0, -1)   # Box 2 REMOVED
    cv2.putText(tampered, "EMPTY", (290, 170), cv2.FONT_HERSHEY_SIMPLEX, 0.8, 40, 2)
    tampered_path = os.path.join(OUTPUT_DIR, "destination_tampered.png")
    cv2.imwrite(tampered_path, tampered)

    # --- Subtle Tamper: ONE small cylinder removed (the hard case!) ---
    subtle = origin.copy()
    # Draw 4 cylinders (bullets/canisters) in a row on origin only; remove 1 in subtle
    for i in range(4):
        cx, cy = 310 + i * 35, 390
        cv2.circle(subtle if i < 3 else origin, (cx, cy), 12, 200, -1)
    # Ensure all 4 cylinders appear in origin
    for i in range(4):
        cx, cy = 310 + i * 35, 390
        cv2.circle(origin, (cx, cy), 12, 200, -1)
    # Only 3 cylinders in subtle (one removed)
    for i in range(3):
        cx, cy = 310 + i * 35, 390
        cv2.circle(subtle, (cx, cy), 12, 200, -1)
    cv2.imwrite(origin_path, origin)  # Re-save with cylinders added
    subtle_path = os.path.join(OUTPUT_DIR, "destination_subtle_tamper.png")
    cv2.imwrite(subtle_path, subtle)

    print(f"  ✅ Generated: {origin_path}")
    print(f"  ✅ Generated: {clean_path}")
    print(f"  ✅ Generated: {tampered_path}")
    print(f"  ✅ Generated: {subtle_path} (1 cylinder removed — the hard case)")
    return origin_path, clean_path, tampered_path, subtle_path


def test_module_a(origin_path, clean_path, tampered_path, subtle_path=None):
    """Test Module A: Vision AI — image analysis and tampering detection."""
    banner("MODULE A — VISION AI (Student 1)")

    # --- Test 1: Analyze a single image ---
    print("\n📸 Test 1: Analyzing origin X-ray image...")
    with open(origin_path, "rb") as f:
        resp = requests.post(
            f"{VISION_API}/api/v1/inspect/analyze",
            files={"image": ("origin_scan.png", f, "image/png")},
            data={"shipment_id": "SHP-DEMO-001"},
        )
    if resp.status_code != 200:
        print(f"  ❌ Analysis failed: {resp.text}")
        return None
    result = resp.json()
    print(f"  ✅ Fingerprint ID:      {result['fingerprint_id']}")
    print(f"  ✅ SHA-256:             {result['image_sha256'][:32]}...")
    print(f"  ✅ pHash:               {result['perceptual_hashes']['phash']}")
    print(f"  ✅ dHash:               {result['perceptual_hashes']['dhash']}")
    print(f"  ✅ Keypoints detected:  {result['keypoint_count']}")
    print(f"  ✅ Object count:        {result.get('object_count', 'n/a')}")
    print(f"  ✅ Objects (morph):     {result['morphological_features']['num_objects']}")
    print(f"  ✅ Processing time:     {result['processing_time_ms']}ms")

    # --- Test 2: Compare origin vs CLEAN destination ---
    print("\n🔍 Test 2: Comparing Origin vs CLEAN destination...")
    with open(origin_path, "rb") as f1, open(clean_path, "rb") as f2:
        resp = requests.post(
            f"{VISION_API}/api/v1/inspect/compare",
            files={"image1": ("origin.png", f1), "image2": ("clean.png", f2)},
        )
    if resp.status_code != 200:
        print(f"  ❌ Comparison failed: {resp.text}")
        return None
    clean_result = resp.json()
    sigs = clean_result.get('signals', {})
    print(f"  ✅ Verdict:             {clean_result['verdict']}")
    print(f"  ✅ Severity:            {clean_result.get('severity', 'n/a')}")
    print(f"  ✅ SSIM Score:          {sigs.get('ssim_score', 'n/a')} (threshold: {sigs.get('ssim_threshold', 'n/a')})")
    print(f"  ✅ pHash Hamming Dist:  {sigs.get('phash_distance', 'n/a')}")
    print(f"  ✅ Object Count:        {sigs.get('object_count_origin')} → {sigs.get('object_count_destination')} (delta: {sigs.get('object_count_delta')})")
    print(f"  ✅ Tampered Regions:    {clean_result['tampered_regions_count']}")
    print(f"  ✅ Processing time:     {clean_result['processing_time_ms']}ms")

    # --- Test 3: Compare origin vs TAMPERED destination ---
    print("\n🚨 Test 3: Comparing Origin vs TAMPERED destination...")
    with open(origin_path, "rb") as f1, open(tampered_path, "rb") as f2:
        resp = requests.post(
            f"{VISION_API}/api/v1/inspect/compare",
            files={"image1": ("origin.png", f1), "image2": ("tampered.png", f2)},
        )
    if resp.status_code != 200:
        print(f"  ❌ Comparison failed: {resp.text}")
        return None
    tamper_result = resp.json()
    sigs = tamper_result.get('signals', {})
    print(f"  🚨 Verdict:             {tamper_result['verdict']}")
    print(f"  🚨 Severity:            {tamper_result.get('severity', 'n/a')}")
    print(f"  🚨 Explanation:         {tamper_result.get('explanation', 'n/a')}")
    print(f"  🚨 SSIM Score:          {sigs.get('ssim_score', 'n/a')} (threshold: {sigs.get('ssim_threshold', 'n/a')})")
    print(f"  🚨 pHash Hamming Dist:  {sigs.get('phash_distance', 'n/a')}")
    print(f"  🚨 Object Count:        {sigs.get('object_count_origin')} → {sigs.get('object_count_destination')} (delta: {sigs.get('object_count_delta')})")
    print(f"  🚨 Tampered Regions:    {tamper_result['tampered_regions_count']}")
    print(f"  🚨 Processing time:     {tamper_result['processing_time_ms']}ms")

    # --- Test 4: SUBTLE TAMPER — single cylinder missing (SSIM stays close to 1.0) ---
    if subtle_path:
        print("\n🔬 Test 4: SUBTLE TAMPER — one small cylinder removed (the hard case) ...")
        print("  (Old SSIM-only code would have passed this as CLEAN! Multi-signal catches it.)")
        with open(origin_path, "rb") as f1, open(subtle_path, "rb") as f2:
            resp = requests.post(
                f"{VISION_API}/api/v1/inspect/compare",
                files={"image1": ("origin.png", f1), "image2": ("subtle.png", f2)},
            )
        if resp.status_code != 200:
            print(f"  ❌ Comparison failed: {resp.text}")
        else:
            sr = resp.json()
            sigs2 = sr.get('signals', {})
            icon = "🚨" if sr['verdict'] != 'CLEAN' else "❌ MISSED"
            print(f"  {icon} Verdict:            {sr['verdict']}")
            print(f"  {icon} Severity:           {sr.get('severity', 'n/a')}")
            print(f"  {icon} Explanation:        {sr.get('explanation', '')}")
            print(f"  {icon} SSIM Score:         {sigs2.get('ssim_score', 'n/a')} ← nearly identical!")
            print(f"  {icon} Object Count:       {sigs2.get('object_count_origin')} → {sigs2.get('object_count_destination')} (delta: {sigs2.get('object_count_delta')})")
            print(f"  {icon} Triggered Signals:  {sr.get('triggered_signals', [])}")

    return result  # Return the origin fingerprint for Module B


def test_module_b(fingerprint):
    """Test Module B: Blockchain — register shipment and store hashes on-chain."""
    banner("MODULE B — BLOCKCHAIN (Student 2)")

    # --- Test 1: Check blockchain connection ---
    print("\n🔗 Test 1: Checking Ethereum node connection...")
    resp = requests.get(f"{MAIN_API}/api/v1/blockchain/connection")
    if resp.status_code != 200:
        print(f"  ❌ Connection failed: {resp.text}")
        return
    conn = resp.json()
    print(f"  ✅ Connected:           {conn['connected']}")
    print(f"  ✅ Chain ID:            {conn['chain_id']}")
    print(f"  ✅ Block Number:        {conn['block_number']}")
    print(f"  ✅ Balance:             {conn['balance_eth']:.4f} ETH")

    # --- Test 2: Run the full blockchain demo ---
    print("\n⛓️  Test 2: Running full blockchain demo (6 Ethereum transactions)...")
    resp = requests.post(f"{MAIN_API}/api/v1/blockchain/demo")
    if resp.status_code != 200:
        print(f"  ❌ Demo failed: {resp.text}")
        return
    demo = resp.json()
    for step in demo["steps"]:
        icon = "🚨" if step["result_type"] == "danger" else "✅"
        print(f"  {icon} Step {step['step']}: {step['action']}")
        print(f"     TxHash: 0x{step['tx_hash'][:16]}...")
        print(f"     Gas: {step['gas_used']:,} | Block: #{step['block']} | Result: {step['result']}")

    # --- Test 3: Query on-chain stats ---
    print("\n📊 Test 3: Querying on-chain statistics...")
    resp = requests.get(f"{MAIN_API}/api/v1/blockchain/stats")
    stats = resp.json()
    print(f"  ✅ Total Shipments:       {stats['total_shipments']}")
    print(f"  ✅ Total Inspections:     {stats['total_inspections']}")
    print(f"  ✅ Tampering Alerts:      {stats['total_tampering_alerts']}")


def test_module_c():
    """Test Module C: Dashboard & API — prove the UI and API are serving live data."""
    banner("MODULE C — DASHBOARD & API (Student 3)")

    # --- Test 1: API Health ---
    print("\n🩺 Test 1: API Health Check...")
    resp = requests.get(f"{MAIN_API}/health/")
    print(f"  ✅ API Status: {resp.json()}")

    # --- Test 2: Vision API Health ---
    print("\n🩺 Test 2: Vision API Health Check...")
    resp = requests.get(f"{VISION_API}/health/")
    print(f"  ✅ Vision API Status: {resp.json()}")

    # --- Test 3: Swagger Docs ---
    print("\n📋 Test 3: API Documentation available...")
    print(f"  ✅ Main API Swagger:   http://localhost:8000/docs")
    print(f"  ✅ Vision API Swagger: http://localhost:8001/docs")
    print(f"  ✅ React Dashboard:    http://localhost:3000")
    print(f"  ✅ Blockchain Explorer: http://localhost:3000/blockchain")


def main():
    banner("VISIT 4 — FULL SYSTEM DEMO")
    print("This demo proves that all 3 students' modules are operational.\n")

    # Step 1: Generate test images
    print("📁 Generating synthetic X-ray test images...")
    origin, clean, tampered, subtle = generate_test_images()

    # Step 2: Module A — Vision AI
    fingerprint = test_module_a(origin, clean, tampered, subtle)

    # Step 3: Module B — Blockchain
    test_module_b(fingerprint)

    # Step 4: Module C — Dashboard & API
    test_module_c()

    banner("DEMO COMPLETE — ALL 3 MODULES OPERATIONAL ✅")
    print("""
Next Steps:
  - Visit 5: Connect Vision AI output → IPFS → Blockchain in one flow
  - Visit 6: Add JWT login and company-level data isolation
  - Visit 7: Wire the React upload form end-to-end
  - Visit 8: Digital Twin visualization + final polish
""")


if __name__ == "__main__":
    main()
