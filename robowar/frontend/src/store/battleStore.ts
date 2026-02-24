import { create } from "zustand";
import type { Battle, BattleTick, BattleStatus } from "@/types";

interface BattleState {
  currentBattle: Battle | null;
  ticks: BattleTick[];
  currentTick: number;
  status: BattleStatus | "IDLE";
  isSpectating: boolean;
  inQueue: boolean;
  queueId: string | null;
  queuePosition: number | null;
  ratingDelta: number | null;

  // Actions
  setBattle: (battle: Battle) => void;
  addTick: (tick: BattleTick) => void;
  addTicks: (ticks: BattleTick[]) => void;
  setTick: (n: number) => void;
  setStatus: (s: BattleStatus | "IDLE") => void;
  setInQueue: (v: boolean, queueId?: string) => void;
  setQueuePosition: (pos: number) => void;
  setSpectating: (v: boolean) => void;
  setRatingDelta: (d: number) => void;
  reset: () => void;
}

const initialState = {
  currentBattle: null,
  ticks: [],
  currentTick: 0,
  status: "IDLE" as const,
  isSpectating: false,
  inQueue: false,
  queueId: null,
  queuePosition: null,
  ratingDelta: null,
};

export const useBattleStore = create<BattleState>()((set) => ({
  ...initialState,

  setBattle: (currentBattle) => set({ currentBattle }),
  addTick: (tick) =>
    set((s) => ({
      ticks: [...s.ticks, tick],
      currentTick: tick.tick,
    })),
  addTicks: (ticks) =>
    set((s) => ({
      ticks: [...s.ticks, ...ticks],
      currentTick: ticks.at(-1)?.tick ?? s.currentTick,
    })),
  setTick: (currentTick) => set({ currentTick }),
  setStatus: (status) => set({ status }),
  setInQueue: (inQueue, queueId) =>
    set({ inQueue, queueId: queueId ?? null }),
  setQueuePosition: (queuePosition) => set({ queuePosition }),
  setSpectating: (isSpectating) => set({ isSpectating }),
  setRatingDelta: (ratingDelta) => set({ ratingDelta }),
  reset: () => set(initialState),
}));
