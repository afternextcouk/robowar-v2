import { Namespace, Socket } from 'socket.io';
import { createClient } from 'redis';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
export type RobotTier = 'FREE' | 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type ElementType = 'FIRE' | 'WATER' | 'EARTH' | 'AIR' | 'LIGHTNING' | 'VOID';

export interface QueueEntry {
  socketId: string;
  userId: string;
  robotId: string;
  tier: RobotTier;
  element: ElementType;
  joinedAt: number;
  algorithmId: string;
}

export interface MatchFoundPayload {
  battleId: string;
  opponent: {
    userId: string;
    robotId: string;
    tier: RobotTier;
    element: ElementType;
  };
  startsAt: string;
}

// ──────────────────────────────────────────────
// Redis Client
// ──────────────────────────────────────────────
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redis.on('error', (err) => console.error('[Redis] Error:', err));
redis.on('connect', () => console.log('[Redis] Matchmaking client connected'));

redis.connect().catch(console.error);

const QUEUE_KEY = 'robowar:matchmaking:queue';
const MATCH_TIMEOUT_MS = 30_000; // 30 seconds before relaxed matching

// ──────────────────────────────────────────────
// Helper: Generate a battle ID
// ──────────────────────────────────────────────
function generateBattleId(): string {
  return `battle_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ──────────────────────────────────────────────
// Helper: Score match quality (lower = better)
// ──────────────────────────────────────────────
function matchScore(a: QueueEntry, b: QueueEntry, now: number): number {
  const tierMatch = a.tier === b.tier ? 0 : 1;
  const elementMatch = a.element === b.element ? 0 : 0.5;
  // After 30s, we don't care about tier/element anymore
  const aWaited = now - a.joinedAt > MATCH_TIMEOUT_MS;
  const bWaited = now - b.joinedAt > MATCH_TIMEOUT_MS;
  if (aWaited || bWaited) return 0; // Force match
  return tierMatch + elementMatch;
}

// ──────────────────────────────────────────────
// Queue Operations (Redis HASH)
// ──────────────────────────────────────────────
async function addToQueue(entry: QueueEntry): Promise<void> {
  await redis.hSet(QUEUE_KEY, entry.socketId, JSON.stringify(entry));
}

async function removeFromQueue(socketId: string): Promise<void> {
  await redis.hDel(QUEUE_KEY, socketId);
}

async function getQueue(): Promise<QueueEntry[]> {
  const raw = await redis.hGetAll(QUEUE_KEY);
  return Object.values(raw).map((v) => JSON.parse(v) as QueueEntry);
}

// ──────────────────────────────────────────────
// Matchmaking Loop — per-connection polling
// ──────────────────────────────────────────────
async function findMatch(entry: QueueEntry, ns: Namespace): Promise<boolean> {
  const queue = await getQueue();
  const now = Date.now();

  // Find best opponent (not self)
  const candidates = queue.filter((q) => q.socketId !== entry.socketId);
  if (candidates.length === 0) return false;

  // Sort by match quality
  candidates.sort((a, b) => matchScore(entry, a, now) - matchScore(entry, b, now));

  const opponent = candidates[0];
  const score = matchScore(entry, opponent, now);

  // Accept any match after timeout, otherwise require score < 1 (same tier at minimum)
  const waited = now - entry.joinedAt > MATCH_TIMEOUT_MS;
  if (!waited && score >= 1) return false;

  // Match found! Remove both from queue
  await removeFromQueue(entry.socketId);
  await removeFromQueue(opponent.socketId);

  const battleId = generateBattleId();
  const startsAt = new Date(Date.now() + 3000).toISOString(); // 3s countdown

  const payload1: MatchFoundPayload = {
    battleId,
    opponent: { userId: opponent.userId, robotId: opponent.robotId, tier: opponent.tier, element: opponent.element },
    startsAt,
  };
  const payload2: MatchFoundPayload = {
    battleId,
    opponent: { userId: entry.userId, robotId: entry.robotId, tier: entry.tier, element: entry.element },
    startsAt,
  };

  // Emit to both sockets
  ns.to(entry.socketId).emit('match_found', payload1);
  ns.to(opponent.socketId).emit('match_found', payload2);

  console.log(`[Matchmaking] ✅ Matched ${entry.userId} vs ${opponent.userId} → Battle: ${battleId}`);
  return true;
}

// ──────────────────────────────────────────────
// Register Handlers on Namespace
// ──────────────────────────────────────────────
export function registerMatchmakingHandlers(ns: Namespace): void {
  ns.on('connection', (socket: Socket) => {
    console.log(`[Matchmaking] Socket connected: ${socket.id}`);

    let matchPollInterval: ReturnType<typeof setInterval> | null = null;

    // ── join_queue ──────────────────────────────
    socket.on('join_queue', async (data: {
      userId: string;
      robotId: string;
      tier: RobotTier;
      element: ElementType;
      algorithmId: string;
    }) => {
      console.log(`[Matchmaking] ${data.userId} joining queue (tier=${data.tier}, element=${data.element})`);

      const entry: QueueEntry = {
        socketId: socket.id,
        userId: data.userId,
        robotId: data.robotId,
        tier: data.tier,
        element: data.element,
        joinedAt: Date.now(),
        algorithmId: data.algorithmId,
      };

      await addToQueue(entry);
      socket.emit('queue_joined', { position: 'searching', message: 'Looking for an opponent...' });

      // Poll for a match every 2 seconds
      matchPollInterval = setInterval(async () => {
        const matched = await findMatch(entry, ns);
        if (matched && matchPollInterval) {
          clearInterval(matchPollInterval);
          matchPollInterval = null;
        }
      }, 2000);
    });

    // ── leave_queue ─────────────────────────────
    socket.on('leave_queue', async () => {
      console.log(`[Matchmaking] ${socket.id} leaving queue`);
      if (matchPollInterval) {
        clearInterval(matchPollInterval);
        matchPollInterval = null;
      }
      await removeFromQueue(socket.id);
      socket.emit('queue_left', { message: 'Left matchmaking queue' });
    });

    // ── battle_turn ─────────────────────────────
    // Relay turn data to battle room (server validates server-side)
    socket.on('battle_turn', (data: { battleId: string; turnData: unknown }) => {
      // Broadcast to battle room (both players)
      socket.to(`battle:${data.battleId}`).emit('battle_turn', data);
    });

    // ── battle_start ────────────────────────────
    socket.on('battle_start', (data: { battleId: string }) => {
      socket.join(`battle:${data.battleId}`);
      console.log(`[Matchmaking] Socket ${socket.id} joined battle room: ${data.battleId}`);
    });

    // ── battle_end ──────────────────────────────
    socket.on('battle_end', (data: { battleId: string; winnerId: string; result: unknown }) => {
      ns.to(`battle:${data.battleId}`).emit('battle_end', data);
      console.log(`[Matchmaking] Battle ended: ${data.battleId}, winner: ${data.winnerId}`);
    });

    // ── disconnect ──────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`[Matchmaking] Socket disconnected: ${socket.id}`);
      if (matchPollInterval) {
        clearInterval(matchPollInterval);
        matchPollInterval = null;
      }
      await removeFromQueue(socket.id);
    });
  });
}
