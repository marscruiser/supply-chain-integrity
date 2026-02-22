# Security Analysis — Module B Blockchain

## Threat Model

| Threat | Attack Vector | Mitigation |
|--------|--------------|------------|
| Insider Hash Replacement | Malicious inspector submits wrong hash | Smart contract records inspector address; immutable historic record |
| IPFS Data Deletion | CID unpinned/garbage collected | Multiple pinning services + local node; CID on-chain still verifies |
| Phishing / Key Theft | Private key compromise | Hardware wallets for production; RBAC limits damage scope |
| 51% Attack (PoW) | Majority mining power | Use permissioned Hyperledger Fabric for production |
| Replay Attack | Old signed transaction reused | Nonce management in Web3.py / ethers.js |
| Smart Contract Bug | Reentrancy, overflow | OpenZeppelin ReentrancyGuard; Solidity 0.8.x native overflow |
| Oracle Manipulation | Feed false SSIM/hash data | Threshold-based verdict logic on-chain + multi-inspector requirement |

## Implemented Mitigations
- ✅ Role-Based Access Control (RBAC) via OpenZeppelin AccessControl
- ✅ ReentrancyGuard on all state-changing functions
- ✅ Pausable pattern for emergency stops
- ✅ Event emission for full auditability
- ✅ No floating-point (SSIM stored as integer × 10000)
- ✅ Input validation (non-empty CID, non-zero hash)

## TODO
- [ ] Run Slither static analysis
- [ ] Run MythX security scanner
- [ ] Formal verification of critical paths
- [ ] Multi-sig admin for production deployment
