/**
 * ROBOWAR V2 — Pilot Creator
 * 60×60 pixel-art layered character editor with live canvas composite preview.
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore, type PilotLayer, type PilotAppearance } from '../store/gameStore';

// ─── Layer metadata ───────────────────────────────────────────────────────────

const LAYERS: { key: PilotLayer; label: string; variants: number; zIndex: number }[] = [
  { key: 'body',     label: 'BODY',     variants: 4, zIndex: 1 },
  { key: 'clothes',  label: 'CLOTHES',  variants: 6, zIndex: 2 },
  { key: 'hair',     label: 'HAIR',     variants: 8, zIndex: 5 },
  { key: 'eyebrows', label: 'BROWS',    variants: 4, zIndex: 4 },
  { key: 'eyes',     label: 'EYES',     variants: 5, zIndex: 3 },
  { key: 'nose',     label: 'NOSE',     variants: 3, zIndex: 3 },
  { key: 'mouth',    label: 'MOUTH',    variants: 4, zIndex: 3 },
];

const HAIR_COLORS = [
  '#2C1810', '#4A2E19', '#8B4513', '#C19A6B',
  '#F5DEB3', '#FFD700', '#FF6B35', '#E91E8C',
  '#00BCD4', '#9C27B0', '#607D8B', '#F44336',
];

const CANVAS_SIZE = 240; // 60×60 grid rendered at 4× scale → 240px

// ─── Pixel painter helper (draws colored rectangle) ──────────────────────────

function drawLayerPlaceholder(
  ctx: CanvasRenderingContext2D,
  layer: PilotLayer,
  variant: number,
  hairColor: string
) {
  const scale = CANVAS_SIZE / 60;

  // Color per layer type
  const colorMap: Record<PilotLayer, string> = {
    body:     '#C8A882',
    clothes:  ['#1565C0', '#C62828', '#2E7D32', '#6A1B9A', '#E65100', '#37474F'][variant % 6],
    hair:     hairColor,
    eyebrows: '#2C1810',
    eyes:     ['#4FC3F7', '#81C784', '#F48FB1', '#FFB74D', '#CE93D8'][variant % 5],
    nose:     '#B08060',
    mouth:    '#C2185B',
  };

  const color = colorMap[layer];

  // Rough body-part positions (60×60 grid coords)
  const regions: Record<PilotLayer, [number, number, number, number][]> = {
    body:     [[15, 28, 30, 32]],
    clothes:  [[13, 30, 34, 22]],
    hair:     [[14, 6, 32, 16 + variant * 1]],
    eyebrows: [[17, 22, 5, 2], [38, 22, 5, 2]],
    eyes:     [[18, 25, 6, 5], [36, 25, 6, 5]],
    nose:     [[28, 32, 4, 4]],
    mouth:    [[22, 40, 16, 4]],
  };

  ctx.fillStyle = color;
  for (const [x, y, w, h] of regions[layer]) {
    ctx.fillRect(x * scale, y * scale, w * scale, h * scale);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PilotCreator() {
  const navigate = useNavigate();
  const { setPilot, wallet } = useGameStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [name, setName] = useState('');
  const [hairColor, setHairColor] = useState(HAIR_COLORS[0]);
  const [layers, setLayers] = useState<Record<PilotLayer, number>>(
    Object.fromEntries(LAYERS.map((l) => [l.key, 0])) as Record<PilotLayer, number>
  );
  const [activeLayer, setActiveLayer] = useState<PilotLayer>('body');
  const [nameError, setNameError] = useState('');

  // ── Canvas render ─────────────────────────────────────────────────────────

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Background
    ctx.fillStyle = '#1A1A2E';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw pixel grid (subtle)
    ctx.strokeStyle = 'rgba(42,42,68,0.4)';
    ctx.lineWidth = 0.5;
    const step = CANVAS_SIZE / 60;
    for (let x = 0; x <= CANVAS_SIZE; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_SIZE); ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_SIZE; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_SIZE, y); ctx.stroke();
    }

    // Draw layers in z-order
    const sorted = [...LAYERS].sort((a, b) => a.zIndex - b.zIndex);
    for (const layer of sorted) {
      drawLayerPlaceholder(ctx, layer.key, layers[layer.key], hairColor);
    }

    // Selection indicator
    ctx.strokeStyle = 'rgba(255,215,0,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, CANVAS_SIZE - 2, CANVAS_SIZE - 2);
  }, [layers, hairColor]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // ── Layer controls ────────────────────────────────────────────────────────

  const cycleVariant = (layer: PilotLayer, dir: 1 | -1) => {
    const max = LAYERS.find((l) => l.key === layer)!.variants;
    setLayers((prev) => ({
      ...prev,
      [layer]: ((prev[layer] + dir + max) % max),
    }));
  };

  // ── Confirm ───────────────────────────────────────────────────────────────

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      setNameError('Name must be at least 2 characters');
      return;
    }
    if (trimmed.length > 16) {
      setNameError('Name must be 16 characters or less');
      return;
    }

    const appearance: PilotAppearance = { layers, hairColor };

    setPilot({
      id: `pilot_${wallet.address?.slice(2, 10)}`,
      name: trimmed,
      appearance,
      element: null,
      xp: 0,
      level: 1,
      wins: 0,
      losses: 0,
      createdAt: Date.now(),
    });

    navigate('/element');
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="flex flex-col items-center justify-start w-full h-full bg-[--bg] overflow-y-auto py-8 px-4"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
    >
      <h1 className="font-pixel text-xs text-[--accent] mb-8 tracking-widest">
        CREATE YOUR PILOT
      </h1>

      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-4xl">

        {/* Canvas Preview */}
        <div className="flex flex-col items-center gap-4 flex-shrink-0">
          <div className="pixel-border p-2">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="block"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          <p className="font-pixel text-[8px] text-[--muted]">LIVE PREVIEW</p>
        </div>

        {/* Controls */}
        <div className="flex-1 space-y-4">

          {/* Name input */}
          <div className="pixel-panel space-y-2">
            <label className="font-pixel text-[8px] text-[--accent] block">
              PILOT NAME
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(''); }}
              maxLength={16}
              placeholder="Enter name..."
              className="
                w-full bg-[--surface-2] pixel-border px-3 py-2
                font-pixel text-[10px] text-[--text] outline-none
                placeholder:text-[--muted] focus:border-[--accent]
              "
            />
            {nameError && (
              <p className="font-pixel text-[7px] text-[--pyro]">{nameError}</p>
            )}
            <p className="font-pixel text-[7px] text-[--muted]">
              {name.length}/16
            </p>
          </div>

          {/* Layer selectors */}
          <div className="pixel-panel space-y-3">
            <p className="font-pixel text-[8px] text-[--accent]">APPEARANCE</p>

            {LAYERS.map((layer) => (
              <div
                key={layer.key}
                className={`flex items-center gap-3 cursor-pointer p-1 ${
                  activeLayer === layer.key ? 'bg-[--border]' : ''
                }`}
                onClick={() => setActiveLayer(layer.key)}
              >
                <span className="font-pixel text-[7px] text-[--muted] w-14 flex-shrink-0">
                  {layer.label}
                </span>

                <button
                  className="pixel-btn text-[8px] px-2 py-1"
                  onClick={(e) => { e.stopPropagation(); cycleVariant(layer.key, -1); }}
                >
                  ◀
                </button>

                <span className="font-pixel text-[8px] text-[--text] flex-1 text-center">
                  {layers[layer.key] + 1} / {layer.variants}
                </span>

                <button
                  className="pixel-btn text-[8px] px-2 py-1"
                  onClick={(e) => { e.stopPropagation(); cycleVariant(layer.key, 1); }}
                >
                  ▶
                </button>
              </div>
            ))}
          </div>

          {/* Hair color picker */}
          <div className="pixel-panel space-y-3">
            <p className="font-pixel text-[8px] text-[--accent]">HAIR COLOR</p>
            <div className="flex flex-wrap gap-2">
              {HAIR_COLORS.map((color) => (
                <button
                  key={color}
                  className={`w-7 h-7 pixel-border transition-transform ${
                    hairColor === color
                      ? 'scale-110 outline outline-2 outline-[--accent]'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setHairColor(color)}
                  title={color}
                />
              ))}
              {/* Custom color input */}
              <label className="w-7 h-7 pixel-border cursor-pointer flex items-center justify-center hover:scale-105">
                <span className="font-pixel text-[6px] text-[--muted]">+</span>
                <input
                  type="color"
                  className="sr-only"
                  value={hairColor}
                  onChange={(e) => setHairColor(e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* Confirm button */}
          <button
            className="pixel-btn w-full py-3 text-[10px]"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
            onClick={handleConfirm}
          >
            CHOOSE ELEMENT →
          </button>
        </div>
      </div>
    </motion.div>
  );
}
