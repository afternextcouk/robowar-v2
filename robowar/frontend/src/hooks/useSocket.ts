/**
 * ROBOWAR V2 — Socket.IO Hook
 * Connects to the real backend Socket.IO server with JWT auth.
 *
 * Server config:  path="/v2/ws"  (see backend/src/socket/index.ts)
 * Auth:           { token: <accessToken> } via socket.handshake.auth
 *
 * ── Server → Client events ──────────────────────────────────────────────────
 *   battle:joined         — Acknowledged entering a battle room
 *   battle:player_ready   — A player signalled ready
 *   battle:emote_received — Emote from opponent
 *   battle:tick           — Live tick snapshot (HP, energy, position)
 *   battle:complete       — Battle finished (winner, deltas)
 *   queue:updated         — Matchmaking queue status update
 *   queue:left            — Confirmed leaving queue
 *   match_found           — Matchmaking succeeded → contains battle_id
 *   pong                  — Response to keep-alive ping
 *   error                 — Generic server error
 *
 * ── Client → Server events ──────────────────────────────────────────────────
 *   battle:join           — Join a battle room
 *   battle:leave          — Leave a battle room
 *   battle:ready          — Signal player readiness
 *   queue:join            — Enter matchmaking queue
 *   queue:leave           — Exit matchmaking queue
 *   ping                  — Keep-alive
 */

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import type { BattleLogEntry, BattleState } from '../store/gameStore';
import type { BattleTick, WsQueueMatched, WsBattleEnded, BattlePlayerSnap, BiomeType } from '../types';

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// ─── Typed Server → Client events ────────────────────────────────────────────

interface ServerToClientEvents {
  // Battle room events
  'battle:joined':        (data: { battle_id: string }) => void;
  'battle:player_ready':  (data: { user_id: string; username: string }) => void;
  'battle:emote_received':(data: { from_player: string; emote_id: string }) => void;

  /**
   * Deterministic tick snapshot emitted each game tick.
   * Frontend maps tick.p1/p2 → current player's HP/energy/position.
   */
  'battle:tick':          (data: BattleTick) => void;

  /**
   * Battle has ended.
   * Frontend shows victory/defeat overlay based on winner_id vs own userId.
   */
  'battle:complete':      (data: WsBattleEnded) => void;

  // Matchmaking events
  /** Confirmed entry into the matchmaking queue. */
  'matchmaking:joined':   (data: { status: string; position: number | null; rating_range: number }) => void;
  /** Opponent found — navigate to /battle/:battle_id */
  'matchmaking:matched':  (data: WsQueueMatched) => void;

  // Legacy / raw matchmaking namespace events (from matchmaking.ts)
  'queue:updated':        (data: { status: string; position: number | null; rating_range: number }) => void;
  'queue:left':           (data: { ok: boolean }) => void;
  'match_found':          (data: { battleId: string; opponent: { userId: string; robotId: string; tier: string; element: string }; startsAt: string }) => void;

  // Misc
  'pong':                 () => void;
  'error':                (data: { message: string }) => void;
}

// ─── Typed Client → Server events ────────────────────────────────────────────

interface ClientToServerEvents {
  'battle:join':          (data: { battle_id: string }) => void;
  'battle:leave':         (data: { battle_id: string }) => void;
  'battle:ready':         (data: { battle_id: string }) => void;
  'queue:join':           (data: { mode?: string; robot_id?: string; algorithm_id?: string }) => void;
  'queue:leave':          () => void;
  'ping':                 () => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSocket() {
  const socketRef = useRef<AppSocket | null>(null);

  const { updateBattleState, appendBattleLog, setCurrentBattle, setError } =
    useGameStore();

  /** Always read the latest token so we reconnect with the correct one. */
  const getToken = useCallback(
    () => useAuthStore.getState().accessToken ?? '',
    []
  );

  // ── Get or create socket ──────────────────────────────────────────────────
  const getSocket = useCallback((): AppSocket => {
    if (!socketRef.current || !socketRef.current.connected) {
      socketRef.current = io(SOCKET_URL, {
        path: '/v2/ws',
        autoConnect: false,
        auth: { token: getToken() },
        transports: ['websocket'],
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      }) as AppSocket;
    }
    return socketRef.current;
  }, [getToken]);

  // ── Connect with default listeners ───────────────────────────────────────
  const connect = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) {
      // Refresh auth token before each connect (may have refreshed via API client)
      socket.auth = { token: getToken() };
      socket.connect();
    }

    // ── Battle listeners ─────────────────────────────────────────────────
    socket.on('battle:tick', (tick: BattleTick) => {
      // Map the tick snapshot onto our Zustand battle state.
      // We determine which side is "me" based on stored battle playerIds.
      const battle = useGameStore.getState().currentBattle;
      if (!battle) return;

      const userId = useAuthStore.getState().user?.id;
      // Backend sends p1/p2 keyed on battle record; we mirror by myRobotId
      // (set when the battle was started by useBattle or battle:start event)
      const myTick  = battle.myRobotId === tick.p1?.toString() ? tick.p1 : tick.p2;
      const enmTick = battle.myRobotId === tick.p1?.toString() ? tick.p2 : tick.p1;

      updateBattleState({
        turn: tick.tick,
        myHp:     (myTick as unknown as { hp: number })?.hp  ?? battle.myHp,
        myEnergy: (myTick as unknown as { energy: number })?.energy ?? battle.myEnergy,
        enemyHp:  (enmTick as unknown as { hp: number })?.hp  ?? battle.enemyHp,
        enemyEnergy: (enmTick as unknown as { energy: number })?.energy ?? battle.enemyEnergy,
      });

      // Append to battle log if there's an action
      const myAction = (myTick as unknown as { action: string; damage_dealt: number })?.action;
      if (myAction && myAction !== 'IDLE') {
        const logEntry: BattleLogEntry = {
          turn: tick.tick,
          actor: 'me',
          action: myAction,
          damage: (myTick as unknown as { damage_dealt: number })?.damage_dealt ?? 0,
          timestamp: Date.now(),
        };
        appendBattleLog(logEntry);
      }
    });

    socket.on('battle:complete', (data: WsBattleEnded) => {
      const userId = useAuthStore.getState().user?.id;
      updateBattleState({
        status: 'FINISHED',
        winner: data.winner_id ?? null,
        rewardEldr: data.eldr_delta ?? null,
      });
    });

    // ── Matchmaking listeners ────────────────────────────────────────────
    // Support both event name styles (backend uses queue:updated / match_found)
    socket.on('queue:updated', (data) => {
      // re-emit as matchmaking:joined for consumers
      socket.emit('ping'); // keep-alive
      // broadcast into game store
      updateBattleState({ status: 'WAITING' } as Partial<BattleState>);
    });

    socket.on('matchmaking:joined', (data) => {
      updateBattleState({ status: 'WAITING' } as Partial<BattleState>);
    });

    socket.on('error', ({ message }) => setError(message));

    return socket;
  }, [getSocket, getToken, updateBattleState, appendBattleLog, setCurrentBattle, setError]);

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

  // ── Battle room actions ───────────────────────────────────────────────────
  const joinBattle = useCallback((battleId: string) => {
    const socket = getSocket();
    socket.emit('battle:join', { battle_id: battleId });
  }, [getSocket]);

  const leaveBattle = useCallback((battleId: string) => {
    const socket = getSocket();
    socket.emit('battle:leave', { battle_id: battleId });
  }, [getSocket]);

  const signalReady = useCallback((battleId: string) => {
    const socket = getSocket();
    socket.emit('battle:ready', { battle_id: battleId });
  }, [getSocket]);

  // ── Matchmaking actions ───────────────────────────────────────────────────
  const joinMatchmaking = useCallback((
    opts: { mode?: string; robot_id?: string; algorithm_id?: string } = {}
  ) => {
    const socket = getSocket();
    socket.emit('queue:join', opts);
  }, [getSocket]);

  const leaveMatchmaking = useCallback(() => {
    const socket = getSocket();
    socket.emit('queue:leave');
  }, [getSocket]);

  // Legacy lobby API (backward compat with existing code that calls joinLobby)
  const joinLobby  = joinMatchmaking;
  const leaveLobby = leaveMatchmaking;

  // ── Auto-disconnect on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return {
    connect,
    disconnect,
    joinBattle,
    leaveBattle,
    signalReady,
    joinMatchmaking,
    leaveMatchmaking,
    // Legacy aliases
    joinLobby,
    leaveLobby,
    socket: socketRef.current,
  };
}
