import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Element colors
        volt: {
          DEFAULT: '#00BFFF',   // Electric blue
          dark: '#0088CC',
          glow: '#66DFFF',
        },
        pyro: {
          DEFAULT: '#CC2200',   // Deep red
          dark: '#881100',
          glow: '#FF6644',
        },
        cryo: {
          DEFAULT: '#E8F4FF',   // Ice white
          dark: '#AAD4F0',
          glow: '#FFFFFF',
        },
        nano: {
          DEFAULT: '#00CC44',   // Toxic green
          dark: '#008833',
          glow: '#66FF88',
        },
        void: {
          DEFAULT: '#6600AA',   // Dark purple
          dark: '#440077',
          glow: '#AA44FF',
        },
        iron: {
          DEFAULT: '#888899',   // Metallic grey
          dark: '#555566',
          glow: '#BBBBCC',
        },
        // UI palette
        pixel: {
          bg: '#0A0A14',
          surface: '#12121E',
          border: '#2A2A44',
          accent: '#FFD700',
          text: '#E8E8FF',
          muted: '#888899',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        mono: ['"Courier New"', 'monospace'],
      },
      boxShadow: {
        pixel: '4px 4px 0px 0px rgba(0,0,0,0.8)',
        'pixel-inset': 'inset 2px 2px 0px 0px rgba(255,255,255,0.1)',
        volt: '0 0 12px rgba(0,191,255,0.6)',
        pyro: '0 0 12px rgba(204,34,0,0.6)',
        cryo: '0 0 12px rgba(232,244,255,0.6)',
        nano: '0 0 12px rgba(0,204,68,0.6)',
        void: '0 0 12px rgba(102,0,170,0.6)',
        iron: '0 0 12px rgba(136,136,153,0.6)',
      },
      animation: {
        'pixel-pulse': 'pixelPulse 1.5s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        pixelPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        glowPulse: {
          '0%, 100%': { filter: 'brightness(1)' },
          '50%': { filter: 'brightness(1.4)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
