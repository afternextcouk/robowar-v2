# ROBOWAR V2 — Frontend

React + TypeScript + PixiJS frontend for the ROBOWAR V2 blockchain battle arena.

## Stack

| Layer       | Tech                              |
|-------------|-----------------------------------|
| UI          | React 18 + TypeScript             |
| Styling     | Tailwind CSS + CSS custom props   |
| Routing     | React Router v6                   |
| State       | Zustand (persist + devtools)      |
| Animation   | Framer Motion                     |
| Game Render | PixiJS v8 + @pixi/tilemap         |
| Web3        | ethers v6 + wagmi v2              |
| Real-time   | Socket.IO client v4               |
| Build       | Vite 5                            |

## Directory Structure

```
src/
├── App.tsx                    # Router with guards
├── main.tsx                   # Entry point
├── store/
│   └── gameStore.ts           # Zustand: wallet, pilot, robots, battle
├── pages/
│   ├── Onboarding.tsx         # MetaMask connect
│   ├── PilotCreator.tsx       # 60×60 layered character creator
│   ├── ElementSelect.tsx      # 6 element cards
│   ├── Lobby.tsx              # World map
│   ├── BattleArena.tsx        # Full battle UI
│   ├── Profile.tsx            # Player stats
│   └── Market.tsx             # Robot marketplace
├── components/
│   ├── BattleArena/
│   │   ├── PixiStage.tsx      # PIXI.Application wrapper
│   │   ├── TileMap.tsx        # 4-biome tile renderer
│   │   ├── RobotSprite.tsx    # Robot + HP + glow
│   │   └── AlgorithmEditor.tsx # IF-THEN drag-drop editor
│   └── ui/
│       ├── PixelPanel.tsx     # Pixel-border panel
│       ├── PixelButton.tsx    # 3-state pixel button
│       ├── HPBar.tsx          # Color-shifting HP bar
│       ├── EnergyBar.tsx      # Segmented energy bar
│       └── ElementBadge.tsx   # Element icon + label
├── hooks/
│   ├── useWallet.ts           # MetaMask connection
│   ├── useSocket.ts           # Socket.IO lifecycle
│   └── useBattle.ts           # Battle state machine
└── styles/
    └── globals.css            # Tailwind + pixel palette
```

## Routes

| Path          | Guard    | Page            |
|---------------|----------|-----------------|
| `/`           | —        | Onboarding      |
| `/pilot`      | wallet   | PilotCreator    |
| `/element`    | wallet   | ElementSelect   |
| `/lobby`      | pilot    | Lobby           |
| `/battle/:id` | pilot    | BattleArena     |
| `/profile`    | pilot    | Profile         |
| `/market`     | pilot    | Market          |

## Element System

| Element | Color      | CSS Var  | Strength | Weakness |
|---------|-----------|----------|----------|---------|
| VOLT    | #00BFFF   | --volt   | CRYO     | IRON    |
| PYRO    | #CC2200   | --pyro   | NANO     | CRYO    |
| CRYO    | #E8F4FF   | --cryo   | PYRO     | VOLT    |
| NANO    | #00CC44   | --nano   | VOID     | PYRO    |
| VOID    | #6600AA   | --void   | IRON     | NANO    |
| IRON    | #888899   | --iron   | VOLT     | VOID    |

## PixiJS Architecture

- **PixiStage** — owns `PIXI.Application`, handles resize via `ResizeObserver`
- **TileMap** — procedural `Graphics`-based tiles; swap for `Sprite`s once assets land
- **RobotSprite** — static factory `create()` returns a `Container` hierarchy:
  `glowBlur → bodyGraphics → hpBarContainer → elementLabel`
- Pixel-art: `antialias: false`, `imageRendering: pixelated` on canvas

## Dev Setup

```bash
cd robowar/frontend
npm install
npm run dev          # Vite dev server on :3000
```

Requires `.env.local`:
```
VITE_SOCKET_URL=http://localhost:4000
VITE_CHAIN_ID=137
```
