import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@components": resolve(__dirname, "./src/components"),
      "@store": resolve(__dirname, "./src/store"),
      "@hooks": resolve(__dirname, "./src/hooks"),
      "@game": resolve(__dirname, "./src/game"),
      "@web3": resolve(__dirname, "./src/web3"),
      "@api": resolve(__dirname, "./src/api"),
      "@types": resolve(__dirname, "./src/types"),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      "/v2": {
        target: process.env.VITE_API_URL || "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "esnext",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ["pixi.js"],
          react: ["react", "react-dom", "react-router-dom"],
          web3: ["ethers", "wagmi", "viem"],
          ui: ["@tanstack/react-query", "zustand"],
        },
      },
    },
  },
});
