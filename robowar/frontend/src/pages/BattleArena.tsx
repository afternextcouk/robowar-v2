/**
 * ROBOWAR V2 — Battle Arena Page
 * Orchestrates PixiJS stage, algorithm editor, and battle HUD.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useBattle } from '../hooks/useBattle';
import PixiStage from '../components/BattleArena/PixiStage';
import AlgorithmEditor from '../components/BattleArena/AlgorithmEditor';
import HPBar from '../components/ui/HPBar';
import EnergyBar from '../components/ui/EnergyBar';
import ElementBadge from '../components/ui/ElementBadge';
import PixelButton from '../components/ui/PixelButton';
import PixelPanel from '../components/ui/PixelPanel';

export default function BattleArena() {
  const {
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
  } = useBattle();

  // ── Error ──────────────────────────────────────────────────────────────────
  if (phase === 'ERROR') {
    return (
      <div className="flex items-center justify-center w-full h-full bg-[--bg]">
        <PixelPanel className="text-center space-y-4">
          <p className="font-pixel text-[8px] text-[--pyro]">⚠ {error}</p>
          <PixelButton onClick={forfeit}>RETURN TO LOBBY</PixelButton>
        </PixelPanel>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (phase === 'LOADING') {
    return (
      <div className="flex items-center justify-center w-full h-full bg-[--bg]">
        <div className="font-pixel text-xs text-[--volt] animate-pixel-pulse">
          CONNECTING TO ARENA...
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="flex flex-col w-full h-full bg-[--bg] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* ── Top HUD ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-[--surface] border-b-2 border-[--border] flex-shrink-0">
        {/* My robot */}
        <div className="flex items-center gap-3 flex-1">
          {activeRobot && (
            <>
              <div className="w-8 h-8 bg-[--surface-2] pixel-border flex items-center justify-center">
                <span className="text-sm">🤖</span>
              </div>
              <div className="space-y-1">
                <p className="font-pixel text-[7px] text-[--text]">{activeRobot.name}</p>
                <HPBar
                  hp={currentBattle?.myHp ?? activeRobot.stats.maxHp}
                  maxHp={activeRobot.stats.maxHp}
                  width={120}
                />
                <EnergyBar
                  energy={currentBattle?.myEnergy ?? activeRobot.stats.energy}
                  maxEnergy={activeRobot.stats.maxEnergy}
                  segments={activeRobot.stats.maxEnergy}
                  width={120}
                />
              </div>
              <ElementBadge element={activeRobot.element} size="sm" />
            </>
          )}
        </div>

        {/* Turn/Round indicator */}
        <div className="text-center flex-shrink-0 px-4">
          <p className="font-pixel text-[6px] text-[--muted]">ROUND</p>
          <p className="font-pixel text-xs text-[--accent]">
            {currentBattle?.turn ?? 0}
          </p>
          {phase === 'IN_PROGRESS' && (
            <p className={`font-pixel text-[6px] ${isMyTurn ? 'text-[--nano]' : 'text-[--muted]'}`}>
              {isMyTurn ? '▶ YOUR TURN' : 'ENEMY TURN'}
            </p>
          )}
        </div>

        {/* Enemy robot */}
        <div className="flex items-center gap-3 flex-1 justify-end">
          <div className="space-y-1 items-end flex flex-col">
            <p className="font-pixel text-[7px] text-[--pyro]">ENEMY</p>
            <HPBar
              hp={currentBattle?.enemyHp ?? 100}
              maxHp={currentBattle?.enemyMaxHp ?? 100}
              width={120}
            />
          </div>
          <div className="w-8 h-8 bg-[--surface-2] pixel-border flex items-center justify-center">
            <span className="text-sm">🦾</span>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* PixiJS Battle Stage */}
        <div className="flex-1 relative">
          <PixiStage
            width={undefined}
            height={undefined}
            biome={currentBattle?.biome ?? 'GRASSLAND'}
            myRobotId={currentBattle?.myRobotId}
            enemyRobotId={currentBattle?.enemyRobotId}
            myElement={activeRobot?.element}
            phase={phase}
          />

          {/* Countdown overlay */}
          <AnimatePresence>
            {phase === 'COUNTDOWN' && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center bg-black/60 z-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.span
                  key={countdown}
                  className="font-pixel text-8xl text-[--accent]"
                  style={{ textShadow: '0 0 20px var(--accent)' }}
                  initial={{ scale: 2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {countdown === 0 ? 'FIGHT!' : countdown}
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result overlay */}
          <AnimatePresence>
            {phase === 'RESULT' && (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 space-y-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.4, delay: 0.2 }}
                >
                  <p
                    className="font-pixel text-4xl"
                    style={{
                      color: didWin ? 'var(--nano)' : 'var(--pyro)',
                      textShadow: `0 0 20px ${didWin ? 'var(--nano)' : 'var(--pyro)'}`,
                    }}
                  >
                    {didWin ? '⚔ VICTORY!' : '💀 DEFEAT'}
                  </p>
                </motion.div>
                {currentBattle?.rewardEldr && didWin && (
                  <p className="font-pixel text-xs text-[--volt]">
                    +{currentBattle.rewardEldr} ELDR
                  </p>
                )}
                <div className="flex gap-4">
                  <PixelButton onClick={playAgain}>PLAY AGAIN</PixelButton>
                  <PixelButton onClick={() => (window.location.href = '/lobby')}>
                    LOBBY
                  </PixelButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Algorithm Editor sidebar ── */}
        {(phase === 'SETUP' || phase === 'IN_PROGRESS') && (
          <div className="w-72 flex-shrink-0 border-l-2 border-[--border] overflow-y-auto">
            <AlgorithmEditor
              initialBlocks={activeRobot?.algorithm ?? []}
              onSave={saveAlgorithm}
              locked={phase === 'IN_PROGRESS'}
            />
          </div>
        )}
      </div>

      {/* ── Bottom: Battle Log ── */}
      {currentBattle && currentBattle.log.length > 0 && (
        <div className="h-24 bg-[--surface] border-t-2 border-[--border] px-4 py-2 overflow-y-auto flex-shrink-0">
          <p className="font-pixel text-[6px] text-[--accent] mb-1">BATTLE LOG</p>
          {[...currentBattle.log].reverse().slice(0, 5).map((entry, i) => (
            <p key={i} className="font-pixel text-[6px] text-[--muted] leading-relaxed">
              <span className={entry.actor === 'me' ? 'text-[--volt]' : 'text-[--pyro]'}>
                [{entry.actor === 'me' ? 'YOU' : 'ENEMY'}]
              </span>{' '}
              {entry.action}
              {entry.damage && <span className="text-[--pyro]"> -{entry.damage} HP</span>}
            </p>
          ))}
        </div>
      )}

      {/* Forfeit button */}
      {(phase === 'SETUP' || phase === 'IN_PROGRESS') && (
        <div className="absolute bottom-28 right-4 z-10">
          <PixelButton
            onClick={forfeit}
            className="text-[--pyro] border-[--pyro] text-[7px]"
          >
            FORFEIT
          </PixelButton>
        </div>
      )}
    </motion.div>
  );
}
