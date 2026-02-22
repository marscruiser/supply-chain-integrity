# API Reference — Supply Chain Integrity

Base URL: `http://localhost:8000/api/v1`

## Shipments
| Method | Path | Description |
|--------|------|-------------|
| POST | `/shipments` | Register new shipment |
| GET | `/shipments` | List all shipments |
| GET | `/shipments/:id` | Get shipment by ID |
| GET | `/shipments/code/:code` | Get shipment by code |

## Verification
| Method | Path | Description |
|--------|------|-------------|
| POST | `/verify/origin/:id` | Upload & store origin X-ray |
| POST | `/verify/destination/:id` | Upload & verify destination X-ray |
| GET | `/verify/status/:id` | Get verification status |

## Inspections
| Method | Path | Description |
|--------|------|-------------|
| GET | `/inspections` | List inspections (filter by shipment_id) |
| GET | `/inspections/:id` | Get inspection by ID |
| GET | `/inspections/ipfs/:cid` | Get raw IPFS data |

## Reports
| Method | Path | Description |
|--------|------|-------------|
| GET | `/reports/system-stats` | System-wide statistics |
| GET | `/reports/trends` | Tampering trends over time |
| GET | `/reports/accuracy` | Vision module accuracy |
| GET | `/reports/export` | Export report (JSON/PDF) |

## Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/token` | Get JWT access token |
| POST | `/auth/register` | Register new user |

## WebSocket
- `ws://localhost:8000/ws` — Real-time inspection events
