# ROBOWAR V2 — Asset Integration Guide

> **For:** Yılmaz (when you download the Marine Sosa "Mech Assets" pack)  
> **Asset source:** https://marinesosa.itch.io/mech-assets  
> **Drive mirror:** https://drive.google.com/drive/folders/1MlZFVa8wkaTQ34zP9LbWTcyzwd8Q-ydx  
> **Written by:** Mehmet (Designer)  

---

## 1. Overview

The sprite loader (`spriteLoader.ts`) tries to load real PNGs from `frontend/public/assets/`.  
If a file is **missing**, it silently returns `null` and the game falls back to procedural
pixel-art robots — so the game is always playable regardless of which assets are installed.

You can install assets **incrementally**: start with the UI kit, then robots, then tilesets.

---

## 2. Where to Place Each File Type

All assets go into **`frontend/public/assets/`** (served as static files by Vite).

```
frontend/public/
└── assets/
    ├── robots/
    │   ├── volt/
    │   │   ├── volt_v1_evo1.png   ← element_variant_evoStage
    │   │   ├── volt_v1_evo2.png
    │   │   ├── volt_v1_evo3.png
    │   │   ├── volt_v1_evo4.png
    │   │   ├── volt_v2_evo1.png
    │   │   └── … (up to volt_v6_evo4.png = 24 files per element)
    │   ├── pyro/
    │   ├── cryo/
    │   ├── nano/
    │   ├── void/
    │   └── iron/
    ├── tilesets/
    │   ├── city/
    │   │   └── city_tileset.png
    │   ├── grassland/
    │   │   └── grassland_tileset.png
    │   ├── snowfield/
    │   │   └── snowfield_tileset.png
    │   └── desert/
    │       └── desert_tileset.png
    ├── ui/
    │   └── ui_atlas.png           ← single packed atlas
    └── pilots/
        ├── body/
        │   ├── body_light.png
        │   ├── body_dark.png
        │   ├── body_tan.png
        │   └── body_pale.png
        ├── hair/
        │   ├── hair_short_black.png
        │   ├── hair_long_blonde.png
        │   └── …
        ├── clothes/
        ├── eyes/
        ├── accessory/
        └── overlay/
```

> ⚠️ **Do NOT put assets in `frontend/src/assets/`** — that folder contains only
>    TypeScript code (manifest + loader). Static PNGs belong in `frontend/public/`.

---

## 3. Naming Convention

### 3.1 Robot Sprites

| Part           | Value                                              | Example            |
|----------------|----------------------------------------------------|--------------------|
| Directory      | `assets/robots/<element_lower>/`                   | `assets/robots/volt/` |
| Filename       | `<element_lower>_v<1-6>_evo<1-4>.png`             | `volt_v2_evo3.png` |
| Canvas size    | **80 × 80 px per frame**, 6 frames wide (480 × 80) | —                  |
| Frame order    | `idle | walk1 | walk2 | attack1 | attack2 | hit`   | —                  |

**Elements (lowercase):** `volt`, `pyro`, `cryo`, `nano`, `void`, `iron`  
**Variants:** 1–6 per element → **36 total robots**  
**Evo stages:** 1–4 → **144 total sprite sheets**

### 3.2 Tilesets

| Part        | Value                                         | Example                        |
|-------------|-----------------------------------------------|--------------------------------|
| Directory   | `assets/tilesets/<biome>/`                    | `assets/tilesets/city/`        |
| Filename    | `<biome>_tileset.png`                         | `city_tileset.png`             |
| Tile size   | **64 × 64 px**                                | —                              |
| Sheet size  | 8 columns × 4 rows = 32 tiles (512 × 256 px)  | —                              |
| Tile order  | Row 0: ground variants; Row 1: walls/obstacles; Row 2+: decorations | — |

**Biomes:** `city`, `grassland`, `snowfield`, `desert`

### 3.3 UI Atlas

| Part        | Value                               |
|-------------|-------------------------------------|
| Path        | `assets/ui/ui_atlas.png`            |
| Format      | Single packed sprite sheet (any size) |

See `src/assets/manifest.ts` → `UI_MANIFEST` for the exact `(x, y, w, h)` of each element.
If your actual atlas has different coordinates, update the manifest — it is the **single
source of truth**.

### 3.4 Pilot Layers

| Part        | Value                                              | Example                      |
|-------------|----------------------------------------------------|------------------------------|
| Directory   | `assets/pilots/<layer>/`                           | `assets/pilots/hair/`        |
| Filename    | `<layer>_<variant>.png`                            | `hair_short_black.png`       |
| Canvas size | **60 × 60 px**                                     | —                            |
| Format      | Transparent PNG, single pose                       | —                            |

**Layers:** `body`, `hair`, `clothes`, `eyes`, `accessory`, `overlay`

---

## 4. Sprite Sheet Format

- **Format:** PNG with transparency (no JPEG)
- **Tool:** Export from Aseprite → "Export Sprite Sheet" → Strip layout (horizontal)
  - Aseprite settings: *Frame width = 80 px, Frame height = 80 px, Strip (no border)*
- **Color depth:** 32-bit RGBA
- **Max sheet size:** 2048 × 2048 px (GPU safe limit)
- Each evo stage is a **separate PNG** — do NOT combine all stages into one mega-sheet

### Aseprite Export Steps

1. Open the `.aseprite` / `.ase` file.
2. File → Export Sprite Sheet.
3. Layout: Sheet Type = **By Rows**, Constraints = Fixed Width 80px.
4. Output: check "Export image", set filename to `<element>_v<n>_evo<n>.png`.
5. Un-check "Export data" (we don't use JSON atlas files).
6. Click Export.

---

## 5. After Adding New Assets

When you add or replace PNG files:

1. **Nothing to regenerate for existing paths** — the manifest already has all 144 robot
   paths pre-defined. Just drop the PNG in the right place and the loader finds it.

2. **If you add a NEW variant or biome** (beyond what's in the manifest):
   - Open `frontend/src/assets/manifest.ts`.
   - Add an entry to `ROBOT_MANIFEST`, `TILESET_MANIFEST`, `UI_MANIFEST`, or `PILOT_MANIFEST`.
   - TypeScript will catch any type mismatches at compile time.

3. **Run the dev server to test:**
   ```bash
   cd frontend
   npm run dev
   ```
   Open the BattleArena. Robots that have a valid PNG will use the sprite; others use
   the procedural fallback (still fully playable, just less pretty).

4. **Check the browser console** for any `[SpriteLoader]` warnings — they tell you
   exactly which files were not found.

---

## 6. UI Atlas Coordinate Tool

If the atlas coordinates in the manifest are wrong for your actual atlas, you can
quickly figure out the correct values using this one-liner (requires ImageMagick):

```bash
# Show all regions — manually map them from the atlas PNG
identify -verbose assets/ui/ui_atlas.png | grep Geometry
```

Or open the atlas in Aseprite and hover over each element to read coordinates.
Then update `UI_MANIFEST` in `manifest.ts`.

---

## 7. Checklist

- [ ] Robot PNGs placed: `assets/robots/<element>/`
- [ ] Tileset PNGs placed: `assets/tilesets/<biome>/`
- [ ] UI atlas placed: `assets/ui/ui_atlas.png`
- [ ] Pilot layer PNGs placed: `assets/pilots/<layer>/`
- [ ] `npm run dev` — no red errors in console
- [ ] Open `/battle` in browser — robots show real sprites (not grey procedural)
- [ ] Open `/pilot-creator` — pilot layer compositing works

---

*Last updated: 2026-02-24 · Mehmet (Designer) · ROBOWAR V2*
