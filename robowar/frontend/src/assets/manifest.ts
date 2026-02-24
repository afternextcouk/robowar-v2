/**
 * ROBOWAR V2 — Asset Manifest
 * ─────────────────────────────────────────────────────────────────────────────
 * Central registry for all game sprites.
 *
 * SOURCE PACK:  Marine Sosa — "Mech Assets"  (https://marinesosa.itch.io/mech-assets)
 * DRIVE FOLDER: https://drive.google.com/drive/folders/1MlZFVa8wkaTQ34zP9LbWTcyzwd8Q-ydx
 *
 * ⚠️  All paths are RELATIVE to `frontend/public/`.
 *     Place actual PNG files there after downloading the pack.
 *     See docs/ASSET_INTEGRATION_GUIDE.md for exact naming rules.
 */

// ─── Element / evolution types ────────────────────────────────────────────────

export type ElementType  = 'VOLT' | 'PYRO' | 'CRYO' | 'NANO' | 'VOID' | 'IRON';
export type EvoStage     = 1 | 2 | 3 | 4;
export type BiomeType    = 'city' | 'grassland' | 'snowfield' | 'desert';
export type UIAssetType  = 'button' | 'panel' | 'icon' | 'bar' | 'frame';
export type PilotLayer   = 'body' | 'hair' | 'clothes' | 'eyes' | 'accessory' | 'overlay';

// ─── Robot sprite manifest ────────────────────────────────────────────────────
//
// Convention:  assets/robots/<ELEMENT>/<ELEMENT>_evo<STAGE>.png
//              80 × 80 px · transparent background · sprite sheet (6 frames: idle, walk×2, attack×2, hit)

export interface RobotAsset {
  /** Path relative to `frontend/public/` */
  path:      string;
  /** Sprite sheet column count */
  cols:      number;
  /** Sprite sheet row count */
  rows:      number;
  /** Pixel width of a single frame */
  frameW:    number;
  /** Pixel height of a single frame */
  frameH:    number;
  /** Named frame indices: { idle: 0, walk: [1,2], attack: [3,4], hit: 5 } */
  frames:    Record<string, number | number[]>;
}

/** 36 robots (6 elements × 6 variants) × 4 evo stages */
const makeRobotEntry = (
  element: ElementType,
  variantIndex: number,
  evo: EvoStage,
): RobotAsset => ({
  path:   `assets/robots/${element.toLowerCase()}/${element.toLowerCase()}_v${variantIndex}_evo${evo}.png`,
  cols:   6,
  rows:   1,
  frameW: 80,
  frameH: 80,
  frames: { idle: 0, walk: [1, 2], attack: [3, 4], hit: 5 },
});

export type RobotManifestKey = `${ElementType}_${number}_evo${EvoStage}`;

/** Full robot manifest — keyed as  `"VOLT_1_evo2"` etc. */
export const ROBOT_MANIFEST: Record<RobotManifestKey, RobotAsset> = (() => {
  const map = {} as Record<string, RobotAsset>;
  const elements: ElementType[] = ['VOLT', 'PYRO', 'CRYO', 'NANO', 'VOID', 'IRON'];
  const evos: EvoStage[] = [1, 2, 3, 4];
  // 6 variants per element, 6 elements = 36 distinct robots
  elements.forEach((el) => {
    for (let v = 1; v <= 6; v++) {
      evos.forEach((evo) => {
        const key: RobotManifestKey = `${el}_${v}_evo${evo}`;
        map[key] = makeRobotEntry(el, v, evo);
      });
    }
  });
  return map as Record<RobotManifestKey, RobotAsset>;
})();

// ─── Tileset manifest ─────────────────────────────────────────────────────────
//
// Convention:  assets/tilesets/<biome>/<biome>_tileset.png
//              64 × 64 px tiles, packed in a single sprite sheet

export interface TilesetAsset {
  path:      string;
  tileW:     number;
  tileH:     number;
  /** Number of columns in the sheet */
  cols:      number;
  /** Number of rows in the sheet */
  rows:      number;
  /** Named tile indices (for semantic access) */
  tiles: {
    ground:   number;
    wall:     number;
    obstacle: number;
    water?:   number;
    special?: number[];
  };
}

export const TILESET_MANIFEST: Record<BiomeType, TilesetAsset> = {
  city: {
    path:  'assets/tilesets/city/city_tileset.png',
    tileW: 64,
    tileH: 64,
    cols:  8,
    rows:  4,
    tiles: { ground: 0, wall: 1, obstacle: 2, special: [8, 9, 10, 11] },
  },
  grassland: {
    path:  'assets/tilesets/grassland/grassland_tileset.png',
    tileW: 64,
    tileH: 64,
    cols:  8,
    rows:  4,
    tiles: { ground: 0, wall: 1, obstacle: 2, water: 8 },
  },
  snowfield: {
    path:  'assets/tilesets/snowfield/snowfield_tileset.png',
    tileW: 64,
    tileH: 64,
    cols:  8,
    rows:  4,
    tiles: { ground: 0, wall: 1, obstacle: 2, water: 9, special: [10, 11] },
  },
  desert: {
    path:  'assets/tilesets/desert/desert_tileset.png',
    tileW: 64,
    tileH: 64,
    cols:  8,
    rows:  4,
    tiles: { ground: 0, wall: 1, obstacle: 2, special: [8, 9] },
  },
};

// ─── UI kit manifest ──────────────────────────────────────────────────────────
//
// Convention:  assets/ui/<type>/<type>_<variant>.png
// The UI Kit atlas is a single packed sheet at assets/ui/ui_atlas.png.
// Individual regions are described below.

export interface UIRegion {
  /** Atlas path (all UI lives in one atlas) */
  atlas:  string;
  /** Frame rect within the atlas */
  x:      number;
  y:      number;
  width:  number;
  height: number;
}

export interface UIAsset {
  path?:    string;       // standalone PNG (optional)
  atlas?:   string;       // atlas sheet
  region?:  UIRegion;     // region in atlas
  variants: Record<string, UIRegion>;
}

const UI_ATLAS = 'assets/ui/ui_atlas.png';

export const UI_MANIFEST: Record<UIAssetType, UIAsset> = {
  button: {
    atlas: UI_ATLAS,
    variants: {
      default:  { atlas: UI_ATLAS, x:   0, y:   0, width: 128, height: 40 },
      hover:    { atlas: UI_ATLAS, x: 128, y:   0, width: 128, height: 40 },
      pressed:  { atlas: UI_ATLAS, x: 256, y:   0, width: 128, height: 40 },
      disabled: { atlas: UI_ATLAS, x: 384, y:   0, width: 128, height: 40 },
    },
  },
  panel: {
    atlas: UI_ATLAS,
    variants: {
      small:   { atlas: UI_ATLAS, x:   0, y:  40, width: 192, height: 120 },
      medium:  { atlas: UI_ATLAS, x: 192, y:  40, width: 320, height: 200 },
      large:   { atlas: UI_ATLAS, x:   0, y: 160, width: 480, height: 300 },
      tooltip: { atlas: UI_ATLAS, x: 480, y:  40, width: 160, height:  80 },
    },
  },
  icon: {
    atlas: UI_ATLAS,
    variants: {
      volt:  { atlas: UI_ATLAS, x:   0, y: 460, width: 32, height: 32 },
      pyro:  { atlas: UI_ATLAS, x:  32, y: 460, width: 32, height: 32 },
      cryo:  { atlas: UI_ATLAS, x:  64, y: 460, width: 32, height: 32 },
      nano:  { atlas: UI_ATLAS, x:  96, y: 460, width: 32, height: 32 },
      void:  { atlas: UI_ATLAS, x: 128, y: 460, width: 32, height: 32 },
      iron:  { atlas: UI_ATLAS, x: 160, y: 460, width: 32, height: 32 },
      eldr:  { atlas: UI_ATLAS, x: 192, y: 460, width: 32, height: 32 },
      heart: { atlas: UI_ATLAS, x: 224, y: 460, width: 32, height: 32 },
    },
  },
  bar: {
    atlas: UI_ATLAS,
    variants: {
      hp_fill:     { atlas: UI_ATLAS, x:   0, y: 492, width: 200, height: 16 },
      hp_track:    { atlas: UI_ATLAS, x: 200, y: 492, width: 200, height: 16 },
      energy_fill: { atlas: UI_ATLAS, x:   0, y: 508, width: 200, height: 16 },
      energy_track:{ atlas: UI_ATLAS, x: 200, y: 508, width: 200, height: 16 },
    },
  },
  frame: {
    atlas: UI_ATLAS,
    variants: {
      robot_card:  { atlas: UI_ATLAS, x:   0, y: 524, width: 120, height: 160 },
      pilot_card:  { atlas: UI_ATLAS, x: 120, y: 524, width:  80, height: 120 },
      battle_hud:  { atlas: UI_ATLAS, x: 200, y: 524, width: 480, height:  80 },
    },
  },
};

// ─── Pilot customization layers ───────────────────────────────────────────────
//
// Convention:  assets/pilots/<layer>/<layer>_<variant>.png
//              60 × 60 px per frame, transparent PNG layers that stack

export interface PilotLayerAsset {
  path:      string;
  frameW:    number;
  frameH:    number;
  variants:  string[];
}

export const PILOT_MANIFEST: Record<PilotLayer, PilotLayerAsset> = {
  body: {
    path:     'assets/pilots/body/',
    frameW:   60,
    frameH:   60,
    variants: ['light', 'dark', 'tan', 'pale'],
  },
  hair: {
    path:     'assets/pilots/hair/',
    frameW:   60,
    frameH:   60,
    variants: ['short_black', 'long_blonde', 'mohawk_red', 'bald', 'short_white', 'braids_brown'],
  },
  clothes: {
    path:     'assets/pilots/clothes/',
    frameW:   60,
    frameH:   60,
    variants: ['jumpsuit_blue', 'jacket_red', 'armor_grey', 'tech_green', 'casual_orange'],
  },
  eyes: {
    path:     'assets/pilots/eyes/',
    frameW:   60,
    frameH:   60,
    variants: ['default_brown', 'cyber_blue', 'red_rage', 'green_glow', 'white_void'],
  },
  accessory: {
    path:     'assets/pilots/accessory/',
    frameW:   60,
    frameH:   60,
    variants: ['none', 'goggles', 'helmet', 'visor_orange', 'eyepatch'],
  },
  overlay: {
    path:     'assets/pilots/overlay/',
    frameW:   60,
    frameH:   60,
    variants: ['none', 'scars', 'paint_war', 'paint_tech'],
  },
};

// ─── Manifest version ─────────────────────────────────────────────────────────

export const MANIFEST_VERSION = '1.0.0';

/** Quick existence check — returns true if the entry looks like a real on-disk file
 *  (i.e. non-placeholder path). At runtime the loader will test via PIXI.Assets. */
export function hasRobotAsset(element: ElementType, variantIndex: number, evo: EvoStage): boolean {
  const key: RobotManifestKey = `${element}_${variantIndex}_evo${evo}`;
  return key in ROBOT_MANIFEST;
}
