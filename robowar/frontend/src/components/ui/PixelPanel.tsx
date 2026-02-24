/**
 * ROBOWAR V2 — PixelPanel
 * A panel with pixel-art style borders and optional title bar.
 */
import { type ReactNode } from 'react';
import { motion, type MotionProps } from 'framer-motion';

interface PixelPanelProps extends MotionProps {
  children:   ReactNode;
  title?:     string;
  accent?:    string;   // CSS custom property name e.g. '--volt'
  className?: string;
  noPadding?: boolean;
}

export default function PixelPanel({
  children,
  title,
  accent = '--border',
  className = '',
  noPadding = false,
  ...motionProps
}: PixelPanelProps) {
  return (
    <motion.div
      className={`
        relative bg-[--surface]
        border-2 border-[--border]
        outline outline-2 outline-offset-2 outline-[--border]
        shadow-[4px_4px_0_rgba(0,0,0,0.7)]
        ${noPadding ? '' : 'p-4'}
        ${className}
      `}
      style={{
        borderColor: `var(${accent})`,
      }}
      {...motionProps}
    >
      {/* Title bar */}
      {title && (
        <div
          className="absolute -top-3 left-3 px-2 bg-[--surface]"
        >
          <span
            className="font-pixel text-[7px]"
            style={{ color: `var(${accent})` }}
          >
            {title}
          </span>
        </div>
      )}

      {/* Top-left corner decoration */}
      <div
        className="absolute top-0 left-0 w-2 h-2"
        style={{ background: `var(${accent})`, opacity: 0.6 }}
      />
      {/* Top-right */}
      <div
        className="absolute top-0 right-0 w-2 h-2"
        style={{ background: `var(${accent})`, opacity: 0.6 }}
      />
      {/* Bottom-left */}
      <div
        className="absolute bottom-0 left-0 w-2 h-2"
        style={{ background: `var(${accent})`, opacity: 0.6 }}
      />
      {/* Bottom-right */}
      <div
        className="absolute bottom-0 right-0 w-2 h-2"
        style={{ background: `var(${accent})`, opacity: 0.6 }}
      />

      {/* Inner highlight */}
      <div className="absolute inset-[2px] border border-white/5 pointer-events-none" />

      {children}
    </motion.div>
  );
}
