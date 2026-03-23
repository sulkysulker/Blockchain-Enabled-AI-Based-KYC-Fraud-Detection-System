# VeriChainKYC (MERN + Sepolia dApp)

Full-stack KYC dApp with role-based dashboards for `Admin`, `Issuer`, and `Verifier`, integrated with MetaMask and an Ethereum Sepolia smart contract.

## Project Structure

- `client/` React + ethers.js frontend
- `server/` Express + MongoDB backend APIs

## Frontend Features

- MetaMask connect + account change + chain detection
- Sepolia enforcement (`0xaa36a7`)
- Role detection via `getRoles(address)`
- Issuer dashboard:
  - `addKYC(hash, verified)`
  - `updateKYC(hash, verified)`
  - `reportFraud(hash, score, reason)`
  - `propose(...)`, `getProposal(id)`, `vote(id, approve)`
  - Optional off-chain metadata + document upload to backend/IPFS
- Verifier dashboard:
  - `getKYC(hash)`
  - `logAccess(hash)`
  - `getAccessLogs(hash)`
  - View off-chain KYC record from backend
- Transaction status UI (`pending/success/error`) + toast notifications
- Optional contract event listeners (`ProposalCreated`, `KYCAdded`)

## Backend APIs

- `POST /kyc/upload` store hash-mapped metadata and optional document upload to IPFS
- `GET /kyc/:hash` fetch stored KYC metadata
- `POST /fraud/report` mirror fraud reports off-chain
- `GET /health` health check

## Environment Setup

### 1) Client `.env`

Copy `client/.env.example` to `client/.env` and set:

- `VITE_CONTRACT_ADDRESS` deployed Sepolia address
- `VITE_CONTRACT_ABI` ABI JSON string (single line)
- `VITE_BACKEND_URL` backend API URL

### 2) Server `.env`

Copy `server/.env.example` to `server/.env` and set:

- `MONGODB_URI`
- `PINATA_JWT` (if using IPFS upload)
- `CORS_ORIGIN`
- `PORT` (optional)

## Run

### Backend

```bash
cd server
npm install
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.
