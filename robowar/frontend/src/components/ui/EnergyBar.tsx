/**
 * ROBOWAR V2 — Energy Bar
 * Segmented energy display (like a battery indicator).
 */
import { motion } from 'framer-motion';

interface EnergyBarProps {
  energy:    number;
  maxEnergy: number;
  segments?: number;
  width?:    number | string;
  height?:   number;
  showText?: boolean;
  className?: string;
}

export default function EnergyBar({
  energy,
  maxEnergy,
  segments  = 5,
  width     = 120,
  height    = 8,
  showText  = false,
  className = '',
}: EnergyBarProps) {
  const filledCount = Math.round((energy / maxEnergy) * segments);

  return (
    <div className={`space-y-0.5 ${className}`}>
      {showText && (
        <div className="flex justify-between">
          <span className="font-pixel text-[6px] text-[--muted]">EN</span>
          <span className="font-pixel text-[6px] text-[--volt]">
            {energy}/{maxEnergy}
          </span>
        </div>
      )}

      <div
        className="flex gap-0.5"
        style={{ width, height }}
      >
        {Array.from({ length: segments }).map((_, i) => {
          const filled = i < filledCount;
          return (
            <motion.div
              key={i}
              className="flex-1 border border-[--border] relative overflow-hidden"
              style={{ height }}
              animate={{
                backgroundColor: filled ? 'var(--volt)' : 'var(--surface)',
              }}
              transition={{ duration: 0.2, delay: filled ? i * 0.05 : 0 }}
            >
              {filled && (
                <div className="absolute inset-x-0 top-0 h-1/2 bg-white/20" />
              )}
              {/* Pulse on last filled segment */}
              {filled && i === filledCount - 1 && (
                <motion.div
                  className="absolute inset-0 bg-white/30"
                  animate={{ opacity: [0, 0.4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
