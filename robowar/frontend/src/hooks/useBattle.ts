/**
 * ROBOWAR V2 — Battle State Management Hook
 * Orchestrates pre-battle setup, real-time battle events, and post-battle cleanup.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore, type AlgorithmBlock } from '../store/gameStore';
import { useSocket } from './useSocket';

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
    updateRobotAlgorithm,
  } = useGameStore();

  const { connect, joinBattle, socket } = useSocket();

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

    sock.on('connect', () => {
      joinBattle(battleId);
      setPhase('SETUP');
    });

    sock.on('connect_error', () => {
      setError('Cannot reach game server');
      setPhase('ERROR');
    });

    sock.on('battle:start', () => {
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

    sock.on('battle:end', () => {
      setPhase('RESULT');
    });

    return () => {
      sock.off('battle:start');
      sock.off('battle:end');
      sock.off('connect');
      sock.off('connect_error');
    };
  }, [battleId, connect, joinBattle]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const saveAlgorithm = useCallback(
    (blocks: AlgorithmBlock[]) => {
      if (!activeRobot) return;
      updateRobotAlgorithm(activeRobot.id, blocks);
    },
    [activeRobot, updateRobotAlgorithm]
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

  const didWin =
    phase === 'RESULT' &&
    currentBattle?.winner === useGameStore.getState().wallet.address;

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
