/**
 * ROBOWAR V2 — Element Badge
 * Icon + label with element-specific color theme and optional glow.
 */
import { motion } from 'framer-motion';
import type { ElementType } from '../../store/gameStore';

interface ElementBadgeProps {
  element:   ElementType;
  size?:     'sm' | 'md' | 'lg';
  glow?:     boolean;
  showLabel?: boolean;
  className?: string;
}

const ELEMENT_META: Record<ElementType, { icon: string; cssVar: string; label: string }> = {
  VOLT: { icon: '⚡', cssVar: '--volt', label: 'VOLT' },
  PYRO: { icon: '🔥', cssVar: '--pyro', label: 'PYRO' },
  CRYO: { icon: '❄️', cssVar: '--cryo', label: 'CRYO' },
  NANO: { icon: '🧬', cssVar: '--nano', label: 'NANO' },
  VOID: { icon: '🌑', cssVar: '--void', label: 'VOID' },
  IRON: { icon: '⚙️', cssVar: '--iron', label: 'IRON' },
};

const SIZE_STYLES = {
  sm: { icon: 'text-sm',  text: 'text-[6px]', px: 'px-1.5 py-0.5', gap: 'gap-1' },
  md: { icon: 'text-base', text: 'text-[8px]', px: 'px-2 py-1',     gap: 'gap-1.5' },
  lg: { icon: 'text-xl',  text: 'text-xs',    px: 'px-3 py-1.5',   gap: 'gap-2' },
};

export default function ElementBadge({
  element,
  size      = 'md',
  glow      = false,
  showLabel = true,
  className = '',
}: ElementBadgeProps) {
  const meta   = ELEMENT_META[element];
  const styles = SIZE_STYLES[size];
  const color  = `var(${meta.cssVar})`;

  return (
    <motion.span
      className={`
        inline-flex items-center
        border font-pixel
        ${styles.icon} ${styles.px} ${styles.gap}
        ${className}
      `}
      style={{
        borderColor:     color,
        color,
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
        boxShadow:        glow ? `0 0 8px ${color}` : undefined,
      }}
      animate={glow ? {
        boxShadow: [
          `0 0 4px ${color}`,
          `0 0 12px ${color}`,
          `0 0 4px ${color}`,
        ],
      } : {}}
      transition={glow ? { duration: 2, repeat: Infinity } : {}}
    >
      <span>{meta.icon}</span>
      {showLabel && (
        <span className={styles.text}>{meta.label}</span>
      )}
    </motion.span>
  );
}
