# 🤖 ROBOWAR V2 — Algorithm Battle Protocol

> Write IF-THEN algorithms. Control pixel-art robots. Fight for ELDR.

---

## Overview

ROBOWAR is a **Web3 PvP strategy game** where players author deterministic battle algorithms that control their robots in asynchronous fights. No real-time input — your code fights for you.

### Key Concepts
- **36 Robots** across 6 elements: `VOLT ⚡ PYRO 🔥 CRYO ❄️ NANO 🧬 VOID 🌀 IRON 🛡️`
- **4 Biomes**: Grassland · Desert · Snowfield · City/Base (each with random events)
- **Currency**: GMO (Golden Motor Oil) — in-game · ELDR (ERC-20) — on-chain
- **Pilots**: NFT pilot cards that provide stat modifiers to robots
- **Algorithms**: JSON rule trees (priority + condition + action) compiled by the LCG engine

---

## Repository Structure

```
robowar/
├── frontend/          # React + TypeScript + PixiJS + Tailwind + Zustand
├── backend/           # Node.js + Express + Socket.IO + PostgreSQL + Redis + BullMQ
├── engine/            # Deterministic LCG battle simulation (isomorphic)
├── contracts/         # ELDR ERC-20 smart contracts (Solidity / ethers.js)
├── docs/
│   ├── DB_SCHEMA.md   # Full PostgreSQL schema documentation
│   └── API_SPEC.md    # REST + WebSocket API specification
├── docker/            # Dockerfiles
├── docker-compose.yml # Full local dev stack
└── .github/           # CI/CD workflows
```

---

## Quick Start (Docker)

```bash
# 1. Clone & enter project
cd /path/to/robowar

# 2. Copy env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start all services
docker-compose up -d

# 4. Run migrations
docker-compose exec backend npm run migrate

# 5. Seed robot catalogue
docker-compose exec backend npm run seed
```

Services:
| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| pgAdmin | http://localhost:5050 (profile: tools) |
| Redis Commander | http://localhost:8081 (profile: tools) |

```bash
# Start with dev tools
docker-compose --profile tools up -d
```

---

## Development

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npm run dev        # API server
npm run worker     # BullMQ worker (separate terminal)
```

### Engine
```bash
cd engine
npm install
npm run test       # Unit tests
npm run benchmark  # Perf test
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 18 + TypeScript |
| **Rendering Engine** | PixiJS 8 (WebGL pixel-art) |
| **Styling** | Tailwind CSS 3 + Press Start 2P font |
| **State Management** | Zustand 5 |
| **Server State** | TanStack Query 5 |
| **Web3** | wagmi v2 + viem + ethers.js 6 |
| **Backend** | Node.js 22 + Express 4 + TypeScript |
| **Real-time** | Socket.IO 4 |
| **Database** | PostgreSQL 16 |
| **Cache / Queue** | Redis 7 + BullMQ 5 |
| **Battle Engine** | Deterministic LCG (custom, isomorphic) |
| **Auth** | JWT (access) + httpOnly cookie (refresh) |
| **Containerization** | Docker + docker-compose |

---

## Battle Engine

The engine uses a **Linear Congruential Generator (LCG)** with parameters from Numerical Recipes:

```
X(n+1) = (1664525 × X(n) + 1013904223) mod 2³²
```

The same `lcg_seed` always produces the **identical battle outcome**. This enables:
- ✅ Trustless replays (stored only as seed + algorithm IDs)
- ✅ Dispute resolution
- ✅ Client-side verification
- ✅ Zero backend cheating surface

---

## Algorithm Rule Tree

```json
{
  "version": 2,
  "rules": [
    {
      "priority": 1,
      "condition": {
        "type": "AND",
        "children": [
          { "type": "COMPARE", "left": "self.hp_pct", "op": "<", "right": 30 },
          { "type": "COMPARE", "left": "self.energy", "op": ">=", "right": 5 }
        ]
      },
      "action": { "type": "SKILL", "skillId": "heal_burst", "target": "SELF" }
    },
    {
      "priority": 99,
      "condition": { "type": "ALWAYS" },
      "action": { "type": "ATTACK", "target": "ENEMY" }
    }
  ]
}
```

---

## Team

| Agent | Role | Model |
|---|---|---|
| Osman | Product Manager | Claude Sonnet 4.6 |
| Burcu | System Architect | Claude Sonnet 4.6 |
| Selin | Backend Engineer | Claude Sonnet 4.6 |
| Oğuz | Frontend Engineer | Claude Sonnet 4.6 |
| Fatih | Game Engine | Gemini 3.1 Pro |
| İrem | QA | GPT-5.3 |
| Cem | Code Review | Claude Sonnet 4.6 |
| Mehmet | Designer | GPT-5.3 |

---

*ROBOWAR V2 — Algorithm Battle Protocol · Afternext Dev Team*
