"""
Supply Chain Integrity — Blockchain Demo Script
Demonstrates the complete flow:
  1. Register a shipment on the blockchain
  2. Store an origin inspection (fingerprint hash)
  3. Verify at destination (CLEAN scenario)
  4. Verify at destination (TAMPERED scenario)

Run: python3 scripts/demo_blockchain.py
"""

import json
import os
import hashlib
from web3 import Web3

# ─── Configuration ────────────────────────────────────────────────────────────
RPC_URL = os.getenv("ETH_RPC_URL", "http://127.0.0.1:8545")
PRIVATE_KEY = os.getenv("ETH_PRIVATE_KEY", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")  # Hardhat Account #0

# Load deployed addresses
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ADDRESSES_PATH = os.path.join(SCRIPT_DIR, "..", "module_b_blockchain", "deployments", "localhost", "addresses.json")
ABI_PATH = os.path.join(SCRIPT_DIR, "..", "module_b_blockchain", "artifacts", "contracts", "SupplyChainIntegrity.sol", "SupplyChainIntegrity.json")

def load_contract(w3, addresses_path, abi_path, private_key):
    """Load deployed contract with ABI and signer."""
    with open(addresses_path) as f:
        addresses = json.load(f)
    with open(abi_path) as f:
        artifact = json.load(f)

    contract_addr = addresses["contracts"]["SupplyChainIntegrity"]
    contract = w3.eth.contract(address=contract_addr, abi=artifact["abi"])
    account = w3.eth.account.from_key(private_key)
    return contract, account

def send_tx(w3, contract, func, account):
    """Build, sign, and send a transaction."""
    tx = func.build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 3000000,
        "gasPrice": w3.eth.gas_price,
    })
    signed = w3.eth.account.sign_transaction(tx, account.key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return receipt

def main():
    print("═" * 60)
    print("  Supply Chain Integrity — Blockchain Interaction Demo")
    print("═" * 60)

    # Connect
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    assert w3.is_connected(), "Cannot connect to Ethereum node!"
    print(f"\n✅ Connected to Ethereum node: {RPC_URL}")
    print(f"   Chain ID: {w3.eth.chain_id}")
    print(f"   Latest Block: #{w3.eth.block_number}")

    contract, account = load_contract(w3, ADDRESSES_PATH, ABI_PATH, PRIVATE_KEY)
    print(f"   Deployer: {account.address}")
    balance = w3.eth.get_balance(account.address)
    print(f"   Balance: {w3.from_wei(balance, 'ether')} ETH")
    print(f"   Contract: {contract.address}")

    # ── Step 1: Register a Shipment ───────────────────────────────────────────
    print("\n" + "─" * 60)
    print("Step 1: Registering a new shipment...")
    receipt = send_tx(w3, contract, contract.functions.registerShipment("SHP-2026-001"), account)
    print(f"   ✅ Shipment registered! TxHash: {receipt.transactionHash.hex()}")
    print(f"   Gas Used: {receipt.gasUsed}")
    print(f"   Block: #{receipt.blockNumber}")

    # Read back the shipment
    shipment = contract.functions.getShipment(1).call()
    status_names = ["REGISTERED","ORIGIN_INSPECTED","IN_TRANSIT","DEST_VERIFIED","TAMPERED","DISPUTED"]
    print(f"   Shipment Code: {shipment[1]}")
    print(f"   Status: {status_names[shipment[4]]}")
    print(f"   Originator: {shipment[2]}")

    # ── Step 2: Store Origin Inspection ───────────────────────────────────────
    print("\n" + "─" * 60)
    print("Step 2: Storing origin inspection (ground truth fingerprint)...")

    # Simulate a SHA-256 hash of an X-ray image
    origin_image_data = b"simulated-xray-cargo-image-data-clean"
    origin_hash = hashlib.sha256(origin_image_data).digest()
    origin_phash = "a1b2c3d4e5f60718"  # Simulated perceptual hash
    origin_cid = "QmSimulatedIPFSCIDforOriginXrayImage12345"

    receipt = send_tx(w3, contract,
        contract.functions.storeOriginInspection(
            1,                  # shipmentId
            origin_hash,        # imageHash (bytes32)
            origin_phash,       # pHash string
            origin_cid,         # IPFS CID
            10000               # SSIM score: 1.0000 (perfect self-match)
        ), account)

    print(f"   ✅ Origin inspection stored! TxHash: {receipt.transactionHash.hex()}")
    print(f"   Image SHA-256: {origin_hash.hex()}")
    print(f"   Perceptual Hash: {origin_phash}")
    print(f"   IPFS CID: {origin_cid}")
    print(f"   Gas Used: {receipt.gasUsed}")

    # Verify shipment status changed
    shipment = contract.functions.getShipment(1).call()
    print(f"   Shipment Status: {status_names[shipment[4]]}")

    # ── Step 3: Destination Verification — CLEAN ──────────────────────────────
    print("\n" + "─" * 60)
    print("Step 3: Verifying at destination (CLEAN scenario)...")
    print("   Cargo arrives untampered — same image, same hash.")

    dest_hash_clean = origin_hash  # Same image = same hash
    dest_phash_clean = origin_phash  # Same perceptual hash
    dest_cid_clean = "QmSimulatedIPFSCIDforDestCleanScan99999"

    receipt = send_tx(w3, contract,
        contract.functions.verifyDestinationInspection(
            1,                    # shipmentId
            dest_hash_clean,      # newImageHash
            dest_phash_clean,     # newPHash
            dest_cid_clean,       # ipfsCID
            9800,                 # SSIM: 0.9800 (very high similarity)
            2,                    # Hamming distance: 2 (nearly identical)
            "Cargo intact, no anomalies detected."
        ), account)

    print(f"   ✅ Destination verified! TxHash: {receipt.transactionHash.hex()}")

    # Read the inspection record
    record = contract.functions.getInspectionRecord(2).call()
    verdict_names = ["CLEAN", "SUSPICIOUS", "TAMPERED"]
    print(f"   Verdict: {verdict_names[record[8]]} ✅")
    print(f"   SSIM Score: {record[6] / 10000}")
    print(f"   Hamming Distance: {record[7]}")
    print(f"   Gas Used: {receipt.gasUsed}")

    shipment = contract.functions.getShipment(1).call()
    print(f"   Shipment Status: {status_names[shipment[4]]}")

    # ── Step 4: Register another shipment for TAMPERED demo ───────────────────
    print("\n" + "─" * 60)
    print("Step 4: Demonstrating TAMPERED detection...")
    print("   Registering a second shipment for tampering demo...")

    send_tx(w3, contract, contract.functions.registerShipment("SHP-2026-002"), account)

    # Store origin for shipment #2
    origin_hash_2 = hashlib.sha256(b"clean-xray-shipment-2").digest()
    send_tx(w3, contract,
        contract.functions.storeOriginInspection(2, origin_hash_2, "ff00ff00ff00ff00", "QmOriginCID_SHP2", 10000),
        account)

    # Now verify with TAMPERED image (very different hash)
    tampered_hash = hashlib.sha256(b"TAMPERED-cargo-with-contraband").digest()

    receipt = send_tx(w3, contract,
        contract.functions.verifyDestinationInspection(
            2,                    # shipmentId
            tampered_hash,        # completely different hash
            "00ff00ff00ff00ff",    # very different pHash
            "QmTamperedDiffCID",  # CID for diff report
            3200,                 # SSIM: 0.3200 (very low — images don't match)
            42,                   # Hamming distance: 42 (way above threshold of 10)
            "ALERT: Significant structural difference detected in cargo."
        ), account)

    record = contract.functions.getInspectionRecord(4).call()
    print(f"   ⚠️  Verdict: {verdict_names[record[8]]} 🚨")
    print(f"   SSIM Score: {record[6] / 10000}")
    print(f"   Hamming Distance: {record[7]}")

    shipment2 = contract.functions.getShipment(2).call()
    print(f"   Shipment Status: {status_names[shipment2[4]]}")
    print(f"   TxHash: {receipt.transactionHash.hex()}")

    # Check tampering alerts
    alerts = contract.functions.getShipmentAlerts(2).call()
    print(f"   Tampering Alerts on Shipment #2: {len(alerts)}")

    # ── System Stats ──────────────────────────────────────────────────────────
    print("\n" + "─" * 60)
    stats = contract.functions.getSystemStats().call()
    print(f"📊 System Statistics:")
    print(f"   Total Shipments: {stats[0]}")
    print(f"   Total Inspections: {stats[1]}")
    print(f"   Total Tampering Alerts: {stats[2]}")

    print("\n" + "═" * 60)
    print("  ✅ Blockchain Demo Complete!")
    print("  All data is permanently stored on the local Ethereum ledger.")
    print("═" * 60 + "\n")


if __name__ == "__main__":
    main()
