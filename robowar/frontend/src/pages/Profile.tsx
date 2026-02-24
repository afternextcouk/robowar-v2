/**
 * ROBOWAR V2 — Player Profile Page
 */
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { useWallet } from '../hooks/useWallet';
import PixelPanel from '../components/ui/PixelPanel';
import PixelButton from '../components/ui/PixelButton';
import ElementBadge from '../components/ui/ElementBadge';

export default function Profile() {
  const navigate = useNavigate();
  const { shortAddress, disconnect } = useWallet();
  const pilot       = useGameStore((s) => s.pilot);
  const robots      = useGameStore((s) => s.robots);
  const gmoBalance  = useGameStore((s) => s.gmoBalance);
  const eldrBalance = useGameStore((s) => s.eldrBalance);

  if (!pilot) return null;

  const winRate = pilot.wins + pilot.losses > 0
    ? Math.round((pilot.wins / (pilot.wins + pilot.losses)) * 100)
    : 0;

  return (
    <motion.div
      className="flex flex-col items-center w-full h-full bg-[--bg] overflow-y-auto py-8 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-pixel text-xs text-[--accent]">PILOT PROFILE</h1>
          <PixelButton onClick={() => navigate('/lobby')}>← LOBBY</PixelButton>
        </div>

        {/* Identity */}
        <PixelPanel className="flex gap-6 items-start">
          <div className="w-20 h-20 bg-[--surface-2] pixel-border flex items-center justify-center flex-shrink-0">
            <span className="text-4xl">🤖</span>
          </div>
          <div className="space-y-2 flex-1">
            <p className="font-pixel text-sm text-[--accent]">{pilot.name}</p>
            {pilot.element && <ElementBadge element={pilot.element} />}
            <p className="font-pixel text-[7px] text-[--muted]">{shortAddress}</p>
            <div className="flex gap-4">
              <div className="text-center">
                <p className="font-pixel text-xs text-[--accent]">{pilot.level}</p>
                <p className="font-pixel text-[6px] text-[--muted]">LEVEL</p>
              </div>
              <div className="text-center">
                <p className="font-pixel text-xs text-[--volt]">{pilot.xp}</p>
                <p className="font-pixel text-[6px] text-[--muted]">XP</p>
              </div>
            </div>
          </div>
        </PixelPanel>

        {/* Stats */}
        <PixelPanel className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="font-pixel text-lg text-[--nano]">{pilot.wins}</p>
            <p className="font-pixel text-[6px] text-[--muted]">WINS</p>
          </div>
          <div className="text-center">
            <p className="font-pixel text-lg text-[--pyro]">{pilot.losses}</p>
            <p className="font-pixel text-[6px] text-[--muted]">LOSSES</p>
          </div>
          <div className="text-center">
            <p className="font-pixel text-lg text-[--volt]">{winRate}%</p>
            <p className="font-pixel text-[6px] text-[--muted]">WIN RATE</p>
          </div>
        </PixelPanel>

        {/* Balances */}
        <PixelPanel className="space-y-3">
          <p className="font-pixel text-[8px] text-[--accent]">TOKEN BALANCES</p>
          <div className="flex justify-between items-center pixel-border p-3">
            <span className="font-pixel text-[8px] text-[--muted]">GMO Token</span>
            <span className="font-pixel text-sm text-[--nano]">{gmoBalance}</span>
          </div>
          <div className="flex justify-between items-center pixel-border p-3">
            <span className="font-pixel text-[8px] text-[--muted]">ELDR Token</span>
            <span className="font-pixel text-sm text-[--volt]">{eldrBalance}</span>
          </div>
        </PixelPanel>

        {/* Robot collection */}
        <PixelPanel className="space-y-3">
          <p className="font-pixel text-[8px] text-[--accent]">ROBOT COLLECTION ({robots.length})</p>
          {robots.length === 0 ? (
            <p className="font-pixel text-[7px] text-[--muted] text-center py-4">
              No robots yet. Visit the market!
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {robots.map((robot) => (
                <div key={robot.id} className="pixel-border p-2 space-y-1">
                  <p className="font-pixel text-[7px] text-[--text]">{robot.name}</p>
                  <ElementBadge element={robot.element} size="sm" />
                  <p className="font-pixel text-[6px] text-[--muted]">{robot.rarity}</p>
                </div>
              ))}
            </div>
          )}
        </PixelPanel>

        {/* Disconnect */}
        <PixelButton
          onClick={disconnect}
          className="w-full text-[--pyro] border-[--pyro]"
        >
          DISCONNECT WALLET
        </PixelButton>
      </div>
    </motion.div>
  );
}
