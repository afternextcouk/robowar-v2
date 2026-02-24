# 🤖 ROBOWAR — Algorithm Battle Protocol

A full-stack Web3 mobile/browser game where players write IF-THEN algorithms to control robots in PvP battles.

## Tech Stack
- **Frontend:** React + TypeScript + PixiJS v8 + Tailwind + Zustand
- **Backend:** Node.js + Express + Socket.IO + PostgreSQL + Redis + BullMQ
- **Engine:** Deterministic LCG-based simulation
- **Web3:** ELDR (ERC-20) + MetaMask integration

## Quick Start
```bash
docker-compose up -d
cd frontend && npm install && npm run dev
cd backend && npm install && npm run dev
```

## Team
- Osman (PM) · Burcu (Architect) · Fatih (Engine) · Selin (Backend)
- Oğuz (Frontend) · İrem (QA) · Cem (Review) · Mehmet (Designer)

## Sprint Status
- ✅ Sprint 1: Project Scaffold (Engine, Backend, Frontend, Architecture)
- ✅ Sprint 2: Bug Crusher (P1 balance, MetaMask auth, JWT security, Battle worker)
- 🔄 Sprint 3: Launch Ready (Element balance, GitHub/Vercel deploy, Asset integration)
