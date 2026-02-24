import { Queue } from "bullmq";
import { getRedis } from "../config/redis";

const connection = () => ({ connection: getRedis() });

// ─── Queue Definitions ───────────────────────────────────────────────────────
export const battleSimQueue = new Queue("battle-simulation", {
  ...connection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const matchmakingQueue = new Queue("matchmaking", {
  ...connection(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: { count: 100 },
  },
});

export const leaderboardRefreshQueue = new Queue("leaderboard-refresh", {
  ...connection(),
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
  },
});

export const transactionWatchQueue = new Queue("transaction-watch", {
  ...connection(),
  defaultJobOptions: {
    attempts: 10,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 200 },
  },
});

// ─── Job Type Helpers ────────────────────────────────────────────────────────
export const jobs = {
  simulateBattle: (battleId: string) =>
    battleSimQueue.add("simulate", { battleId }, { jobId: `battle:${battleId}` }),

  runMatchmaking: (mode: string) =>
    matchmakingQueue.add("match", { mode }, { delay: 2000, jobId: `mm:${mode}` }),

  refreshLeaderboard: () =>
    leaderboardRefreshQueue.add("refresh", {}, { jobId: "lb:refresh" }),

  watchTransaction: (txHash: string, userId: string, type: string) =>
    transactionWatchQueue.add("watch", { txHash, userId, type }, {
      jobId: `tx:${txHash}`,
      delay: 3000,
    }),
};
