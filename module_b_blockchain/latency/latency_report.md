# Blockchain Latency Report — Module B

## Test Environment
- Network: Hardhat localhost (1-second auto-mining)
- RPC: http://127.0.0.1:8545
- Solidity: 0.8.19 with optimizer (200 runs)

## Benchmark Results

> Run `npm run benchmark` to populate with real data.

| Operation | Avg (ms) | Min (ms) | Max (ms) | Samples |
|-----------|----------|----------|----------|---------|
| registerShipment | — | — | — | 10 |
| storeOriginInspection | — | — | — | 10 |
| verifyDestinationInspection | — | — | — | 10 |
| getShipment (read) | — | — | — | 10 |

## Gas Costs

| Operation | Gas Used | USD (est.) |
|-----------|----------|------------|
| registerShipment | — | — |
| storeOriginInspection | — | — |
| verifyDestinationInspection | — | — |

## Expected Production Metrics
- Write latency (Sepolia): ~12-15 seconds (block time)
- Read latency: <100ms (JSON-RPC call)
- Hyperledger Fabric: ~1-2 second finality
