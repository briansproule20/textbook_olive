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
import {
  damageIron,
  getIronState,
  hasIronAt,
  listAllIronTiles,
} from "../world/iron";
import { NPCS, isNpcTile, npcAt, type NpcSpec } from "../world/npcs";
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
  private ironImages = new Map<string, Phaser.GameObjects.Image>();
  private npcs: { spec: NpcSpec; sprite: Phaser.GameObjects.Sprite; nameLabel: Phaser.GameObjects.Text; bubble: Phaser.GameObjects.Text; bubbleHideAt: number }[] = [];

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
    this.load.image("iron", "/sprites/objects/iron.png");
    // Each NPC needs its own character atlas. De-dupe in case multiple NPCs
    // share a sprite.
    const npcAtlases = new Set(NPCS.map((n) => n.charId));
    npcAtlases.delete(this.charId as never); // player atlas is already queued above
    for (const charId of npcAtlases) {
      this.load.atlas(
        atlasKey(charId),
        `/sprites/characters/${charId}/${charId}.png`,
        `/sprites/characters/${charId}/${charId}.json`
      );
    }
  }

  create(): void {
    this.createAnimations();
    this.createNpcAnimations();
    this.drawTileGrid();
    this.placeTrees();
    this.placeStones();
    this.placeIron();
    this.spawnNpcs();

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
    // Suppress movement + harvest input while UI overlays (inventory, menu) are open.
    const w = window as unknown as { __inventoryOpen?: boolean; __menuOpen?: boolean };
    const uiOpen = w.__inventoryOpen === true || w.__menuOpen === true;
    if (!uiOpen) {
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

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && !this.attacking && !uiOpen) {
      this.attacking = true;
      this.action = "attack";
      this.playAnim("attack", this.facing);
      this.tryHarvestTree();
    }

    this.refreshTreeVisuals();
    this.refreshStoneVisuals();
    this.refreshIronVisuals();
    this.updateNpcBubbles();

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

  // Omnidirectional harvest reach. Scan iso tiles within HARVEST_RADIUS
  // (Euclidean) of the player's foot in iso space. Same distance held in
  // every direction; the player can harvest any tile whose center is closer
  // than the radius regardless of approach angle.
  //
  // 1.5 ≈ collision_radius (0.85) + a half-tile so any tree/stone the player
  // is touching collision-wise is harvestable, plus a tiny bit of extra grace.
  // Returned tiles are sorted nearest-first so the closest resource wins ties.
  private static readonly HARVEST_RADIUS = 1.5;
  private static readonly HARVEST_RADIUS_SQ =
    GameScene.HARVEST_RADIUS * GameScene.HARVEST_RADIUS;

  private nearbyTiles(): { ix: number; iy: number }[] {
    const footY = this.player.y - BASELINE_OFFSET * CHAR_SCALE;
    const iso = screenToIso(this.player.x, footY);
    const cx = Math.round(iso.x);
    const cy = Math.round(iso.y);
    const reach = Math.ceil(GameScene.HARVEST_RADIUS);
    const candidates: { ix: number; iy: number; d2: number }[] = [];
    for (let dx = -reach; dx <= reach; dx++) {
      for (let dy = -reach; dy <= reach; dy++) {
        const tx = cx + dx;
        const ty = cy + dy;
        const ex = iso.x - tx;
        const ey = iso.y - ty;
        const d2 = ex * ex + ey * ey;
        if (d2 < GameScene.HARVEST_RADIUS_SQ) {
          candidates.push({ ix: tx, iy: ty, d2 });
        }
      }
    }
    candidates.sort((a, b) => a.d2 - b.d2);
    return candidates.map(({ ix, iy }) => ({ ix, iy }));
  }

  private tryHarvestTree(): void {
    const candidates = this.nearbyTiles();
    // NPCs first — interacting (SPACE near an NPC) shows their dialogue bubble.
    for (const { ix, iy } of candidates) {
      const npc = npcAt(ix, iy);
      if (npc) {
        this.showNpcBubble(npc);
        return;
      }
    }
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
    for (const { ix, iy } of candidates) {
      if (!hasIronAt(ix, iy)) continue;
      const iron = damageIron(ix, iy);
      if (iron > 0) {
        addItem({ id: "iron", label: "Iron", qty: iron });
        emitHarvest({ itemId: "iron", qty: iron, screenX: this.player.x, screenY: this.player.y });
        return;
      }
    }
  }

  // Omnidirectional circular collision in iso tile space. Trees and stones
  // each have an iso center at their tile's (ix, iy). The player's foot has an
  // iso position too. Block movement if the foot is within COLLISION_RADIUS
  // (Euclidean) of any obstacle's center. Using a true circle (not a square)
  // means the player is held the same distance from the obstacle on every
  // approach — cardinal, diagonal, or anywhere in between.
  //
  // 0.85 = roughly player_radius (~0.35) + obstacle_radius (~0.5). Tight
  // enough to feel snug but wide enough that the sprite body never visually
  // overlaps the obstacle from any side.
  private static readonly COLLISION_RADIUS = 0.85;
  private static readonly COLLISION_RADIUS_SQ =
    GameScene.COLLISION_RADIUS * GameScene.COLLISION_RADIUS;

  private tileBlockedAt(screenX: number, screenY: number): boolean {
    const footY = screenY - BASELINE_OFFSET * CHAR_SCALE;
    const iso = screenToIso(screenX, footY);
    // Scan the 3x3 (rounded) iso neighborhood — any obstacle further than
    // COLLISION_RADIUS away can't possibly intersect, so this is the smallest
    // candidate set we need to check.
    const baseX = Math.round(iso.x);
    const baseY = Math.round(iso.y);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const tx = baseX + dx;
        const ty = baseY + dy;
        if (!hasTreeAt(tx, ty) && !hasStoneAt(tx, ty) && !hasIronAt(tx, ty) && !isNpcTile(tx, ty)) continue;
        const ex = iso.x - tx;
        const ey = iso.y - ty;
        if (ex * ex + ey * ey < GameScene.COLLISION_RADIUS_SQ) return true;
      }
    }
    return false;
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

  private placeIron(): void {
    if (!this.textures.exists("iron")) return;
    const irons = listAllIronTiles();
    for (const { ix, iy } of irons) {
      const { x, y } = isoToScreen(ix, iy);
      const img = this.add.image(x, y, "iron");
      img.setOrigin(0.5, 0.85);
      img.setScale(0.25);
      img.setDepth(worldObjectDepth(y));
      this.ironImages.set(`${ix},${iy}`, img);
    }
  }

  private refreshIronVisuals(): void {
    for (const [key, img] of this.ironImages.entries()) {
      const [ixStr, iyStr] = key.split(",");
      const ix = Number(ixStr);
      const iy = Number(iyStr);
      const s = getIronState(ix, iy);
      const depleted = s.hp <= 0;
      const targetAlpha = depleted ? 0.45 : 1;
      if (img.alpha !== targetAlpha) img.setAlpha(targetAlpha);
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

  // ---------- NPCs ----------

  // Ensure each NPC atlas has its idle animation registered (mirrors the
  // player's createAnimations() loop but only for atlases NPCs use).
  private createNpcAnimations(): void {
    const npcAtlases = new Set(NPCS.map((n) => atlasKey(n.charId)));
    for (const atlas of npcAtlases) {
      if (atlas === this.charAtlas) continue;
      for (const anim of ANIMATIONS) {
        const animId = `anim_${anim.key}_${atlas.replace("character-", "")}`;
        if (this.anims.exists(animId)) continue;
        const frames: Phaser.Types.Animations.AnimationFrame[] = [];
        for (let i = 0; i < anim.frames; i++) {
          frames.push({ key: atlas, frame: `${anim.key}_${String(i).padStart(2, "0")}` });
        }
        const frameRate = anim.key.startsWith("idle") ? 3 : 8;
        this.anims.create({ key: animId, frames, frameRate, repeat: anim.loop ? -1 : 0 });
      }
    }
  }

  private spawnNpcs(): void {
    for (const spec of NPCS) {
      const atlas = atlasKey(spec.charId);
      if (!this.textures.exists(atlas)) continue;
      const { x, y } = isoToScreen(spec.ix, spec.iy);
      const sprite = this.add.sprite(x, y, atlas, "idle_se_00");
      sprite.setOrigin(0.5, 1);
      sprite.setScale(CHAR_SCALE);
      sprite.y += BASELINE_OFFSET * CHAR_SCALE;
      sprite.setDepth(worldObjectDepth(sprite.y));
      const animId = `anim_idle_se_${spec.charId}`;
      if (this.anims.exists(animId)) sprite.play(animId);

      const nameLabel = this.add.text(sprite.x, sprite.y - sprite.displayHeight, spec.name, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: "#ffd27a",
        stroke: "#000000",
        strokeThickness: 3,
      });
      nameLabel.setOrigin(0.5, 1);
      nameLabel.setDepth(sprite.depth + 1);

      const bubble = this.add.text(sprite.x, sprite.y - sprite.displayHeight - 18, spec.dialogue, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: "#0c1c0a",
        backgroundColor: "#fff7c0",
        padding: { left: 8, right: 8, top: 4, bottom: 4 },
      });
      bubble.setOrigin(0.5, 1);
      bubble.setDepth(sprite.depth + 2);
      bubble.setVisible(false); // shows only on interaction

      this.npcs.push({ spec, sprite, nameLabel, bubble, bubbleHideAt: 0 });
    }
  }

  // Show the dialogue bubble for a few seconds. Re-pressing space refreshes it.
  private showNpcBubble(spec: NpcSpec): void {
    const npc = this.npcs.find((n) => n.spec.id === spec.id);
    if (!npc) return;
    npc.bubble.setVisible(true);
    npc.bubbleHideAt = Date.now() + 3000;
  }

  private updateNpcBubbles(): void {
    const now = Date.now();
    for (const npc of this.npcs) {
      if (npc.bubble.visible && now >= npc.bubbleHideAt) {
        npc.bubble.setVisible(false);
      }
    }
  }
}

void TREE_MAX_HP;

// silence unused-import linting in strict mode
void animationKey;
