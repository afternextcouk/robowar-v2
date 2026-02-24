/**
 * ROBOWAR V2 — Global Game Store (Zustand)
 * Central state for wallet, pilot, elements, robots, and battle data.
 */
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ─── Type Definitions ────────────────────────────────────────────────────────

export type ElementType = 'VOLT' | 'PYRO' | 'CRYO' | 'NANO' | 'VOID' | 'IRON';

export type PilotLayer =
  | 'body'
  | 'hair'
  | 'clothes'
  | 'eyebrows'
  | 'eyes'
  | 'mouth'
  | 'nose';

export interface PilotAppearance {
  layers: Record<PilotLayer, number>;  // variant index per layer
  hairColor: string;                    // hex color
}

export interface Pilot {
  id: string;
  name: string;
  appearance: PilotAppearance;
  element: ElementType | null;
  xp: number;
  level: number;
  wins: number;
  losses: number;
  createdAt: number;
}

export type RobotRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface RobotStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  energy: number;
  maxEnergy: number;
}

export interface Robot {
  id: string;
  tokenId: number;
  name: string;
  element: ElementType;
  rarity: RobotRarity;
  stats: RobotStats;
  spriteKey: string;
  algorithm: AlgorithmBlock[];
  isStaked: boolean;
}

export type AlgorithmCondition =
  | 'HP_ABOVE_50'
  | 'HP_BELOW_50'
  | 'HP_BELOW_25'
  | 'ENEMY_HP_BELOW_50'
  | 'ENEMY_HP_BELOW_25'
  | 'ENERGY_FULL'
  | 'ENERGY_ABOVE_50'
  | 'ENERGY_BELOW_25'
  | 'ENEMY_ADJACENT'
  | 'ENEMY_IN_RANGE'
  | 'BLOCKED'
  | 'ALWAYS';

export type AlgorithmAction =
  | 'MOVE_TOWARD_ENEMY'
  | 'MOVE_AWAY_FROM_ENEMY'
  | 'ATTACK_BASIC'
  | 'ATTACK_SPECIAL'
  | 'DEFEND'
  | 'RECHARGE'
  | 'WAIT';

export interface AlgorithmBlock {
  id: string;
  priority: number;
  condition: AlgorithmCondition;
  action: AlgorithmAction;
}

export type BattleStatus = 'WAITING' | 'IN_PROGRESS' | 'FINISHED' | 'ABANDONED';

export type BiomeType = 'GRASSLAND' | 'DESERT' | 'SNOWFIELD' | 'CITY';

export interface BattleState {
  id: string;
  status: BattleStatus;
  biome: BiomeType;
  turn: number;
  myRobotId: string;
  enemyRobotId: string;
  myHp: number;
  myMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  myEnergy: number;
  enemyEnergy: number;
  log: BattleLogEntry[];
  winner: string | null;
  rewardEldr: string | null;
}

export interface BattleLogEntry {
  turn: number;
  actor: 'me' | 'enemy';
  action: string;
  damage?: number;
  heal?: number;
  timestamp: number;
}

export interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
}

// ─── Store Interface ──────────────────────────────────────────────────────────

interface GameStoreState {
  // Wallet
  wallet: WalletState;

  // Player
  pilot: Pilot | null;
  selectedElement: ElementType | null;

  // Robots
  robots: Robot[];
  activeRobot: Robot | null;

  // Battle
  currentBattle: BattleState | null;

  // Balances (as string to preserve bigint precision)
  gmoBalance: string;   // GMO token balance
  eldrBalance: string;  // ELDR token balance

  // UI
  isLoading: boolean;
  error: string | null;
}

interface GameStoreActions {
  // Wallet actions
  setWallet: (wallet: Partial<WalletState>) => void;
  disconnectWallet: () => void;

  // Pilot actions
  setPilot: (pilot: Pilot) => void;
  updatePilotAppearance: (appearance: Partial<PilotAppearance>) => void;
  setSelectedElement: (element: ElementType) => void;

  // Robot actions
  setRobots: (robots: Robot[]) => void;
  addRobot: (robot: Robot) => void;
  setActiveRobot: (robot: Robot | null) => void;
  updateRobotAlgorithm: (robotId: string, algorithm: AlgorithmBlock[]) => void;
  updateRobotStats: (robotId: string, stats: Partial<RobotStats>) => void;

  // Battle actions
  setCurrentBattle: (battle: BattleState | null) => void;
  updateBattleState: (updates: Partial<BattleState>) => void;
  appendBattleLog: (entry: BattleLogEntry) => void;

  // Balance actions
  setGmoBalance: (balance: string) => void;
  setEldrBalance: (balance: string) => void;

  // UI actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Reset
  resetGame: () => void;
}

type GameStore = GameStoreState & GameStoreActions;

// ─── Initial State ────────────────────────────────────────────────────────────

const initialWallet: WalletState = {
  address: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
};

const initialState: GameStoreState = {
  wallet: initialWallet,
  pilot: null,
  selectedElement: null,
  robots: [],
  activeRobot: null,
  currentBattle: null,
  gmoBalance: '0',
  eldrBalance: '0',
  isLoading: false,
  error: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ── Wallet ─────────────────────────────────────────────────────────
        setWallet: (wallet) =>
          set((state) => ({ wallet: { ...state.wallet, ...wallet } })),

        disconnectWallet: () =>
          set({ wallet: initialWallet, pilot: null, robots: [], activeRobot: null }),

        // ── Pilot ──────────────────────────────────────────────────────────
        setPilot: (pilot) => set({ pilot }),

        updatePilotAppearance: (appearance) =>
          set((state) => {
            if (!state.pilot) return state;
            return {
              pilot: {
                ...state.pilot,
                appearance: { ...state.pilot.appearance, ...appearance },
              },
            };
          }),

        setSelectedElement: (element) =>
          set((state) => ({
            selectedElement: element,
            pilot: state.pilot
              ? { ...state.pilot, element }
              : null,
          })),

        // ── Robots ─────────────────────────────────────────────────────────
        setRobots: (robots) => set({ robots }),

        addRobot: (robot) =>
          set((state) => ({ robots: [...state.robots, robot] })),

        setActiveRobot: (robot) => set({ activeRobot: robot }),

        updateRobotAlgorithm: (robotId, algorithm) =>
          set((state) => ({
            robots: state.robots.map((r) =>
              r.id === robotId ? { ...r, algorithm } : r
            ),
            activeRobot:
              state.activeRobot?.id === robotId
                ? { ...state.activeRobot, algorithm }
                : state.activeRobot,
          })),

        updateRobotStats: (robotId, stats) =>
          set((state) => ({
            robots: state.robots.map((r) =>
              r.id === robotId ? { ...r, stats: { ...r.stats, ...stats } } : r
            ),
          })),

        // ── Battle ─────────────────────────────────────────────────────────
        setCurrentBattle: (battle) => set({ currentBattle: battle }),

        updateBattleState: (updates) =>
          set((state) => ({
            currentBattle: state.currentBattle
              ? { ...state.currentBattle, ...updates }
              : null,
          })),

        appendBattleLog: (entry) =>
          set((state) => ({
            currentBattle: state.currentBattle
              ? {
                  ...state.currentBattle,
                  log: [...state.currentBattle.log, entry],
                }
              : null,
          })),

        // ── Balances ───────────────────────────────────────────────────────
        setGmoBalance: (gmoBalance) => set({ gmoBalance }),
        setEldrBalance: (eldrBalance) => set({ eldrBalance }),

        // ── UI ─────────────────────────────────────────────────────────────
        setLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error }),

        // ── Reset ──────────────────────────────────────────────────────────
        resetGame: () => set(initialState),
      }),
      {
        name: 'robowar-game-store',
        // Persist only non-sensitive, recoverable fields
        partialize: (state) => ({
          pilot: state.pilot,
          selectedElement: state.selectedElement,
          robots: state.robots,
          activeRobot: state.activeRobot,
          wallet: {
            address: state.wallet.address,
            chainId: state.wallet.chainId,
            isConnected: false, // force re-connect on refresh
            isConnecting: false,
          },
        }),
      }
    ),
    { name: 'RoboWarStore' }
  )
);

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectWallet = (s: GameStore) => s.wallet;
export const selectPilot = (s: GameStore) => s.pilot;
export const selectElement = (s: GameStore) => s.selectedElement;
export const selectRobots = (s: GameStore) => s.robots;
export const selectActiveRobot = (s: GameStore) => s.activeRobot;
export const selectBattle = (s: GameStore) => s.currentBattle;
export const selectBalances = (s: GameStore) => ({
  gmo: s.gmoBalance,
  eldr: s.eldrBalance,
});
