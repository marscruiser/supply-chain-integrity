# Smart Contract Reference

## SupplyChainIntegrity.sol

### Functions
| Function | Access | Description |
|----------|--------|-------------|
| `registerShipment(code)` | ORIGINATOR | Register new shipment |
| `storeOriginInspection(id, hash, phash, cid, ssim)` | INSPECTOR | Store origin fingerprint |
| `verifyDestinationInspection(id, hash, phash, cid, ssim, hamming, notes)` | VERIFIER | Verify + auto-verdict |
| `getShipment(id)` | public | Read shipment data |
| `getInspectionRecord(id)` | public | Read inspection record |
| `getSystemStats()` | public | Aggregate counts |

### Events
- `ShipmentRegistered(shipmentId, shipmentCode, originator, timestamp)`
- `OriginInspectionStored(shipmentId, recordId, imageHash, ipfsCID, timestamp)`
- `DestinationVerified(shipmentId, recordId, verdict, timestamp)`
- `TamperingDetected(shipmentId, alertId, hammingDistance, ssimScore, timestamp)`

### Roles
- `DEFAULT_ADMIN_ROLE` — Contract deployer
- `ORIGINATOR_ROLE` — Registers shipments
- `INSPECTOR_ROLE` — Stores origin inspections
- `VERIFIER_ROLE` — Performs destination verification

## InspectionRegistry.sol
- Global cross-contract inspection index with pagination support
