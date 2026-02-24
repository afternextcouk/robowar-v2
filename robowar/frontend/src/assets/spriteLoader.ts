/**
 * ROBOWAR V2 — Sprite Loader
 * ─────────────────────────────────────────────────────────────────────────────
 * PixiJS v8 asset loader with graceful fallback.
 *
 * Workflow:
 *   1. Try to load the real PNG from the asset manifest.
 *   2. If the file is missing (404 / not placed yet), silently return null.
 *   3. Callers fall back to the existing procedural Graphics robot.
 *
 * All methods are safe to call even if the asset pack has NOT been installed.
 */

import { Assets, Texture, Rectangle } from 'pixi.js';
import {
  ROBOT_MANIFEST,
  TILESET_MANIFEST,
  UI_MANIFEST,
  type ElementType,
  type EvoStage,
  type BiomeType,
  type UIAssetType,
  type RobotManifestKey,
  type TilesetAsset,
  type UIRegion,
} from './manifest';

// ─── Cache maps ───────────────────────────────────────────────────────────────

const _robotCache = new Map<string, Texture | null>();
const _tileCache  = new Map<string, Record<string, Texture> | null>();
const _uiCache    = new Map<string, Texture | null>();
const _atlasCache = new Map<string, Texture | null>();

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Attempt to load a texture from a public-root path.
 * Returns null if the fetch fails (file not found, network error, etc.)
 */
async function safeLoadTexture(path: string): Promise<Texture | null> {
  if (_atlasCache.has(path)) return _atlasCache.get(path)!;

  try {
    const texture = await Assets.load<Texture>(path);
    if (!texture || texture === Texture.EMPTY) {
      _atlasCache.set(path, null);
      return null;
    }
    _atlasCache.set(path, texture);
    return texture;
  } catch {
    // File not yet placed — silent fallback
    _atlasCache.set(path, null);
    return null;
  }
}

/**
 * Slice a region out of an atlas texture.
 */
function sliceRegion(atlas: Texture, x: number, y: number, w: number, h: number): Texture {
  // PixiJS v8: Texture.source is TextureSource (BaseTexture removed in v8)
  return new Texture({
    source: atlas.source,
    frame:  new Rectangle(x, y, w, h),
  });
}

// ─── Robot sprite loader ──────────────────────────────────────────────────────

export interface RobotTextureSet {
  /** Idle pose — frame 0 */
  idle:    Texture;
  /** Walking frames */
  walk:    Texture[];
  /** Attack frames */
  attack:  Texture[];
  /** Hit / damage frame */
  hit:     Texture;
}

/**
 * Load the sprite sheet for a robot.
 *
 * @param element       - Element type (VOLT | PYRO | …)
 * @param evo           - Evolution stage (1–4)
 * @param variantIndex  - Variant within element (1–6, defaults to 1)
 * @returns  RobotTextureSet if the sprite sheet exists, otherwise null.
 */
export async function loadRobotSprite(
  element: ElementType,
  evo: EvoStage,
  variantIndex = 1,
): Promise<RobotTextureSet | null> {
  const cacheKey = `${element}_${variantIndex}_evo${evo}`;
  if (_robotCache.has(cacheKey)) {
    // Already tried; if null, sprite wasn't found
    const cached = _robotCache.get(cacheKey);
    return cached ? buildRobotTextureSet(cached, cacheKey) : null;
  }

  const key = `${element}_${variantIndex}_evo${evo}` as RobotManifestKey;
  const entry = ROBOT_MANIFEST[key];
  if (!entry) {
    _robotCache.set(cacheKey, null);
    return null;
  }

  const sheet = await safeLoadTexture(entry.path);
  if (!sheet) {
    _robotCache.set(cacheKey, null);
    return null;
  }

  _robotCache.set(cacheKey, sheet);
  return buildRobotTextureSet(sheet, cacheKey);
}

function buildRobotTextureSet(sheet: Texture, cacheKey: string): RobotTextureSet {
  // Recover manifest entry from cacheKey (element_variant_evoN)
  const parts   = cacheKey.split('_');
  const el      = parts[0] as ElementType;
  const v       = parseInt(parts[1], 10);
  const evo     = parseInt(parts[2].replace('evo', ''), 10) as EvoStage;
  const entry   = ROBOT_MANIFEST[`${el}_${v}_evo${evo}` as RobotManifestKey];

  const { frameW, frameH } = entry;
  const frameFor = (idx: number) =>
    sliceRegion(sheet, idx * frameW, 0, frameW, frameH);

  const { idle, walk, attack, hit } = entry.frames as {
    idle:   number;
    walk:   number[];
    attack: number[];
    hit:    number;
  };

  return {
    idle:   frameFor(idle),
    walk:   (walk   as number[]).map(frameFor),
    attack: (attack as number[]).map(frameFor),
    hit:    frameFor(hit),
  };
}

// ─── Tileset loader ───────────────────────────────────────────────────────────

export interface TileTextureMap {
  ground:   Texture;
  wall:     Texture;
  obstacle: Texture;
  water?:   Texture;
  special?: Texture[];
  /** Full sheet in case caller needs custom slicing */
  sheet:    Texture;
  meta:     TilesetAsset;
}

/**
 * Load all named tiles for a biome.
 * Returns null if the tileset PNG has not been placed yet.
 */
export async function loadTileset(biome: BiomeType): Promise<TileTextureMap | null> {
  if (_tileCache.has(biome)) return _tileCache.get(biome) ?? null;

  const entry = TILESET_MANIFEST[biome];
  const sheet = await safeLoadTexture(entry.path);
  if (!sheet) {
    _tileCache.set(biome, null);
    return null;
  }

  const { tileW, tileH, cols } = entry;
  const tileAt = (index: number): Texture => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return sliceRegion(sheet, col * tileW, row * tileH, tileW, tileH);
  };

  const map: TileTextureMap = {
    ground:   tileAt(entry.tiles.ground),
    wall:     tileAt(entry.tiles.wall),
    obstacle: tileAt(entry.tiles.obstacle),
    water:    entry.tiles.water !== undefined ? tileAt(entry.tiles.water) : undefined,
    special:  entry.tiles.special?.map(tileAt),
    sheet,
    meta:     entry,
  };

  _tileCache.set(biome, map);
  return map;
}

// ─── UI asset loader ──────────────────────────────────────────────────────────

/**
 * Load a single UI texture (button, panel, icon, bar, frame) by type + variant.
 * Returns null if the atlas PNG is not present yet.
 *
 * @example
 *   const tex = await loadUIAsset('button', 'hover');
 */
export async function loadUIAsset(
  type: UIAssetType,
  variant: string,
): Promise<Texture | null> {
  const uiKey = `${type}_${variant}`;
  if (_uiCache.has(uiKey)) return _uiCache.get(uiKey) ?? null;

  const entry  = UI_MANIFEST[type];
  const region = entry?.variants[variant] as UIRegion | undefined;
  if (!region) {
    _uiCache.set(uiKey, null);
    return null;
  }

  const atlas = await safeLoadTexture(region.atlas);
  if (!atlas) {
    _uiCache.set(uiKey, null);
    return null;
  }

  const tex = sliceRegion(atlas, region.x, region.y, region.width, region.height);
  _uiCache.set(uiKey, tex);
  return tex;
}

// ─── Pilot layer loader ───────────────────────────────────────────────────────

import {
  PILOT_MANIFEST,
  type PilotLayer,
} from './manifest';

/**
 * Load a single pilot sprite layer (body, hair, clothes, …) by layer + variant.
 * Returns null if the file is not present yet.
 *
 * @example
 *   const bodyTex = await loadPilotLayer('body', 'light');
 */
export async function loadPilotLayer(
  layer: PilotLayer,
  variant: string,
): Promise<Texture | null> {
  const layerEntry = PILOT_MANIFEST[layer];
  if (!layerEntry || !layerEntry.variants.includes(variant)) return null;

  const path = `${layerEntry.path}${layer}_${variant}.png`;
  const cacheKey = `pilot_${layer}_${variant}`;

  if (_uiCache.has(cacheKey)) return _uiCache.get(cacheKey) ?? null;

  const tex = await safeLoadTexture(path);
  _uiCache.set(cacheKey, tex);
  return tex;
}

// ─── Prefetch helpers ─────────────────────────────────────────────────────────

/**
 * Warm the cache for a specific element × evo stage (all 6 variants).
 * Call this during a loading screen.
 */
export async function prefetchRobotElement(element: ElementType, evo: EvoStage): Promise<void> {
  const promises: Promise<unknown>[] = [];
  for (let v = 1; v <= 6; v++) {
    promises.push(loadRobotSprite(element, evo, v));
  }
  await Promise.allSettled(promises);
}

/**
 * Warm the UI atlas cache.
 */
export async function prefetchUIAtlas(): Promise<void> {
  await safeLoadTexture('assets/ui/ui_atlas.png');
}

/**
 * Clear all loader caches (useful on hot-reload / dev mode).
 */
export function clearSpriteCache(): void {
  _robotCache.clear();
  _tileCache.clear();
  _uiCache.clear();
  _atlasCache.clear();
}
