/**
 * ROBOWAR V2 — Battle State Management Hook
 * Orchestrates pre-battle setup, real-time battle events, and post-battle cleanup.
 *
 * Real backend event mapping:
 *   battle:joined       → confirmed room entry → SETUP phase
 *   battle:player_ready → both players ready → COUNTDOWN → IN_PROGRESS
 *   battle:tick         → live tick data → update HP/energy/position via store
 *   battle:complete     → battle ended → RESULT phase
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore, type AlgorithmBlock } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { useSocket } from './useSocket';
import type { BattleTick, WsBattleEnded } from '../types';

export type BattlePhase =
  | 'LOADING'
  | 'SETUP'         // Choosing robot + algorithm
  | 'MATCHMAKING'   // Waiting for opponent
  | 'COUNTDOWN'     // 3-2-1 countdown
  | 'IN_PROGRESS'   // Live battle
  | 'RESULT'        // Win/lose screen
  | 'ERROR';

export function useBattle() {
  const { id: battleId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    currentBattle,
    activeRobot,
    setCurrentBattle,
    updateBattleState,
    appendBattleLog,
    updateRobotAlgorithm,
  } = useGameStore();

  const { connect, joinBattle, signalReady, socket } = useSocket();

  const [phase, setPhase] = useState<BattlePhase>('LOADING');
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState<string | null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!battleId) {
      setError('No battle ID');
      setPhase('ERROR');
      return;
    }

    const sock = connect();

    // ── Socket connected → join battle room ────────────────────────────────
    sock.on('connect', () => {
      joinBattle(battleId);
    });

    // ── Battle room joined → show setup screen ─────────────────────────────
    sock.on('battle:joined', ({ battle_id }) => {
      if (battle_id === battleId) {
        setPhase('SETUP');
        // Signal to the server that we're ready after setup
        // (In real flow: player clicks "Ready" button)
      }
    });

    // ── Both players ready → start countdown ──────────────────────────────
    sock.on('battle:player_ready', () => {
      setPhase('COUNTDOWN');
      let count = 3;
      const timer = setInterval(() => {
        setCountdown(count);
        count--;
        if (count < 0) {
          clearInterval(timer);
          setPhase('IN_PROGRESS');
        }
      }, 1000);
    });

    // ── Tick event → update battle state (HP, energy, positions) ──────────
    sock.on('battle:tick', (tick: BattleTick) => {
      // Transition to IN_PROGRESS on the first tick (handles auto-start)
      setPhase((prev) =>
        prev === 'SETUP' || prev === 'COUNTDOWN' || prev === 'LOADING'
          ? 'IN_PROGRESS'
          : prev
      );

      const battle = useGameStore.getState().currentBattle;
      if (!battle) return;

      // Determine which side is "me" based on stored myRobotId
      // p1 and p2 are TickState objects; the battle record tells us which slot is ours
      const p1 = tick.p1 as { hp: number; energy: number; action: string; damage_dealt: number; position: [number, number] };
      const p2 = tick.p2 as { hp: number; energy: number; action: string; damage_dealt: number; position: [number, number] };

      // myRobotId stored in battle state identifies which side we are
      // If not available, default to p1 as self
      const iAmP1 = !battle.myRobotId || battle.myRobotId === (currentBattle as { player1RobotId?: string })?.player1RobotId;
      const myTick  = iAmP1 ? p1 : p2;
      const enmTick = iAmP1 ? p2 : p1;

      updateBattleState({
        turn: tick.tick,
        myHp:        myTick?.hp     ?? battle.myHp,
        myEnergy:    myTick?.energy ?? battle.myEnergy,
        enemyHp:     enmTick?.hp    ?? battle.enemyHp,
        enemyEnergy: enmTick?.energy ?? battle.enemyEnergy,
      });

      // Append action to battle log
      const action = myTick?.action;
      if (action && action !== 'IDLE') {
        appendBattleLog({
          turn: tick.tick,
          actor: 'me',
          action,
          damage: myTick?.damage_dealt ?? 0,
          timestamp: Date.now(),
        });
      }
      const enemyAction = enmTick?.action;
      if (enemyAction && enemyAction !== 'IDLE') {
        appendBattleLog({
          turn: tick.tick,
          actor: 'enemy',
          action: enemyAction,
          damage: enmTick?.damage_dealt ?? 0,
          timestamp: Date.now(),
        });
      }
    });

    // ── Battle complete ────────────────────────────────────────────────────
    sock.on('battle:complete', (data: WsBattleEnded) => {
      updateBattleState({
        status: 'FINISHED',
        winner: data.winner_id ?? null,
        rewardEldr: data.eldr_delta ?? null,
      });
      setPhase('RESULT');
    });

    sock.on('connect_error', () => {
      setError('Cannot reach game server');
      setPhase('ERROR');
    });

    // ── If already connected on mount (socket reuse), join immediately ─────
    if (sock.connected) {
      joinBattle(battleId);
    }

    return () => {
      sock.off('connect');
      sock.off('battle:joined');
      sock.off('battle:player_ready');
      sock.off('battle:tick');
      sock.off('battle:complete');
      sock.off('connect_error');
    };
  }, [battleId, connect, joinBattle, updateBattleState, appendBattleLog]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const saveAlgorithm = useCallback(
    (blocks: AlgorithmBlock[]) => {
      if (!activeRobot) return;
      updateRobotAlgorithm(activeRobot.id, blocks);

      // Once algorithm is saved, signal ready to start
      if (battleId && phase === 'SETUP') {
        signalReady(battleId);
      }
    },
    [activeRobot, updateRobotAlgorithm, battleId, phase, signalReady]
  );

  const forfeit = useCallback(() => {
    setCurrentBattle(null);
    navigate('/lobby', { replace: true });
  }, [setCurrentBattle, navigate]);

  const playAgain = useCallback(() => {
    setCurrentBattle(null);
    navigate('/lobby', { replace: true });
  }, [setCurrentBattle, navigate]);

  // ── Derived State ─────────────────────────────────────────────────────────

  const myHpPercent = currentBattle
    ? Math.max(0, (currentBattle.myHp / currentBattle.myMaxHp) * 100)
    : 0;

  const enemyHpPercent = currentBattle
    ? Math.max(0, (currentBattle.enemyHp / currentBattle.enemyMaxHp) * 100)
    : 0;

  const isMyTurn =
    currentBattle &&
    phase === 'IN_PROGRESS' &&
    currentBattle.turn % 2 === 0;

  const userId = useAuthStore.getState().user?.id;
  const didWin =
    phase === 'RESULT' &&
    currentBattle?.winner === userId;

  return {
    battleId,
    phase,
    countdown,
    error,
    currentBattle,
    activeRobot,
    myHpPercent,
    enemyHpPercent,
    isMyTurn,
    didWin,
    saveAlgorithm,
    forfeit,
    playAgain,
  };
}
