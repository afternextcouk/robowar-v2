/**
 * ROBOWAR V2 — Onboarding / MetaMask Connect
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useWallet } from '../hooks/useWallet';
import { useGameStore } from '../store/gameStore';

const LOGO_CHARS = ['R', 'O', 'B', 'O', 'W', 'A', 'R'];
const ELEMENT_COLORS = ['--volt', '--pyro', '--cryo', '--nano', '--void', '--iron', '--accent'];

export default function Onboarding() {
  const navigate = useNavigate();
  const { wallet, connect, isWrongNetwork, switchToRequiredChain } = useWallet();
  const pilot = useGameStore((s) => s.pilot);
  const isLoading = useGameStore((s) => s.isLoading);
  const error = useGameStore((s) => s.error);

  // Redirect if already connected
  useEffect(() => {
    if (wallet.isConnected) {
      if (pilot) {
        navigate('/lobby', { replace: true });
      } else {
        navigate('/pilot', { replace: true });
      }
    }
  }, [wallet.isConnected, pilot, navigate]);

  return (
    <motion.div
      className="flex flex-col items-center justify-center w-full h-full bg-[--bg] relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Animated background grid */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />

      {/* Scanline animation */}
      <div
        className="absolute w-full h-16 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"
        style={{ animation: 'scanline 8s linear infinite', zIndex: 1 }}
      />

      {/* Logo */}
      <motion.div
        className="flex gap-1 mb-12 z-10"
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        {LOGO_CHARS.map((char, i) => (
          <motion.span
            key={i}
            className="font-pixel text-4xl md:text-6xl font-bold"
            style={{ color: `var(${ELEMENT_COLORS[i]})` }}
            animate={{
              textShadow: [
                `0 0 8px var(${ELEMENT_COLORS[i]})`,
                `0 0 20px var(${ELEMENT_COLORS[i]})`,
                `0 0 8px var(${ELEMENT_COLORS[i]})`,
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.15 }}
          >
            {char}
          </motion.span>
        ))}
      </motion.div>

      {/* Subtitle */}
      <motion.p
        className="font-pixel text-xs text-[--muted] mb-2 z-10 tracking-widest"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        BLOCKCHAIN BATTLE ARENA
      </motion.p>
      <motion.p
        className="font-pixel text-[10px] text-[--accent] mb-16 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        V 2.0.0
      </motion.p>

      {/* Connect Panel */}
      <motion.div
        className="pixel-panel z-10 w-full max-w-sm space-y-6 text-center"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <h2 className="font-pixel text-xs text-[--text] tracking-wide">
          CONNECT PILOT
        </h2>
        <p className="font-pixel text-[9px] text-[--muted] leading-relaxed">
          Link your MetaMask wallet to enter<br />the arena and command your robots.
        </p>

        {error && (
          <div className="pixel-border border-[--pyro] bg-[--pyro]/10 p-3">
            <p className="font-pixel text-[8px] text-[--pyro] leading-relaxed">
              ⚠ {error}
            </p>
          </div>
        )}

        {isWrongNetwork ? (
          <button
            className="pixel-btn w-full elem-volt text-[10px] py-3"
            onClick={switchToRequiredChain}
          >
            ⚡ SWITCH NETWORK
          </button>
        ) : (
          <button
            className="pixel-btn w-full text-[10px] py-3"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
            onClick={connect}
            disabled={isLoading || wallet.isConnecting}
          >
            {isLoading || wallet.isConnecting ? (
              <span className="animate-pixel-pulse">CONNECTING...</span>
            ) : (
              '🦊 CONNECT METAMASK'
            )}
          </button>
        )}

        {/* MetaMask install prompt */}
        {typeof window !== 'undefined' && !window.ethereum && (
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noreferrer"
            className="font-pixel text-[8px] text-[--muted] underline hover:text-[--volt] block"
          >
            Install MetaMask →
          </a>
        )}
      </motion.div>

      {/* Footer */}
      <motion.p
        className="absolute bottom-4 font-pixel text-[7px] text-[--muted] z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        © 2026 ROBOWAR V2 — AFTERNEXT LABS
      </motion.p>
    </motion.div>
  );
}
