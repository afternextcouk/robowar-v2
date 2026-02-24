/**
 * ROBOWAR V2 — PixiJS Application Wrapper
 * Manages PIXI.Application lifecycle, canvas resize, and render loop.
 */
import { useEffect, useRef, useCallback } from 'react';
import { Application, Container } from 'pixi.js';
import TileMap from './TileMap';
import RobotSprite from './RobotSprite';
import type { BiomeType, ElementType } from '../../store/gameStore';
import type { BattlePhase } from '../../hooks/useBattle';

interface PixiStageProps {
  width?:         number;
  height?:        number;
  biome?:         BiomeType;
  myRobotId?:     string;
  enemyRobotId?:  string;
  myElement?:     ElementType;
  phase:          BattlePhase;
}

export default function PixiStage({
  width,
  height,
  biome = 'GRASSLAND',
  myRobotId,
  enemyRobotId,
  myElement = 'VOLT',
  phase,
}: PixiStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef       = useRef<Application | null>(null);
  const worldRef     = useRef<Container | null>(null);

  // ── Init PIXI Application ──────────────────────────────────────────────────
  const initPixi = useCallback(async () => {
    if (!containerRef.current || appRef.current) return;

    const container = containerRef.current;
    const w = width  ?? container.clientWidth  || 800;
    const h = height ?? container.clientHeight || 600;

    const app = new Application();
    await app.init({
      width:           w,
      height:          h,
      backgroundColor: 0x0A0A14,
      antialias:       false,   // pixel-art: no anti-aliasing
      resolution:      window.devicePixelRatio || 1,
      autoDensity:     true,
      hello:           false,
    });

    // Pixel-art rendering
    app.renderer.canvas.style.imageRendering = 'pixelated';
    container.appendChild(app.renderer.canvas);
    appRef.current = app;

    // World container (handles camera offset)
    const world = new Container();
    app.stage.addChild(world);
    worldRef.current = world;

    // Build scene
    await buildScene(app, world, biome, myElement, w, h);

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!appRef.current || !container) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      appRef.current.renderer.resize(nw, nh);
    });
    ro.observe(container);

    // Cleanup ref
    (app as unknown as { _resizeObserver: ResizeObserver })._resizeObserver = ro;
  }, [width, height, biome, myElement]);

  useEffect(() => {
    initPixi();
    return () => {
      if (appRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appRef.current as any)._resizeObserver?.disconnect();
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [initPixi]);

  // ── Animate phase changes ──────────────────────────────────────────────────
  useEffect(() => {
    if (!appRef.current || !worldRef.current) return;
    if (phase === 'COUNTDOWN') {
      // Flash stage
      let flashes = 0;
      const ticker = appRef.current.ticker.add(() => {
        if (!worldRef.current) return;
        worldRef.current.alpha = flashes % 2 === 0 ? 0.6 : 1;
        flashes++;
        if (flashes > 6) {
          worldRef.current.alpha = 1;
          appRef.current?.ticker.remove(ticker as unknown as () => void);
        }
      });
    }
  }, [phase]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: '#0A0A14' }}
    />
  );
}

// ─── Scene builder ────────────────────────────────────────────────────────────

async function buildScene(
  app:       Application,
  world:     Container,
  biome:     BiomeType,
  myElement: ElementType,
  stageW:    number,
  stageH:    number,
) {
  // Tile map layer
  const tileMap = await TileMap.create(biome, stageW, stageH);
  world.addChild(tileMap);

  // My robot (left side)
  const mySprite = await RobotSprite.create({
    element:    myElement,
    isEnemy:    false,
    hp:         100,
    maxHp:      100,
    x:          stageW * 0.25,
    y:          stageH * 0.55,
    flipX:      false,
  });
  world.addChild(mySprite);

  // Enemy robot (right side)
  const enemySprite = await RobotSprite.create({
    element:    'IRON',
    isEnemy:    true,
    hp:         100,
    maxHp:      100,
    x:          stageW * 0.75,
    y:          stageH * 0.55,
    flipX:      true,
  });
  world.addChild(enemySprite);

  // Idle animation ticker
  let t = 0;
  app.ticker.add(() => {
    t += 0.04;
    mySprite.y    = stageH * 0.55 + Math.sin(t) * 3;
    enemySprite.y = stageH * 0.55 + Math.sin(t + Math.PI) * 3;
  });
}
