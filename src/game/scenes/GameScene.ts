import Phaser from "phaser";
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  isoToScreen,
  screenToIso,
  isoInputToScreenVector,
  worldObjectDepth,
  BASELINE_OFFSET,
} from "../world/isometricWorld";
import { GRID_RADIUS, TILE_ATLAS_KEY, tileAt } from "../world/tiles";
import {
  damageTree,
  getTreeState,
  hasTreeAt,
  listAllTreeTiles,
  TREE_MAX_HP,
} from "../world/trees";
import {
  damageStone,
  getStoneState,
  hasStoneAt,
  listAllStoneTiles,
} from "../world/stones";
import { addItem } from "../saves/saveGame";
import { emitHarvest } from "../events";
import {
  atlasKey,
  CHARACTER_LABELS,
  DIRECTIONS,
  atlasAnimationKey,
  animationKey,
  directionFromVector,
  loadSelectedCharacter,
  type Action,
  type CharacterId,
  type Direction,
} from "../sprites/characterTextures";
import { loadOrCreateLocalName } from "../players/playerNames";
import { MultiplayerClient, type PlayerState } from "../multiplayer/MultiplayerClient";

interface AnimSpec {
  key: string;
  frames: number;
  loop: boolean;
}

const ANIMATIONS: AnimSpec[] = [
  { key: "idle_se", frames: 4, loop: true },
  { key: "walk_se", frames: 4, loop: true },
  { key: "walk_ne", frames: 4, loop: true },
  { key: "attack_se", frames: 4, loop: false },
];

interface RemotePlayer {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  target: { x: number; y: number };
  state: PlayerState;
}

const MOVE_SPEED = 180;
const CHAR_SCALE = 0.55;

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private playerLabel!: Phaser.GameObjects.Text;
  private facing: Direction = "se";
  private action: Action = "idle";
  private localName = "Poncho";
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private clickTarget: { x: number; y: number } | null = null;
  private attacking = false;
  private mp!: MultiplayerClient;
  private remotes = new Map<string, RemotePlayer>();
  private charId: CharacterId = "cat";
  private charAtlas = "character-cat";
  private treeImages = new Map<string, Phaser.GameObjects.Image>();
  private stoneImages = new Map<string, Phaser.GameObjects.Image>();

  constructor() {
    super("GameScene");
  }

  init(): void {
    this.charId = loadSelectedCharacter();
    this.charAtlas = atlasKey(this.charId);
  }

  preload(): void {
    this.load.atlas(TILE_ATLAS_KEY, "/sprites/tiles/tiles.png", "/sprites/tiles/tiles.json");
    this.load.atlas(
      this.charAtlas,
      `/sprites/characters/${this.charId}/${this.charId}.png`,
      `/sprites/characters/${this.charId}/${this.charId}.json`
    );
    this.load.image("tree", "/sprites/objects/tree.png");
    this.load.image("stone", "/sprites/objects/stone.png");
  }

  create(): void {
    this.createAnimations();
    this.drawTileGrid();
    this.placeTrees();
    this.placeStones();

    this.localName = loadOrCreateLocalName(CHARACTER_LABELS[this.charId]);

    const startScreen = isoToScreen(0, 0);
    this.player = this.add.sprite(startScreen.x, startScreen.y, this.charAtlas, "idle_se_00");
    this.player.setOrigin(0.5, 1);
    this.player.setScale(CHAR_SCALE);
    this.player.y += BASELINE_OFFSET * CHAR_SCALE;
    this.player.setDepth(worldObjectDepth(this.player.y));

    this.playerLabel = this.add.text(this.player.x, this.player.y - this.player.displayHeight, this.localName, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
    });
    this.playerLabel.setOrigin(0.5, 1);
    this.playerLabel.setDepth(this.player.depth + 1);

    this.playAnim("idle", this.facing);

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.centerOn(this.player.x, this.player.y);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as typeof this.wasd;
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.clickTarget = { x: world.x, y: world.y };
    });

    this.player.on("animationcomplete", (anim: Phaser.Animations.Animation) => {
      if (anim.key.startsWith("anim_attack")) {
        this.attacking = false;
        this.action = "idle";
        this.playAnim("idle", this.facing);
      }
    });

    const url = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_COLYSEUS_URL : undefined;
    this.mp = new MultiplayerClient(url);
    this.mp.onPlayerJoin((id, state) => this.handleRemoteJoin(id, state));
    this.mp.onPlayerUpdate((id, state) => this.handleRemoteUpdate(id, state));
    this.mp.onPlayerLeave((id) => this.handleRemoteLeave(id));
    void this.mp.connect();
  }

  private createAnimations(): void {
    for (const anim of ANIMATIONS) {
      const key = `anim_${anim.key}_${this.charId}`;
      if (this.anims.exists(key)) continue;
      const frames: Phaser.Types.Animations.AnimationFrame[] = [];
      for (let i = 0; i < anim.frames; i++) {
        frames.push({ key: this.charAtlas, frame: `${anim.key}_${String(i).padStart(2, "0")}` });
      }
      const frameRate = anim.key.startsWith("idle") ? 3 : 8;
      this.anims.create({
        key,
        frames,
        frameRate,
        repeat: anim.loop ? -1 : 0,
      });
    }
  }

  private resolveAnimKey(action: Action, direction: Direction): { key: string; flipX: boolean } {
    const resolved = atlasAnimationKey(action, direction);
    // animationKey returns like "anim_idle_se"; suffix charId so multi-character anims don't collide
    return { key: `${resolved.key}_${this.charId}`, flipX: resolved.flipX };
  }

  private drawTileGrid(): void {
    const BORDER_COLOR = 0x2d3520;
    for (let ix = -GRID_RADIUS; ix <= GRID_RADIUS; ix++) {
      for (let iy = -GRID_RADIUS; iy <= GRID_RADIUS; iy++) {
        const { x, y } = isoToScreen(ix, iy);
        const tileName = tileAt(ix, iy);
        const img = this.add.image(x, y, TILE_ATLAS_KEY, tileName);
        img.setOrigin(0.5, 0.5);
        img.setDepth(worldObjectDepth(y) - 1000);
      }
    }

    // Visible border around the playable iso area: 4 corners of the iso
    // bounds projected to screen form a diamond. Player clamping below keeps
    // the character inside this diamond so the border represents the actual
    // confine zone, not decoration.
    const border = this.add.graphics();
    border.lineStyle(4, BORDER_COLOR, 1);
    const R = GRID_RADIUS + 0.5;
    const c = [
      isoToScreen(-R, -R),
      isoToScreen(R, -R),
      isoToScreen(R, R),
      isoToScreen(-R, R),
    ];
    border.strokePoints([c[0], c[1], c[2], c[3]], true, true);
    border.setDepth(-900);
  }

  private playAnim(action: Action, direction: Direction): void {
    const resolved = this.resolveAnimKey(action, direction);
    this.player.setFlipX(resolved.flipX);
    if (this.player.anims.currentAnim?.key !== resolved.key) {
      this.player.play(resolved.key);
    }
  }

  update(_t: number, dt: number): void {
    const delta = dt / 1000;
    let ix = 0;
    let iy = 0;
    // Suppress movement input while UI overlays (inventory) are open.
    const inventoryOpen = (window as unknown as { __inventoryOpen?: boolean }).__inventoryOpen === true;
    if (!inventoryOpen) {
      if (this.cursors.up.isDown || this.wasd.W.isDown) iy -= 1;
      if (this.cursors.down.isDown || this.wasd.S.isDown) iy += 1;
      if (this.cursors.left.isDown || this.wasd.A.isDown) ix -= 1;
      if (this.cursors.right.isDown || this.wasd.D.isDown) ix += 1;
    }

    let moveVec = { x: 0, y: 0 };
    let moving = false;

    if (ix !== 0 || iy !== 0) {
      this.clickTarget = null;
      const len = Math.hypot(ix, iy);
      const nix = ix / len;
      const niy = iy / len;
      moveVec = isoInputToScreenVector(nix, niy);
      moving = true;
    } else if (this.clickTarget) {
      const dx = this.clickTarget.x - this.player.x;
      const dy = this.clickTarget.y - (this.player.y - BASELINE_OFFSET);
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        this.clickTarget = null;
      } else {
        moveVec = { x: dx / dist, y: dy / dist };
        moving = true;
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && !this.attacking) {
      this.attacking = true;
      this.action = "attack";
      this.playAnim("attack", this.facing);
      this.tryHarvestTree();
    }

    this.refreshTreeVisuals();
    this.refreshStoneVisuals();

    if (moving && !this.attacking) {
      this.facing = directionFromVector(moveVec, this.facing);
      const dx = moveVec.x * MOVE_SPEED * delta;
      const dy = moveVec.y * MOVE_SPEED * delta;
      // Axis-separated collision so the player can slide along trees/stones
      // instead of getting fully stuck when grazing one diagonally.
      const newX = this.player.x + dx;
      if (!this.tileBlockedAt(newX, this.player.y)) this.player.x = newX;
      const newY = this.player.y + dy;
      if (!this.tileBlockedAt(this.player.x, newY)) this.player.y = newY;
      if (this.action !== "walk") {
        this.action = "walk";
        this.playAnim("walk", this.facing);
      } else {
        this.playAnim("walk", this.facing);
      }
    } else if (!this.attacking && this.action !== "idle") {
      this.action = "idle";
      this.playAnim("idle", this.facing);
    }

    // Clamp player to the iso playable area. The player.y has BASELINE_OFFSET
    // built in (sprite anchored by feet, then shifted), so we project the
    // FOOT position to iso space, clamp, project back, and re-apply the offset.
    const footY = this.player.y - BASELINE_OFFSET * CHAR_SCALE;
    const iso = screenToIso(this.player.x, footY);
    const limit = GRID_RADIUS;
    let clampedIsoX = iso.x;
    let clampedIsoY = iso.y;
    if (clampedIsoX > limit) clampedIsoX = limit;
    if (clampedIsoX < -limit) clampedIsoX = -limit;
    if (clampedIsoY > limit) clampedIsoY = limit;
    if (clampedIsoY < -limit) clampedIsoY = -limit;
    if (clampedIsoX !== iso.x || clampedIsoY !== iso.y) {
      const back = isoToScreen(clampedIsoX, clampedIsoY);
      this.player.x = back.x;
      this.player.y = back.y + BASELINE_OFFSET * CHAR_SCALE;
      this.clickTarget = null;
    }

    this.player.setDepth(worldObjectDepth(this.player.y));
    this.playerLabel.setPosition(this.player.x, this.player.y - this.player.displayHeight);
    this.playerLabel.setDepth(this.player.depth + 1);

    const speed = moving ? MOVE_SPEED : 0;
    this.mp.sendUpdate({
      action: this.action,
      facing: this.facing,
      name: this.localName,
      speed,
      x: this.player.x,
      y: this.player.y,
    });

    if (typeof window !== "undefined") {
      const footY2 = this.player.y - BASELINE_OFFSET * CHAR_SCALE;
      const isoNow = screenToIso(this.player.x, footY2);
      (window as unknown as { __gameStatus?: object }).__gameStatus = {
        action: this.action.toUpperCase(),
        facing: this.facing.toUpperCase(),
        speed: Math.round(speed),
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        isoX: Math.round(isoNow.x),
        isoY: Math.round(isoNow.y),
        fps: Math.round(this.game.loop.actualFps),
      };
    }

    for (const rp of this.remotes.values()) {
      const lerp = 0.2;
      rp.sprite.x += (rp.target.x - rp.sprite.x) * lerp;
      rp.sprite.y += (rp.target.y - rp.sprite.y) * lerp;
      rp.sprite.setDepth(worldObjectDepth(rp.sprite.y));
      rp.label.setPosition(rp.sprite.x, rp.sprite.y - rp.sprite.displayHeight);
      rp.label.setDepth(rp.sprite.depth + 1);
    }
  }

  private handleRemoteJoin(id: string, state: PlayerState): void {
    if (this.remotes.has(id)) return;
    const sprite = this.add.sprite(state.x, state.y, this.charAtlas, "idle_se_00");
    sprite.setOrigin(0.5, 1);
    sprite.setScale(CHAR_SCALE);
    const label = this.add.text(state.x, state.y - sprite.displayHeight, state.name, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      color: "#ffd27a",
      stroke: "#000000",
      strokeThickness: 3,
    });
    label.setOrigin(0.5, 1);
    const dir = (DIRECTIONS as readonly Direction[]).includes(state.facing) ? state.facing : "se";
    const resolved = this.resolveAnimKey(state.action, dir);
    sprite.setFlipX(resolved.flipX);
    sprite.play(resolved.key);
    this.remotes.set(id, { id, sprite, label, target: { x: state.x, y: state.y }, state });
  }

  private handleRemoteUpdate(id: string, state: PlayerState): void {
    const rp = this.remotes.get(id);
    if (!rp) {
      this.handleRemoteJoin(id, state);
      return;
    }
    rp.target.x = state.x;
    rp.target.y = state.y;
    rp.state = state;
    rp.label.setText(state.name);
    const dir = (DIRECTIONS as readonly Direction[]).includes(state.facing) ? state.facing : "se";
    const resolved = this.resolveAnimKey(state.action, dir);
    rp.sprite.setFlipX(resolved.flipX);
    if (rp.sprite.anims.currentAnim?.key !== resolved.key) {
      rp.sprite.play(resolved.key);
    }
  }

  private handleRemoteLeave(id: string): void {
    const rp = this.remotes.get(id);
    if (!rp) return;
    rp.sprite.destroy();
    rp.label.destroy();
    this.remotes.delete(id);
  }

  // ---------- Trees ----------

  private placeTrees(): void {
    if (!this.textures.exists("tree")) return;
    const trees = listAllTreeTiles();
    for (const { ix, iy } of trees) {
      const { x, y } = isoToScreen(ix, iy);
      const img = this.add.image(x, y, "tree");
      img.setOrigin(0.5, 0.95); // base sits on the tile, trunk anchored near bottom
      img.setScale(0.35);
      img.setDepth(worldObjectDepth(y));
      this.treeImages.set(`${ix},${iy}`, img);
    }
  }

  // Visual feedback for tree HP: depleted trees become dim until they refresh.
  private refreshTreeVisuals(): void {
    for (const [key, img] of this.treeImages.entries()) {
      const [ixStr, iyStr] = key.split(",");
      const ix = Number(ixStr);
      const iy = Number(iyStr);
      const s = getTreeState(ix, iy);
      const depleted = s.hp <= 0;
      const targetAlpha = depleted ? 0.45 : 1;
      if (img.alpha !== targetAlpha) img.setAlpha(targetAlpha);
    }
  }

  // Returns the iso tile the player is currently standing on, then the tile
  // directly in front based on facing. Trees are harvested when the player
  // attacks while standing adjacent to one.
  private playerFacingTile(): { ix: number; iy: number } {
    const footY = this.player.y - BASELINE_OFFSET * CHAR_SCALE;
    const iso = screenToIso(this.player.x, footY);
    const ix = Math.round(iso.x);
    const iy = Math.round(iso.y);
    // SE = +ix, SW = +iy, NE = -iy, NW = -ix in iso tile coords
    const offsets: Record<Direction, [number, number]> = {
      se: [1, 0],
      sw: [0, 1],
      ne: [0, -1],
      nw: [-1, 0],
    };
    const [dx, dy] = offsets[this.facing];
    return { ix: ix + dx, iy: iy + dy };
  }

  // Tiles the player can interact with on space: current tile + 4 cardinal
  // neighbors. The closest live tree/stone wins.
  private nearbyTiles(): { ix: number; iy: number }[] {
    const footY = this.player.y - BASELINE_OFFSET * CHAR_SCALE;
    const iso = screenToIso(this.player.x, footY);
    const cx = Math.round(iso.x);
    const cy = Math.round(iso.y);
    return [
      { ix: cx, iy: cy },
      { ix: cx + 1, iy: cy },
      { ix: cx - 1, iy: cy },
      { ix: cx, iy: cy + 1 },
      { ix: cx, iy: cy - 1 },
    ];
  }

  private tryHarvestTree(): void {
    const candidates = this.nearbyTiles();
    for (const { ix, iy } of candidates) {
      if (!hasTreeAt(ix, iy)) continue;
      const wood = damageTree(ix, iy);
      if (wood > 0) {
        addItem({ id: "wood", label: "Wood", qty: wood });
        emitHarvest({ itemId: "wood", qty: wood, screenX: this.player.x, screenY: this.player.y });
        return;
      }
    }
    for (const { ix, iy } of candidates) {
      if (!hasStoneAt(ix, iy)) continue;
      const stone = damageStone(ix, iy);
      if (stone > 0) {
        addItem({ id: "stone", label: "Stone", qty: stone });
        emitHarvest({ itemId: "stone", qty: stone, screenX: this.player.x, screenY: this.player.y });
        return;
      }
    }
  }

  // Trees and stones block movement (even when depleted — the visual stays).
  private tileBlockedAt(screenX: number, screenY: number): boolean {
    const footY = screenY - BASELINE_OFFSET * CHAR_SCALE;
    const iso = screenToIso(screenX, footY);
    const ix = Math.round(iso.x);
    const iy = Math.round(iso.y);
    return hasTreeAt(ix, iy) || hasStoneAt(ix, iy);
  }

  private placeStones(): void {
    if (!this.textures.exists("stone")) return;
    const stones = listAllStoneTiles();
    for (const { ix, iy } of stones) {
      const { x, y } = isoToScreen(ix, iy);
      const img = this.add.image(x, y, "stone");
      img.setOrigin(0.5, 0.85);
      img.setScale(0.22);
      img.setDepth(worldObjectDepth(y));
      this.stoneImages.set(`${ix},${iy}`, img);
    }
  }

  private refreshStoneVisuals(): void {
    for (const [key, img] of this.stoneImages.entries()) {
      const [ixStr, iyStr] = key.split(",");
      const ix = Number(ixStr);
      const iy = Number(iyStr);
      const s = getStoneState(ix, iy);
      const depleted = s.hp <= 0;
      const targetAlpha = depleted ? 0.45 : 1;
      if (img.alpha !== targetAlpha) img.setAlpha(targetAlpha);
    }
  }
}

void TREE_MAX_HP;

// silence unused-import linting in strict mode
void animationKey;
