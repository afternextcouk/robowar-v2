/**
 * ROBOWAR V2 — PixelButton
 * Idle / hover / pressed states with pixel-art style.
 */
import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children:  ReactNode;
  variant?:  'default' | 'primary' | 'danger' | 'success' | 'ghost';
  size?:     'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?:   boolean;
  icon?:      string;
}

const VARIANT_STYLES: Record<string, string> = {
  default: 'border-[--border-2]   text-[--text]   hover:border-[--accent]  hover:text-[--accent]',
  primary: 'border-[--accent]     text-[--accent] hover:bg-[--accent]/10',
  danger:  'border-[--pyro]       text-[--pyro]   hover:bg-[--pyro]/10',
  success: 'border-[--nano]       text-[--nano]   hover:bg-[--nano]/10',
  ghost:   'border-transparent    text-[--muted]  hover:text-[--text]',
};

const SIZE_STYLES: Record<string, string> = {
  sm: 'text-[7px]  py-1 px-2',
  md: 'text-[9px]  py-2 px-4',
  lg: 'text-[10px] py-3 px-6',
};

export default function PixelButton({
  children,
  variant   = 'default',
  size      = 'md',
  fullWidth = false,
  loading   = false,
  icon,
  disabled,
  className = '',
  onClick,
  ...rest
}: PixelButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      className={`
        font-pixel bg-[--surface-2]
        border-2 outline outline-2 outline-offset-1 outline-transparent
        shadow-[4px_4px_0_rgba(0,0,0,0.7)]
        active:shadow-[2px_2px_0_rgba(0,0,0,0.7)]
        transition-colors duration-100 tracking-wide uppercase
        select-none cursor-pointer
        disabled:opacity-40 disabled:cursor-not-allowed
        ${VARIANT_STYLES[variant] ?? VARIANT_STYLES.default}
        ${SIZE_STYLES[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={isDisabled}
      onClick={onClick}
      whileHover={!isDisabled ? { y: -1, filter: 'brightness(1.2)' } : {}}
      whileTap={!isDisabled ? { y: 2, scale: 0.97, filter: 'brightness(0.9)' } : {}}
      {...(rest as object)}
    >
      <span className="flex items-center justify-center gap-2">
        {icon && <span>{icon}</span>}
        {loading ? (
          <span className="animate-pixel-pulse">LOADING...</span>
        ) : (
          children
        )}
      </span>
    </motion.button>
  );
}
