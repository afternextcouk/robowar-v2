/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ROBOWAR brand palette
        rw: {
          bg: "#0a0a0f",
          surface: "#12121a",
          border: "#1e1e2e",
          accent: "#7c3aed",     // Purple (primary)
          "accent-glow": "#a855f7",
          gold: "#f59e0b",       // GMO / Gold
          eldr: "#06b6d4",       // ELDR / Cyan
          danger: "#ef4444",
          success: "#22c55e",
        },
        // Element colours
        volt: { DEFAULT: "#eab308", glow: "#fde047" },
        pyro: { DEFAULT: "#f97316", glow: "#fb923c" },
        cryo: { DEFAULT: "#38bdf8", glow: "#7dd3fc" },
        nano: { DEFAULT: "#34d399", glow: "#6ee7b7" },
        void: { DEFAULT: "#a78bfa", glow: "#c4b5fd" },
        iron: { DEFAULT: "#94a3b8", glow: "#cbd5e1" },
        // Biome colours
        grassland: "#4ade80",
        desert: "#f59e0b",
        snowfield: "#bae6fd",
        city: "#818cf8",
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
        ui: ["Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "battle-shake": "battle-shake 0.3s ease-in-out",
        "float": "float 3s ease-in-out infinite",
        "scanline": "scanline 8s linear infinite",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 5px currentColor" },
          "50%": { boxShadow: "0 0 20px currentColor, 0 0 40px currentColor" },
        },
        "battle-shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-4px)" },
          "40%": { transform: "translateX(4px)" },
          "60%": { transform: "translateX(-2px)" },
          "80%": { transform: "translateX(2px)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
      },
      backgroundImage: {
        "grid-rw": "linear-gradient(#1e1e2e 1px, transparent 1px), linear-gradient(90deg, #1e1e2e 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid-rw": "40px 40px",
      },
    },
  },
  plugins: [],
};
