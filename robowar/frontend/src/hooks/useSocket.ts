/**
 * ROBOWAR V2 — Socket.IO Hook
 * Manages connection lifecycle and typed event subscriptions.
 */
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';
import type { BattleLogEntry, BattleState } from '../store/gameStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

// ─── Typed Server → Client events ────────────────────────────────────────────

interface ServerToClientEvents {
  'battle:start':  (data: BattleState) => void;
  'battle:update': (data: Partial<BattleState>) => void;
  'battle:log':    (entry: BattleLogEntry) => void;
  'battle:end':    (data: { winner: string; rewardEldr: string }) => void;
  'lobby:players': (data: { count: number }) => void;
  'error':         (data: { message: string }) => void;
}

// ─── Typed Client → Server events ────────────────────────────────────────────

interface ClientToServerEvents {
  'battle:join':    (data: { battleId: string; address: string }) => void;
  'battle:action':  (data: { battleId: string; action: string }) => void;
  'lobby:join':     (data: { address: string }) => void;
  'lobby:leave':    (data: { address: string }) => void;
}

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSocket() {
  const socketRef = useRef<AppSocket | null>(null);
  const address = useGameStore((s) => s.wallet.address);
  const { updateBattleState, appendBattleLog, setCurrentBattle, setError } =
    useGameStore();

  const getSocket = useCallback((): AppSocket => {
    if (!socketRef.current || !socketRef.current.connected) {
      socketRef.current = io(SOCKET_URL, {
        autoConnect: false,
        auth: { address },
        transports: ['websocket'],
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      }) as AppSocket;
    }
    return socketRef.current;
  }, [address]);

  const connect = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }

    // Attach default battle listeners
    socket.on('battle:start', (data) => setCurrentBattle(data));
    socket.on('battle:update', (updates) => updateBattleState(updates));
    socket.on('battle:log', (entry) => appendBattleLog(entry));
    socket.on('battle:end', ({ winner, rewardEldr }) => {
      updateBattleState({ status: 'FINISHED', winner, rewardEldr });
    });
    socket.on('error', ({ message }) => setError(message));

    return socket;
  }, [getSocket, setCurrentBattle, updateBattleState, appendBattleLog, setError]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

  const joinBattle = useCallback((battleId: string) => {
    const socket = getSocket();
    if (address) {
      socket.emit('battle:join', { battleId, address });
    }
  }, [getSocket, address]);

  const joinLobby = useCallback(() => {
    const socket = getSocket();
    if (address) {
      socket.emit('lobby:join', { address });
    }
  }, [getSocket, address]);

  const leaveLobby = useCallback(() => {
    const socket = getSocket();
    if (address) {
      socket.emit('lobby:leave', { address });
    }
  }, [getSocket, address]);

  // Auto-disconnect when address changes
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, [address]);

  return {
    connect,
    disconnect,
    joinBattle,
    joinLobby,
    leaveLobby,
    socket: socketRef.current,
  };
}
