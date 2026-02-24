# AGENTS.md - ROBOWAR V2 SYSTEM

## Model Configuration (STRICT)
- **Osman (PM)**: Claude Sonnet 4.6
- **Burcu (Architect)**: Claude Sonnet 4.6
- **Selin (BE)**: Claude Sonnet 4.6
- **Oğuz (FE)**: Claude Sonnet 4.6
- **Fatih (Game Engine)**: Gemini 3.1 Pro
- **İrem (QA)**: GPT-5.3
- **Cem (Review)**: Claude Sonnet 4.6
- **Mehmet (Designer)**: GPT-5.3

## System Architecture
- **Frontend**: React + TypeScript + PixiJS + Tailwind
- **Backend**: Node.js + Express + Socket.io + PostgreSQL + Redis
- **Engine**: Deterministic LCG-based simulation
- **Web3**: ELDR (ERC-20) + MetaMask integration

## Reporting
- Every subagent MUST report status to Telegram group 'Afternext Dev Team' upon task completion.
- Subagents MUST update Jira (comments/status) if possible.
- Main Agent (Osman) oversees all GitHub/Vercel operations.
