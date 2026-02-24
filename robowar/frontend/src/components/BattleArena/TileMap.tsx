/**
 * ROBOWAR V2 — Tile Map Renderer
 * Renders a 64×64-tile scrolling map for 4 biomes using PixiJS Graphics.
 * When real tileset textures are available, swap Graphics draws for sprites.
 */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { BiomeType } from '../../store/gameStore';

// ─── Biome palette definitions ────────────────────────────────────────────────

interface BiomePalette {
  ground:  number;
  accent:  number;
  feature: number;
  sky:     number;
  fog:     number;
  name:    string;
}

const BIOME_PALETTES: Record<BiomeType, BiomePalette> = {
  GRASSLAND: {
    ground:  0x2D5A1B,
    accent:  0x3D7A2B,
    feature: 0x1A3A10,
    sky:     0x0A1A06,
    fog:     0x0D2A08,
    name:    'SILICON FLATS',
  },
  DESERT: {
    ground:  0x8B6914,
    accent:  0xA07820,
    feature: 0x6B4F0E,
    sky:     0x1A0E00,
    fog:     0x2A1A00,
    name:    'SCORCH VALLEY',
  },
  SNOWFIELD: {
    ground:  0x8FAFCF,
    accent:  0xB0CFDF,
    feature: 0x6F8FAF,
    sky:     0x070F18,
    fog:     0x0A1620,
    name:    'CRYO WASTES',
  },
  CITY: {
    ground:  0x333344,
    accent:  0x444455,
    feature: 0x222233,
    sky:     0x040408,
    fog:     0x080810,
    name:    'NEO METROPOLIS',
  },
};

const TILE_SIZE = 64;

// ─── TileMap class ────────────────────────────────────────────────────────────

export default class TileMap {
  /**
   * Factory: creates and returns a fully-rendered Container.
   * Designed as a static factory so it can be awaited (future async texture load).
   */
  static async create(
    biome:   BiomeType,
    stageW:  number,
    stageH:  number,
  ): Promise<Container> {
    const palette = BIOME_PALETTES[biome];
    const container = new Container();
    container.label = `TileMap_${biome}`;

    const g = new Graphics();
    container.addChild(g);

    const cols = Math.ceil(stageW / TILE_SIZE) + 2;
    const rows = Math.ceil(stageH / TILE_SIZE) + 2;

    // ── Background sky gradient ──────────────────────────────────────────────
    g.rect(0, 0, stageW, stageH).fill(palette.sky);

    // ── Ground tiles ─────────────────────────────────────────────────────────
    const groundY = stageH * 0.45;   // horizon line

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const tileX = col * TILE_SIZE;
        const tileY = groundY + row * (TILE_SIZE * 0.5);
        const isAccent = (col + row) % 3 === 0;
        const tileColor = isAccent ? palette.accent : palette.ground;

        g.rect(tileX, tileY, TILE_SIZE - 1, TILE_SIZE * 0.5 - 1)
          .fill(tileColor);
      }
    }

    // ── Biome features ────────────────────────────────────────────────────────
    TileMap.drawBiomeFeatures(g, biome, palette, stageW, stageH, groundY);

    // ── Fog / atmospheric effect ──────────────────────────────────────────────
    g.rect(0, groundY - 8, stageW, 16)
      .fill({ color: palette.fog, alpha: 0.5 });

    // ── Biome name label ──────────────────────────────────────────────────────
    const labelStyle = new TextStyle({
      fontFamily: '"Press Start 2P", monospace',
      fontSize:   8,
      fill:       0xFFFFFF,
      alpha:      0.25,
    });
    const label = new Text({ text: palette.name, style: labelStyle });
    label.x = 8;
    label.y = 8;
    container.addChild(label);

    return container;
  }

  // ─── Biome-specific decorations ─────────────────────────────────────────────

  private static drawBiomeFeatures(
    g:       Graphics,
    biome:   BiomeType,
    palette: BiomePalette,
    stageW:  number,
    _stageH: number,
    groundY: number,
  ) {
    switch (biome) {
      case 'GRASSLAND':
        // Trees
        for (let i = 0; i < 6; i++) {
          const tx = (stageW / 7) * (i + 0.5);
          const ty = groundY - 20 - (i % 2) * 10;
          g.circle(tx, ty, 12 + (i % 3) * 4).fill(palette.feature);
          g.rect(tx - 3, ty, 6, 20).fill(0x3D2010);
        }
        break;

      case 'DESERT':
        // Dunes + heat shimmer lines
        for (let i = 0; i < 4; i++) {
          const dx = (stageW / 5) * (i + 0.7);
          g.ellipse(dx, groundY - 5, 40 + i * 10, 10).fill(palette.accent);
        }
        // Cacti
        for (let i = 0; i < 3; i++) {
          const cx = (stageW / 4) * (i + 0.5);
          g.rect(cx - 3, groundY - 28, 6, 28).fill(0x2D6820);
          g.rect(cx - 10, groundY - 20, 8, 4).fill(0x2D6820);
          g.rect(cx + 5, groundY - 24, 8, 4).fill(0x2D6820);
        }
        break;

      case 'SNOWFIELD':
        // Snow drifts
        for (let i = 0; i < 5; i++) {
          const sx = (stageW / 6) * (i + 0.5);
          g.ellipse(sx, groundY + 4, 50 + i * 8, 12).fill(0xD0E8F0);
        }
        // Ice shards
        for (let i = 0; i < 3; i++) {
          const ix = (stageW / 4) * (i + 0.8);
          g.poly([ix, groundY - 30, ix - 8, groundY, ix + 8, groundY]).fill(0xAADDFF);
        }
        break;

      case 'CITY':
        // Buildings skyline
        const buildingData = [
          { x: 0.08, w: 0.06, h: 0.3 },
          { x: 0.18, w: 0.04, h: 0.45 },
          { x: 0.25, w: 0.07, h: 0.25 },
          { x: 0.60, w: 0.05, h: 0.5 },
          { x: 0.70, w: 0.08, h: 0.35 },
          { x: 0.82, w: 0.04, h: 0.42 },
          { x: 0.90, w: 0.06, h: 0.28 },
        ];
        for (const b of buildingData) {
          const bx = stageW * b.x;
          const bh = groundY * b.h;
          const bw = stageW * b.w;
          g.rect(bx, groundY - bh, bw, bh).fill(palette.feature);
          // Windows
          for (let wy = 0; wy < bh - 10; wy += 12) {
            for (let wx = 0; wx < bw - 4; wx += 8) {
              if (Math.random() > 0.4) {
                g.rect(bx + wx + 2, groundY - bh + wy + 4, 4, 5)
                  .fill(Math.random() > 0.5 ? 0xFFDD44 : 0x4488FF);
              }
            }
          }
        }
        // Neon grid lines on ground
        for (let col = 0; col < stageW; col += 32) {
          g.rect(col, groundY, 1, stageW).fill({ color: 0x00BFFF, alpha: 0.15 });
        }
        break;
    }
  }
}
