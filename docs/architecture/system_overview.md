# System Architecture Overview

## Module Interaction

```
Module A (Vision)           →  Module B (Blockchain)
    ↑  produces fingerprints          ↑  stores hashes + CIDs
    |                                 |
Module C API ────────────────────────┘
    ↓
React Dashboard
    ↓
User (Logistics Operator / Security Auditor)
```

## Data Flow
1. **Register**: Shipment registered → Module B smart contract
2. **Origin Scan**: X-ray → Module A → fingerprint → IPFS upload → CID on blockchain
3. **Destination Scan**: X-ray → Module A → compare to origin → verdict on blockchain
4. **Dashboard**: React shows PASS/FAIL with full blockchain audit trail

## Key Design Decisions
- **Hashes on chain, data on IPFS**: Minimal gas costs + full verifiability
- **Module A stateless**: Vision API is a pure function (image → fingerprint)
- **Module C orchestrates**: Cross-module calls centralized in `verification_service.py`
- **MongoDB for querying**: Blockchain is truth, MongoDB enables fast filtering
- **Multi-signal fusion**: Anomaly detection uses weighted combination of pHash, SSIM, HOG, keypoints
