import Phaser from "phaser";
import {
  isoToScreen,
  isoInputToScreenVector,
  worldObjectDepth,
  BASELINE_OFFSET,
} from "../world/isometricWorld";
import { TILE_ATLAS_KEY, tileAt } from "../world/tiles";
import {
  atlasKey,
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
const GRID_RADIUS = 50;
const CHAR_SCALE = 0.55;
const DECOR_DEPTH_BOOST = 100;

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
  }

  create(): void {
    this.createAnimations();
    this.drawTileGrid();

    this.localName = loadOrCreateLocalName();

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
    for (let ix = -GRID_RADIUS; ix <= GRID_RADIUS; ix++) {
      for (let iy = -GRID_RADIUS; iy <= GRID_RADIUS; iy++) {
        const { x, y } = isoToScreen(ix, iy);
        const tileName = tileAt(ix, iy);
        const img = this.add.image(x, y, TILE_ATLAS_KEY, tileName);
        img.setOrigin(0.5, 0.5);
        img.setDepth(worldObjectDepth(y) - 1000);
        this.drawDecorOn(ix, iy, x, y, tileName);
      }
    }
  }

  private drawDecorOn(ix: number, iy: number, x: number, y: number, tile: string): void {
    // Skip the spawn tile so it never has clutter on the player's exact spot.
    if (ix === 0 && iy === 0) return;
    if (!tile.startsWith("grass")) return;
    const hash = ((ix * 2654435761) ^ (iy * 40503)) >>> 0;
    const bucket = hash % 100;
    if (bucket >= 28) return;
    const g = this.add.graphics();
    g.setDepth(worldObjectDepth(y) - 500);
    const jitter = ((hash >>> 8) % 9) - 4;
    const px = x + jitter;
    const py = y + (((hash >>> 16) % 7) - 3);
    if (bucket < 10) {
      // Tiny flower: yellow center, white petals.
      g.fillStyle(0xfff2a8, 1);
      g.fillCircle(px, py, 2);
      g.fillStyle(0xf2c14e, 1);
      g.fillCircle(px, py, 1);
    } else if (bucket < 20) {
      // Grass tuft: three short upward lines.
      g.lineStyle(2, 0x4a7b3a, 1);
      g.beginPath();
      g.moveTo(px - 3, py + 2); g.lineTo(px - 2, py - 4);
      g.moveTo(px, py + 2);     g.lineTo(px, py - 5);
      g.moveTo(px + 3, py + 2); g.lineTo(px + 2, py - 4);
      g.strokePath();
    } else {
      // Pebble: small dark ellipse with highlight.
      g.fillStyle(0x444a4a, 1);
      g.fillEllipse(px, py, 6, 3);
      g.fillStyle(0x6b7474, 1);
      g.fillEllipse(px - 1, py - 1, 3, 1);
    }
    // Make sure decor draws above its tile but below the player when player passes.
    g.setDepth(worldObjectDepth(y) + DECOR_DEPTH_BOOST);
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
    if (this.cursors.up.isDown || this.wasd.W.isDown) iy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) iy += 1;
    if (this.cursors.left.isDown || this.wasd.A.isDown) ix -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) ix += 1;

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
    }

    if (moving && !this.attacking) {
      this.facing = directionFromVector(moveVec, this.facing);
      this.player.x += moveVec.x * MOVE_SPEED * delta;
      this.player.y += moveVec.y * MOVE_SPEED * delta;
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
      (window as unknown as { __gameStatus?: object }).__gameStatus = {
        action: this.action.toUpperCase(),
        facing: this.facing.toUpperCase(),
        speed: Math.round(speed),
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
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
}

// silence unused-import linting in strict mode
void animationKey;
