/**
 * ROBOWAR V2 — Main Lobby
 * World map with battle zones, player stats, and navigation.
 *
 * Real matchmaking wiring:
 *   • "FIND BATTLE" button → emit queue:join → listen match_found / matchmaking:matched
 *   • On match found     → navigate to /battle/:battleId
 *   • On cancel          → emit queue:leave
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { useAuthStore } from '../store/authStore';
import PixelPanel from '../components/ui/PixelPanel';
import PixelButton from '../components/ui/PixelButton';
import ElementBadge from '../components/ui/ElementBadge';
import HPBar from '../components/ui/HPBar';
import type { WsQueueMatched } from '../types';

const BATTLE_ZONES = [
  { id: 'ZONE_1', name: 'SILICON FLATS',  biome: 'GRASSLAND', x: 15, y: 20, active: true  },
  { id: 'ZONE_2', name: 'SCORCH VALLEY',  biome: 'DESERT',    x: 55, y: 35, active: true  },
  { id: 'ZONE_3', name: 'CRYO WASTES',    biome: 'SNOWFIELD', x: 30, y: 65, active: false },
  { id: 'ZONE_4', name: 'NEO METROPOLIS', biome: 'CITY',      x: 70, y: 60, active: true  },
];

const ZONE_COLORS = {
  GRASSLAND: 'var(--nano)',
  DESERT:    'var(--pyro)',
  SNOWFIELD: 'var(--cryo)',
  CITY:      'var(--volt)',
};

// ─── Matchmaking status ───────────────────────────────────────────────────────

type MatchStatus = 'IDLE' | 'SEARCHING' | 'MATCHED';

export default function Lobby() {
  const navigate  = useNavigate();
  const { connect, joinMatchmaking, leaveMatchmaking, socket } = useSocket();

  const pilot       = useGameStore((s) => s.pilot);
  const activeRobot = useGameStore((s) => s.activeRobot);
  const eldrBalance = useGameStore((s) => s.eldrBalance);
  const gmoBalance  = useGameStore((s) => s.gmoBalance);
  const authUser    = useAuthStore((s) => s.user);

  const [matchStatus, setMatchStatus] = useState<MatchStatus>('IDLE');
  const [searchingSince, setSearchingSince] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const sock = connect();

    // Matchmaking joined confirmation (backend: queue:updated)
    sock.on('queue:updated', () => {
      setMatchStatus('SEARCHING');
      setSearchingSince(Date.now());
    });

    // Also handle the aliased event name
    sock.on('matchmaking:joined', () => {
      setMatchStatus('SEARCHING');
      setSearchingSince(Date.now());
    });

    // Match found! (backend matchmaking.ts emits 'match_found')
    const handleMatchFound = (data: { battleId: string; opponent: unknown; startsAt: string }) => {
      setMatchStatus('MATCHED');
      navigate(`/battle/${data.battleId}`);
    };

    // Also handle typed alias
    const handleMatchmakingMatched = (data: WsQueueMatched) => {
      setMatchStatus('MATCHED');
      navigate(`/battle/${data.battle_id}`);
    };

    sock.on('match_found',          handleMatchFound);
    sock.on('matchmaking:matched',  handleMatchmakingMatched);

    return () => {
      sock.off('queue:updated');
      sock.off('matchmaking:joined');
      sock.off('match_found',         handleMatchFound);
      sock.off('matchmaking:matched', handleMatchmakingMatched);
      // Leave queue when navigating away
      leaveMatchmaking();
    };
  }, [connect, navigate, leaveMatchmaking]);

  // ── Elapsed timer while searching ─────────────────────────────────────────
  useEffect(() => {
    if (matchStatus !== 'SEARCHING' || !searchingSince) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - searchingSince) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [matchStatus, searchingSince]);

  // ── Find Battle ───────────────────────────────────────────────────────────
  const handleFindBattle = useCallback(() => {
    if (!activeRobot) return;
    joinMatchmaking({
      mode:         'RANKED',
      robot_id:     activeRobot.id,
      // algorithm_id is optional if not yet assigned
    });
    setMatchStatus('SEARCHING');
    setSearchingSince(Date.now());
    setElapsed(0);
  }, [activeRobot, joinMatchmaking]);

  // ── Cancel search ─────────────────────────────────────────────────────────
  const handleCancelSearch = useCallback(() => {
    leaveMatchmaking();
    setMatchStatus('IDLE');
    setSearchingSince(null);
    setElapsed(0);
  }, [leaveMatchmaking]);

  // ── Zone click (quick match into specific biome) ──────────────────────────
  const handleZoneClick = (zoneId: string, active: boolean) => {
    if (!active) return;
    handleFindBattle();
  };

  if (!pilot) return null;

  return (
    <motion.div
      className="flex w-full h-full bg-[--bg] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* ── Left Sidebar: Pilot Info ── */}
      <div className="w-64 flex-shrink-0 border-r-2 border-[--border] p-4 space-y-4 overflow-y-auto">
        <PixelPanel className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 bg-[--surface-2] pixel-border flex items-center justify-center">
              <span className="text-xl">🤖</span>
            </div>
            <div>
              <p className="font-pixel text-[8px] text-[--accent]">
                {authUser?.username ?? pilot.name}
              </p>
              <p className="font-pixel text-[6px] text-[--muted]">LVL {pilot.level}</p>
            </div>
          </div>
          {pilot.element && <ElementBadge element={pilot.element} />}
          <div className="flex justify-between">
            <span className="font-pixel text-[6px] text-[--nano]">W: {pilot.wins}</span>
            <span className="font-pixel text-[6px] text-[--pyro]">L: {pilot.losses}</span>
            <span className="font-pixel text-[6px] text-[--volt]">XP: {pilot.xp}</span>
          </div>
        </PixelPanel>

        {/* Balances */}
        <PixelPanel className="space-y-2">
          <p className="font-pixel text-[7px] text-[--accent]">BALANCES</p>
          <div className="flex justify-between items-center">
            <span className="font-pixel text-[6px] text-[--muted]">GMO</span>
            <span className="font-pixel text-[8px] text-[--nano]">
              {authUser?.gmo_balance ?? gmoBalance}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-pixel text-[6px] text-[--muted]">ELDR</span>
            <span className="font-pixel text-[8px] text-[--volt]">
              {authUser?.eldr_balance ?? eldrBalance}
            </span>
          </div>
        </PixelPanel>

        {/* Active Robot */}
        {activeRobot && (
          <PixelPanel className="space-y-2">
            <p className="font-pixel text-[7px] text-[--accent]">ACTIVE ROBOT</p>
            <p className="font-pixel text-[8px] text-[--text]">{activeRobot.name}</p>
            <ElementBadge element={activeRobot.element} size="sm" />
            <HPBar hp={activeRobot.stats.hp} maxHp={activeRobot.stats.maxHp} />
          </PixelPanel>
        )}

        {/* ── Matchmaking CTA ── */}
        <PixelPanel className="space-y-3">
          {matchStatus === 'IDLE' && (
            <PixelButton
              onClick={handleFindBattle}
              fullWidth
              disabled={!activeRobot}
            >
              ⚔ FIND BATTLE
            </PixelButton>
          )}

          {matchStatus === 'SEARCHING' && (
            <>
              <div className="text-center">
                <p className="font-pixel text-[7px] text-[--volt] animate-pulse">
                  SEARCHING... {elapsed}s
                </p>
                <p className="font-pixel text-[6px] text-[--muted] mt-1">
                  Looking for an opponent
                </p>
              </div>
              <PixelButton
                onClick={handleCancelSearch}
                fullWidth
                className="text-[--pyro] border-[--pyro]"
              >
                ✕ CANCEL
              </PixelButton>
            </>
          )}

          {matchStatus === 'MATCHED' && (
            <p className="font-pixel text-[7px] text-[--nano] text-center animate-pulse">
              ✅ MATCH FOUND!
            </p>
          )}
        </PixelPanel>

        {/* Navigation */}
        <div className="space-y-2">
          <PixelButton onClick={() => navigate('/market')} fullWidth>
            ROBOT MARKET
          </PixelButton>
          <PixelButton onClick={() => navigate('/profile')} fullWidth>
            PROFILE
          </PixelButton>
        </div>
      </div>

      {/* ── Main: World Map ── */}
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute top-4 left-4 z-10">
          <p className="font-pixel text-[8px] text-[--muted]">WORLD MAP</p>
          <p className="font-pixel text-[6px] text-[--muted]">SELECT A BATTLE ZONE</p>
        </div>

        {/* Map background */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 15% 20%, rgba(0,204,68,0.08) 0%, transparent 40%),
              radial-gradient(ellipse at 55% 35%, rgba(204,34,0,0.08) 0%, transparent 40%),
              radial-gradient(ellipse at 30% 65%, rgba(232,244,255,0.06) 0%, transparent 40%),
              radial-gradient(ellipse at 70% 60%, rgba(0,191,255,0.08) 0%, transparent 40%),
              var(--bg)
            `,
            backgroundImage: `
              linear-gradient(rgba(42,42,68,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(42,42,68,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Zone markers */}
        {BATTLE_ZONES.map((zone) => (
          <motion.button
            key={zone.id}
            className={`
              absolute transform -translate-x-1/2 -translate-y-1/2
              pixel-border px-3 py-2 font-pixel text-[7px]
              ${zone.active ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}
            `}
            style={{
              left: `${zone.x}%`,
              top:  `${zone.y}%`,
              borderColor: ZONE_COLORS[zone.biome as keyof typeof ZONE_COLORS],
              color:        ZONE_COLORS[zone.biome as keyof typeof ZONE_COLORS],
              background:   'var(--surface)',
            }}
            onClick={() => handleZoneClick(zone.id, zone.active)}
            whileHover={zone.active ? { scale: 1.1, zIndex: 10 } : {}}
            whileTap={zone.active ? { scale: 0.95 } : {}}
            animate={zone.active ? {
              boxShadow: [
                `0 0 4px ${ZONE_COLORS[zone.biome as keyof typeof ZONE_COLORS]}`,
                `0 0 12px ${ZONE_COLORS[zone.biome as keyof typeof ZONE_COLORS]}`,
                `0 0 4px ${ZONE_COLORS[zone.biome as keyof typeof ZONE_COLORS]}`,
              ],
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="text-center">
              <div className="text-base mb-1">
                {zone.biome === 'GRASSLAND' ? '🌿' :
                 zone.biome === 'DESERT'    ? '🏜️' :
                 zone.biome === 'SNOWFIELD' ? '❄️' : '🏙️'}
              </div>
              <div>{zone.name}</div>
              {zone.active && (
                <div className="text-[5px] opacity-70 mt-1">
                  {matchStatus === 'SEARCHING' ? '⚔ JOINING...' : 'ENTER'}
                </div>
              )}
              {!zone.active && (
                <div className="text-[5px] opacity-70 mt-1">LOCKED</div>
              )}
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
