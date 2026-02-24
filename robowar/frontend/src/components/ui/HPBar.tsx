/**
 * ROBOWAR V2 — HP Bar
 * Color-shifting health bar: green → blue → red as HP drops.
 */
import { motion } from 'framer-motion';

interface HPBarProps {
  hp:       number;
  maxHp:    number;
  width?:   number | string;
  height?:  number;
  showText?: boolean;
  className?: string;
}

function getHPColor(pct: number): string {
  if (pct > 0.6) return 'var(--nano)';    // green
  if (pct > 0.3) return 'var(--volt)';    // blue
  if (pct > 0.15) return 'var(--pyro)';   // red
  return 'var(--pyro)';                    // critical
}

export default function HPBar({
  hp,
  maxHp,
  width    = 120,
  height   = 8,
  showText = false,
  className = '',
}: HPBarProps) {
  const pct        = Math.max(0, Math.min(1, hp / maxHp));
  const fillColor  = getHPColor(pct);
  const isCritical = pct <= 0.15;

  return (
    <div className={`space-y-0.5 ${className}`}>
      {showText && (
        <div className="flex justify-between">
          <span className="font-pixel text-[6px] text-[--muted]">HP</span>
          <span
            className="font-pixel text-[6px]"
            style={{ color: fillColor }}
          >
            {hp}/{maxHp}
          </span>
        </div>
      )}

      <div
        className="relative bg-[--surface] border border-[--border] overflow-hidden"
        style={{ width, height }}
      >
        {/* Segmented ticks */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px bg-[--bg] opacity-50 z-10"
            style={{ left: `${(i + 1) * 10}%` }}
          />
        ))}

        {/* Fill */}
        <motion.div
          className="absolute inset-y-0 left-0"
          style={{
            backgroundColor: fillColor,
            animation:        isCritical ? 'pixelPulse 0.5s infinite' : undefined,
          }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />

        {/* Gloss */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-white/10 z-20" />
      </div>
    </div>
  );
}
