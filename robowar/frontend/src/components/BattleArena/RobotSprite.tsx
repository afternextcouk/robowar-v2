/**
 * ROBOWAR V2 — Robot Sprite
 * PixiJS Container with:
 *   1. Real sprite sheet (from Marine Sosa Mech Assets pack) when available
 *   2. Procedural pixel-art robot as fallback when PNG not found
 *
 * The loader is completely transparent — if the asset pack is not installed
 * the game still runs with the hand-drawn procedural robot.
 */
import {
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  ColorMatrixFilter,
  BlurFilter,
  Ticker,
} from 'pixi.js';
import type { ElementType } from '../../store/gameStore';
import { loadRobotSprite, type RobotTextureSet } from '../../assets/spriteLoader';
import type { EvoStage } from '../../assets/manifest';

// ─── Element → glow color map ─────────────────────────────────────────────────

const ELEMENT_COLORS: Record<ElementType, number> = {
  VOLT: 0x00BFFF,
  PYRO: 0xCC2200,
  CRYO: 0xE8F4FF,
  NANO: 0x00CC44,
  VOID: 0x6600AA,
  IRON: 0x888899,
};

// ─── RobotSprite factory ──────────────────────────────────────────────────────

export interface RobotSpriteOptions {
  element:       ElementType;
  isEnemy:       boolean;
  hp:            number;
  maxHp:         number;
  x:             number;
  y:             number;
  flipX?:        boolean;
  /** Evolution stage for sprite selection (1–4), defaults to 1 */
  evo?:          EvoStage;
  /** Variant within element (1–6), defaults to 1 */
  variantIndex?: number;
}

export default class RobotSprite {
  // ─── Factory ──────────────────────────────────────────────────────────────

  static async create(opts: RobotSpriteOptions): Promise<Container> {
    const {
      element,
      isEnemy,
      hp,
      maxHp,
      x,
      y,
      flipX    = false,
      evo      = 1 as EvoStage,
      variantIndex = 1,
    } = opts;
    const color = ELEMENT_COLORS[element];

    const container = new Container();
    container.label = `RobotSprite_${element}_${isEnemy ? 'enemy' : 'me'}`;
    container.x = x;
    container.y = y;

    // ── Selection ring (hidden by default, shown when selected) ──────────────
    const ring = new Graphics();
    ring.label = 'selectionRing';
    ring.circle(0, 0, 36).stroke({ color, width: 2, alpha: 0.8 });
    ring.visible = false;
    container.addChild(ring);

    // ── Element glow (blur behind robot) ─────────────────────────────────────
    const glowG = new Graphics();
    glowG.circle(0, -16, 28).fill({ color, alpha: 0.18 });
    const blur = new BlurFilter({ strength: 12, quality: 2 });
    glowG.filters = [blur];
    container.addChild(glowG);

    // ── Try to load real sprite; fall back to procedural ──────────────────────
    const textures = await loadRobotSprite(element, evo, variantIndex);

    if (textures) {
      // ── Real sprite path ───────────────────────────────────────────────────
      const spriteNode = RobotSprite.buildSpriteNode(textures, color);
      spriteNode.label = 'robotBody';
      container.addChild(spriteNode);

      // Start idle animation
      RobotSprite.playAnimation(spriteNode, textures, 'idle');
    } else {
      // ── Procedural fallback ────────────────────────────────────────────────
      const body = RobotSprite.drawBody(color, isEnemy);
      body.label = 'robotBody';
      container.addChild(body);
    }

    // ── HP bar ────────────────────────────────────────────────────────────────
    const hpBar = RobotSprite.drawHPBar(hp, maxHp);
    hpBar.label = 'hpBar';
    hpBar.y = -56;
    hpBar.x = -24;
    container.addChild(hpBar);

    // ── Element label ─────────────────────────────────────────────────────────
    const labelStyle = new TextStyle({
      fontFamily: '"Press Start 2P", monospace',
      fontSize:   6,
      fill:       color,
    });
    const elemLabel = new Text({ text: element, style: labelStyle });
    elemLabel.anchor.set(0.5, 0);
    elemLabel.y = 28;
    container.addChild(elemLabel);

    // ── Flip for enemy ────────────────────────────────────────────────────────
    if (flipX) {
      container.scale.x = -1;
      // Flip children that shouldn't be mirrored (text)
      elemLabel.scale.x = -1;
      elemLabel.x = 0;
    }

    // ── Color tint (only for procedural body) ─────────────────────────────────
    if (!textures) {
      const body = container.getChildByLabel('robotBody') as Graphics | null;
      if (body) {
        const cm = new ColorMatrixFilter();
        cm.tint(color, true);
        cm.alpha = 0.25;
        body.filters = [cm];
      }
    }

    return container;
  }

  // ─── Sprite-sheet animation helpers ──────────────────────────────────────

  /** Build a Sprite node that can swap textures for animation frames. */
  private static buildSpriteNode(textures: RobotTextureSet, _color: number): Sprite {
    const sprite = new Sprite(textures.idle);
    sprite.anchor.set(0.5, 0.5);
    // Scale to fit the ~80px design space
    sprite.width  = 80;
    sprite.height = 80;
    sprite.y      = -16; // align with procedural body centre
    return sprite;
  }

  /** Simple frame-cycling animation using PixiJS Ticker. */
  static playAnimation(
    node: Sprite,
    textures: RobotTextureSet,
    anim: 'idle' | 'walk' | 'attack' | 'hit',
  ): () => void {
    const frames =
      anim === 'idle'   ? [textures.idle] :
      anim === 'walk'   ? textures.walk   :
      anim === 'attack' ? textures.attack :
                          [textures.hit];

    if (frames.length <= 1) {
      node.texture = frames[0];
      return () => { /* no ticker to remove */ };
    }

    let frame     = 0;
    let elapsed   = 0;
    const FPS     = 8; // pixel-art feel
    const delay   = 1000 / FPS;

    const ticker = Ticker.shared;
    const tick = (t: Ticker) => {
      elapsed += t.deltaMS;
      if (elapsed >= delay) {
        elapsed = 0;
        frame   = (frame + 1) % frames.length;
        node.texture = frames[frame];
      }
    };

    ticker.add(tick);
    // Return cleanup function
    return () => ticker.remove(tick);
  }

  // ─── Procedural pixel-art robot body ─────────────────────────────────────

  private static drawBody(color: number, isEnemy: boolean): Graphics {
    const g = new Graphics();
    const baseColor  = isEnemy ? 0xAA2222 : 0x2244AA;
    const darkColor  = isEnemy ? 0x661111 : 0x112266;
    const lightColor = 0xCCDDFF;

    // Legs
    g.rect(-14, 8,  10, 18).fill(darkColor);
    g.rect(  4, 8,  10, 18).fill(darkColor);

    // Feet
    g.rect(-16, 22, 12, 6).fill(0x111122);
    g.rect(  4, 22, 12, 6).fill(0x111122);

    // Torso
    g.rect(-16, -14, 32, 24).fill(baseColor);

    // Chest detail
    g.rect(-10, -10, 20, 12).fill(darkColor);
    g.rect( -6,  -8, 12,  8).fill(color);

    // Arms
    g.rect(-26, -12, 10, 20).fill(baseColor);
    g.rect( 16, -12, 10, 20).fill(baseColor);

    // Hands / claws
    g.circle(-21, 10, 6).fill(darkColor);
    g.circle( 21, 10, 6).fill(darkColor);

    // Neck
    g.rect(-6, -18, 12, 6).fill(darkColor);

    // Head
    g.rect(-14, -38, 28, 22).fill(baseColor);

    // Eyes (visor)
    g.rect(-10, -34, 20, 8).fill(0x001133);
    g.rect(-10, -34, 20, 8).fill({ color: color, alpha: 0.9 });

    // Ear panels
    g.rect(-18, -36, 4, 16).fill(darkColor);
    g.rect( 14, -36, 4, 16).fill(darkColor);

    // Antenna
    g.rect(-2, -46, 4, 10).fill(darkColor);
    g.circle(0, -48, 3).fill(color);

    // Highlight
    g.rect(-14, -38, 28, 3).fill({ color: lightColor, alpha: 0.2 });

    return g;
  }

  // ─── HP Bar ───────────────────────────────────────────────────────────────

  private static drawHPBar(hp: number, maxHp: number): Container {
    const c    = new Container();
    const barW = 48;
    const barH = 6;
    const pct  = Math.max(0, hp / maxHp);

    // Track
    const track = new Graphics();
    track.rect(0, 0, barW, barH).fill(0x111122);
    track.rect(0, 0, barW, barH).stroke({ color: 0x2A2A44, width: 1 });
    c.addChild(track);

    // Fill (color shifts by HP%)
    const fillColor =
      pct > 0.6 ? 0x00CC44 :
      pct > 0.3 ? 0x00BFFF :
                  0xCC2200;

    const fill = new Graphics();
    fill.rect(0, 0, barW * pct, barH).fill(fillColor);
    c.addChild(fill);

    // HP text
    const style  = new TextStyle({ fontFamily: '"Press Start 2P"', fontSize: 5, fill: 0xFFFFFF });
    const hpText = new Text({ text: `${hp}/${maxHp}`, style });
    hpText.y = -8;
    c.addChild(hpText);

    return c;
  }

  // ─── Update HP (call during battle updates) ───────────────────────────────

  static updateHP(sprite: Container, hp: number, maxHp: number) {
    const hpBar = sprite.getChildByLabel('hpBar') as Container | null;
    if (!hpBar) return;
    hpBar.removeChildren();
    const updated = RobotSprite.drawHPBar(hp, maxHp);
    updated.children.forEach((child) => hpBar.addChild(child));
  }

  // ─── Toggle selection ring ────────────────────────────────────────────────

  static setSelected(sprite: Container, selected: boolean) {
    const ring = sprite.getChildByLabel('selectionRing') as Graphics | null;
    if (ring) ring.visible = selected;
  }
}
