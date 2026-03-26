# VeriChainKYC

Blockchain-enabled KYC and fraud-detection platform with:

- React + Vite frontend (`client/`)
- Node.js + Express + MongoDB backend (`server/`)
- MetaMask wallet integration
- Role-based on-chain dashboards (Admin, Issuer, Verifier)
- Optional IPFS document upload via Pinata

---

## What this project does

VeriChainKYC combines on-chain role/transaction logic with off-chain KYC metadata storage:

- Users connect MetaMask and are routed by role.
- KYC identifiers are hashed and used on-chain.
- Off-chain KYC metadata and optional documents are saved through backend APIs.
- Fraud reports are mirrored off-chain for auditability.

Network target: **Ethereum Sepolia** (`0xaa36a7`).

---

## Repository structure

```text
client/   # React app (wallet, dashboards, tx status, API calls)
server/   # Express API (KYC records, fraud reports, MongoDB, IPFS integration)
```

---

## Frontend highlights (`client`)

- Wallet connect + silent wallet initialization
- Account and chain change handling
- Sepolia network enforcement + switch request
- Role detection from contract (`getRoles`) with compatibility fallback
- Dashboards:
  - Admin/Issuer dashboard
  - Issuer dashboard
  - Verifier dashboard
- Transaction feedback (`pending`, `success`, `error`) and toast notifications
- Optional contract event listeners (`KYCAdded`, proposal-created events)

### Client environment variables

Create `client/.env` and configure:

```env
VITE_CONTRACT_ADDRESS=0xYourSepoliaContractAddress
VITE_CONTRACT_ABI=[{"inputs":[],"name":"...","type":"function"}]
VITE_BACKEND_URL=http://localhost:5000
```

Notes:

- `VITE_CONTRACT_ABI` must be valid JSON.
- Keep ABI on one line to avoid parsing issues in `.env`.

---

## Backend highlights (`server`)

- MongoDB connection with startup validation
- CORS configuration using `CORS_ORIGIN`
- KYC routes:
  - Upload/update KYC metadata by hash
  - Fetch KYC by hash
  - Get total KYC count
- Fraud route:
  - Mirror fraud report payloads off-chain
- Optional Pinata upload for document files

### Server environment variables

Create `server/.env` and configure:

```env
MONGODB_URI=mongodb://localhost:27017/verichainkyc
PORT=5000
CORS_ORIGIN=http://localhost:5173
PINATA_JWT=your_pinata_jwt_optional
```

Notes:

- `MONGODB_URI` is required.
- `PINATA_JWT` is optional; without it, uploads continue but IPFS CID will be skipped.

---

## API reference

Base URL: `http://localhost:5000`

### Health

- `GET /health` → API status

### KYC

- `POST /kyc/upload`
  - `multipart/form-data`
  - Required fields: `hash`, `originalIdentifier`
  - Optional fields: `identifierType` (`email | id | other`), `metadata` (JSON string/object), `document` (file)
- `GET /kyc/count` → total KYC records
- `GET /kyc/:hash` → fetch KYC record by hash

### Fraud

- `POST /fraud/report`
  - Required fields: `hash`, `score`, `reason`
  - Optional fields: `reportedBy`, `txHash`

---

## Local development

### 1) Install dependencies

```bash
cd server
npm install

cd ../client
npm install
```

### 2) Start backend

```bash
cd server
npm run dev
```

### 3) Start frontend

```bash
cd client
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:5000`

---

## Available scripts

### Client

- `npm run dev` – start Vite dev server
- `npm run build` – production build
- `npm run preview` – preview production build

### Server

- `npm run dev` – start with nodemon
- `npm run start` – start with node

---

## Troubleshooting

- **MetaMask not found**: install MetaMask extension and refresh.
- **Wrong network**: switch wallet to Sepolia.
- **Contract initialization errors**: verify `VITE_CONTRACT_ADDRESS` and `VITE_CONTRACT_ABI`.
- **Mongo connection fails**: verify `MONGODB_URI` and database availability.
- **IPFS upload fails**: verify `PINATA_JWT` (KYC metadata still saves without CID).
