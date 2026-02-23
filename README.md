# 🔐 Supply Chain Integrity System
## Version 0.3.0
## Ensuring Supply Chain Integrity through 3D X-Ray Data Analysis, Perceptual Fingerprinting, and Blockchain Integration

> **Final Year B.Tech Project** | Department of Computer Science & Engineering

---

## 📋 Table of Contents
- [Problem Statement](#problem-statement)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Module Overview](#module-overview)
- [Setup & Installation](#setup--installation)
- [Running the System](#running-the-system)
- [Team](#team)
- [License](#license)

---

## Problem Statement

Global logistics and supply chain networks face a critical security gap known as **"Blind Transit"** — sealed shipments may be tampered with internally without breaking external seals.

This project provides an end-to-end immutable verification framework:
> **"What was shipped is exactly what arrived."**

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SUPPLY CHAIN INTEGRITY SYSTEM                     │
│                                                                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
│  │   MODULE A   │    │   MODULE B   │    │        MODULE C          │   │
│  │ Vision & CV  │───▶│  Blockchain  │◀───│  API, Dashboard & Integ. │   │
│  │              │    │ Smart Contr. │    │                          │   │
│  └──────────────┘    └──────────────┘    └──────────────────────────┘   │
│         │                   │                        │                   │
│         ▼                   ▼                        ▼                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
│  │  X-Ray Image │    │  Hyperledger │    │      React Dashboard      │   │
│  │  Processing  │    │  Fabric/ETH  │    │      FastAPI Backend      │   │
│  │  pHash/SSIM  │    │  IPFS Store  │    │      MongoDB Logs         │   │
│  └──────────────┘    └──────────────┘    └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow
```
X-Ray Scan
    │
    ▼
Image Preprocessing (denoise, normalize, segment)
    │
    ▼
Perceptual Hash + Feature Fingerprint Generation
    │
    ├──▶ IPFS Upload (decentralized storage)
    │         │
    │         ▼
    │    IPFS CID (Content Identifier)
    │         │
    ▼         ▼
Blockchain Smart Contract (Hash + CID + Timestamp + ShipmentID)
    │
    ▼
Verification API (FastAPI)
    │
    ▼
React Dashboard (Pass / Fail / Tampered Alert)
```

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Image Processing | Python 3.10+, OpenCV, NumPy, Scikit-image |
| Perceptual Hashing | imagehash (pHash, dHash, aHash, wHash) |
| Similarity Metrics | SSIM, MSE, Histogram Comparison |
| Datasets | SIXray, GDXray Industrial X-ray Datasets |
| Blockchain | Hyperledger Fabric / Ethereum (Solidity) |
| Smart Contracts | Solidity 0.8.x / Chaincode (Go) |
| Decentralized Storage | IPFS (via ipfshttpclient / web3.storage) |
| API Layer | FastAPI (Python), Uvicorn |
| Frontend | React 18, TypeScript, Chart.js, TailwindCSS |
| Database | MongoDB (Mongoose) |
| Visualization | Matplotlib, Plotly, D3.js |
| Containerization | Docker, Docker Compose |
| Testing | Pytest, Jest, Truffle/Hardhat |

---

## Project Structure

```
supply-chain-integrity/
├── module_a_vision/          # Vision, CV, Fingerprinting
├── module_b_blockchain/      # Smart Contracts, IPFS, Ledger
├── module_c_integration/     # FastAPI, React Dashboard, MongoDB
├── shared/                   # Common utilities, models, config
├── docs/                     # Full project documentation
├── scripts/                  # Automation & deployment scripts
├── docker-compose.yml
├── Makefile
└── README.md
```

---

## Module Overview

### Module A — Vision & Data Analysis (Lead: Vaibhav Bose)
- X-ray image acquisition and preprocessing
- Synthetic tampering simulation
- Perceptual hashing (pHash, dHash, aHash, wHash)
- SSIM-based anomaly scoring
- Digital fingerprint generation
- Tampering detection accuracy evaluation

### Module B — Blockchain & Smart Contracts (Lead: Rishabh Chauhan)
- Hyperledger Fabric / Ethereum network setup
- Smart contract development for hash logging
- IPFS integration for decentralized storage
- Blockchain latency benchmarking
- Security analysis against insider attacks

### Module C — API, Dashboard & System Integration (Lead: Tejas Bhati)
- FastAPI middleware for system integration
- React-based Supply Chain Verification Dashboard
- Real-time verification interface
- MongoDB metadata logging
- End-to-end system testing

---

## Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- Docker & Docker Compose
- Git

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd supply-chain-integrity

# Copy environment variables
cp .env.example .env

# Install all dependencies
make install

# Start all services via Docker
make up

# Or start individually
make run-vision
make run-blockchain
make run-api
make run-dashboard
```

---

## Running the System

```bash
# Run full system
make start

# Run only Module A (Vision)
cd module_a_vision && python main.py

# Run only Module B (Blockchain)
cd module_b_blockchain && npm run deploy

# Run only Module C (API + Dashboard)
cd module_c_integration && make run

# Run all tests
make test

# Generate system report
make report
```

---

## Team

| Name | Role | Module |
|------|------|--------|
| **Vaibhav Bose** | Vision & CV Lead | Module A |
| **Rishabh Chauhan** | Blockchain Lead | Module B |
| **Tejas Bhati** | API & Integration Lead | Module C |

---

## License

This project is developed as an academic final year project. All rights reserved © 2025.
