/**
 * ROBOWAR V2 — Element Selection
 * 6 element cards with lore, stats, and visual themes.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, type ElementType } from '../store/gameStore';

// ─── Element definitions ──────────────────────────────────────────────────────

interface ElementDef {
  id: ElementType;
  name: string;
  icon: string;
  cssVar: string;
  tagline: string;
  description: string;
  stats: { speed: number; attack: number; defense: number; special: number };
  abilities: string[];
  weakness: ElementType;
  strength: ElementType;
}

const ELEMENTS: ElementDef[] = [
  {
    id: 'VOLT',
    name: 'VOLT',
    icon: '⚡',
    cssVar: '--volt',
    tagline: 'Speed of Lightning',
    description:
      'Harness electromagnetic pulses and chain-lightning attacks. VOLT pilots move first and can stun enemies.',
    stats: { speed: 95, attack: 70, defense: 55, special: 80 },
    abilities: ['Chain Lightning', 'EMP Pulse', 'Overclock', 'Discharge'],
    weakness: 'IRON',
    strength: 'CRYO',
  },
  {
    id: 'PYRO',
    name: 'PYRO',
    icon: '🔥',
    cssVar: '--pyro',
    tagline: 'Burn Everything',
    description:
      'Explosive force and area-of-effect burning attacks. PYRO builds up heat stacks to unleash devastating combos.',
    stats: { speed: 60, attack: 95, defense: 50, special: 75 },
    abilities: ['Inferno Blast', 'Heat Stack', 'Meltdown', 'Phoenix Core'],
    weakness: 'CRYO',
    strength: 'NANO',
  },
  {
    id: 'CRYO',
    name: 'CRYO',
    icon: '❄️',
    cssVar: '--cryo',
    tagline: 'Absolute Zero',
    description:
      'Freeze enemies and slow the battlefield. CRYO pilots can lock opponents in place and shatter frozen foes.',
    stats: { speed: 65, attack: 65, defense: 85, special: 85 },
    abilities: ['Freeze Ray', 'Ice Shield', 'Blizzard', 'Absolute Zero'],
    weakness: 'VOLT',
    strength: 'PYRO',
  },
  {
    id: 'NANO',
    name: 'NANO',
    icon: '🧬',
    cssVar: '--nano',
    tagline: 'Viral Corruption',
    description:
      'Deploy nanobots to corrupt enemy systems and self-repair. NANO pilots excel at sustained fights.',
    stats: { speed: 70, attack: 65, defense: 75, special: 90 },
    abilities: ['Nanobot Swarm', 'System Corrupt', 'Self-Repair', 'Overinfect'],
    weakness: 'PYRO',
    strength: 'VOID',
  },
  {
    id: 'VOID',
    name: 'VOID',
    icon: '🌑',
    cssVar: '--void',
    tagline: 'Dark Matter',
    description:
      'Warp space and absorb enemy energy. VOID pilots can phase through attacks and drain opponent stats.',
    stats: { speed: 75, attack: 80, defense: 60, special: 95 },
    abilities: ['Phase Shift', 'Void Drain', 'Dark Matter', 'Singularity'],
    weakness: 'NANO',
    strength: 'IRON',
  },
  {
    id: 'IRON',
    name: 'IRON',
    icon: '⚙️',
    cssVar: '--iron',
    tagline: 'Unbreakable Fortress',
    description:
      'Impenetrable armor and heavy-impact strikes. IRON pilots absorb enormous damage before counterattacking.',
    stats: { speed: 40, attack: 85, defense: 100, special: 55 },
    abilities: ['Iron Fist', 'Fortress Mode', 'Magnetic Pull', 'Core Overload'],
    weakness: 'VOID',
    strength: 'VOLT',
  },
];

// ─── Stat Bar ─────────────────────────────────────────────────────────────────

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-pixel text-[6px] text-[--muted] w-12 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-[--surface] pixel-border">
        <motion.div
          className="h-full"
          style={{ backgroundColor: `var(${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="font-pixel text-[6px] text-[--muted] w-6 text-right">{value}</span>
    </div>
  );
}

// ─── Element Card ─────────────────────────────────────────────────────────────

function ElementCard({
  elem,
  selected,
  onSelect,
}: {
  elem: ElementDef;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className={`
        pixel-border cursor-pointer p-4 space-y-3 relative overflow-hidden
        transition-all duration-150 select-none
        ${selected ? 'scale-105' : 'hover:scale-102'}
      `}
      style={{
        backgroundColor: selected
          ? `color-mix(in srgb, var(${elem.cssVar}) 15%, var(--surface))`
          : 'var(--surface)',
        borderColor: selected || hovered ? `var(${elem.cssVar})` : 'var(--border)',
        boxShadow: selected
          ? `0 0 16px var(${elem.cssVar}), 4px 4px 0 rgba(0,0,0,0.8)`
          : '4px 4px 0 rgba(0,0,0,0.8)',
      }}
      onClick={onSelect}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Selected indicator */}
      {selected && (
        <div
          className="absolute top-1 right-1 font-pixel text-[7px]"
          style={{ color: `var(${elem.cssVar})` }}
        >
          ✓ SELECTED
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{elem.icon}</span>
        <div>
          <h3
            className="font-pixel text-sm font-bold"
            style={{ color: `var(${elem.cssVar})` }}
          >
            {elem.name}
          </h3>
          <p className="font-pixel text-[7px] text-[--muted]">{elem.tagline}</p>
        </div>
      </div>

      {/* Description */}
      <AnimatePresence>
        {(selected || hovered) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="font-pixel text-[7px] text-[--text] leading-relaxed">
              {elem.description}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="space-y-1.5">
        <StatBar label="SPD" value={elem.stats.speed}   color={elem.cssVar} />
        <StatBar label="ATK" value={elem.stats.attack}  color={elem.cssVar} />
        <StatBar label="DEF" value={elem.stats.defense} color={elem.cssVar} />
        <StatBar label="SPL" value={elem.stats.special} color={elem.cssVar} />
      </div>

      {/* Matchups */}
      <div className="flex gap-4">
        <span className="font-pixel text-[6px] text-[--nano]">
          ▲ {elem.strength}
        </span>
        <span className="font-pixel text-[6px] text-[--pyro]">
          ▼ {elem.weakness}
        </span>
      </div>

      {/* Abilities */}
      <div className="flex flex-wrap gap-1">
        {elem.abilities.map((ab) => (
          <span
            key={ab}
            className="font-pixel text-[5px] px-1.5 py-0.5"
            style={{
              border: `1px solid var(${elem.cssVar})`,
              color: `var(${elem.cssVar})`,
              opacity: 0.7,
            }}
          >
            {ab}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ElementSelect() {
  const navigate = useNavigate();
  const { setSelectedElement } = useGameStore();
  const currentElement = useGameStore((s) => s.selectedElement);

  const [selected, setSelected] = useState<ElementType | null>(currentElement);

  const handleConfirm = () => {
    if (!selected) return;
    setSelectedElement(selected);
    navigate('/lobby');
  };

  return (
    <motion.div
      className="flex flex-col items-center w-full h-full bg-[--bg] overflow-y-auto py-8 px-4"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
    >
      <h1 className="font-pixel text-xs text-[--accent] mb-2 tracking-widest">
        CHOOSE YOUR ELEMENT
      </h1>
      <p className="font-pixel text-[8px] text-[--muted] mb-8 text-center">
        This determines your robot's fighting style and abilities.<br />
        Choose wisely — elements cannot be changed later.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl mb-8">
        {ELEMENTS.map((elem) => (
          <ElementCard
            key={elem.id}
            elem={elem}
            selected={selected === elem.id}
            onSelect={() => setSelected(elem.id)}
          />
        ))}
      </div>

      <motion.button
        className="pixel-btn px-12 py-3 text-[10px] mb-8"
        style={{
          borderColor: selected ? 'var(--accent)' : 'var(--border)',
          color: selected ? 'var(--accent)' : 'var(--muted)',
          opacity: selected ? 1 : 0.5,
        }}
        onClick={handleConfirm}
        disabled={!selected}
        whileHover={selected ? { scale: 1.02 } : {}}
        whileTap={selected ? { scale: 0.98 } : {}}
      >
        {selected ? `CONFIRM ${selected} →` : 'SELECT AN ELEMENT'}
      </motion.button>
    </motion.div>
  );
}
