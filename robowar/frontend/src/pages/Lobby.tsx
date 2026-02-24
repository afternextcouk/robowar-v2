/**
 * ROBOWAR V2 — Main Lobby
 * World map with battle zones, player stats, and navigation.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import PixelPanel from '../components/ui/PixelPanel';
import PixelButton from '../components/ui/PixelButton';
import ElementBadge from '../components/ui/ElementBadge';
import HPBar from '../components/ui/HPBar';

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

export default function Lobby() {
  const navigate  = useNavigate();
  const { connect, joinLobby, leaveLobby } = useSocket();

  const pilot       = useGameStore((s) => s.pilot);
  const activeRobot = useGameStore((s) => s.activeRobot);
  const eldrBalance = useGameStore((s) => s.eldrBalance);
  const gmoBalance  = useGameStore((s) => s.gmoBalance);

  useEffect(() => {
    const sock = connect();
    sock.on('connect', () => joinLobby());
    return () => {
      leaveLobby();
    };
  }, [connect, joinLobby, leaveLobby]);

  const handleZoneClick = (zoneId: string, active: boolean) => {
    if (!active) return;
    const battleId = `${zoneId}_${Date.now()}`;
    navigate(`/battle/${battleId}`);
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
              <p className="font-pixel text-[8px] text-[--accent]">{pilot.name}</p>
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
            <span className="font-pixel text-[8px] text-[--nano]">{gmoBalance}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-pixel text-[6px] text-[--muted]">ELDR</span>
            <span className="font-pixel text-[8px] text-[--volt]">{eldrBalance}</span>
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
                <div className="text-[5px] opacity-70 mt-1">ENTER</div>
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
