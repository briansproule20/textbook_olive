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
import {
  ATLAS_KEY,
  DIRECTIONS,
  atlasAnimationKey,
  animationKey,
  directionFromVector,
  type Action,
  type Direction,
} from "../sprites/characterTextures";
import { loadOrCreateLocalName } from "../players/playerNames";
import { MultiplayerClient, type PlayerState } from "../multiplayer/MultiplayerClient";

interface AnimManifestEntry {
  key: string;
  frames: number;
  loop: boolean;
}

interface Manifest {
  animations: AnimManifestEntry[];
  frameSize: { w: number; h: number };
}

interface RemotePlayer {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  target: { x: number; y: number };
  state: PlayerState;
}

const MOVE_SPEED = 180;
const GRID_RADIUS = 20;

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
  private manifest!: Manifest;

  constructor() {
    super("GameScene");
  }

  preload(): void {
    this.load.json("character-manifest", "/sprites/character/manifest.json");
    this.load.atlas(
      ATLAS_KEY,
      "/sprites/character/character-iso-sheet.png",
      "/sprites/character/character-iso-sheet.json"
    );
  }

  create(): void {
    this.manifest = this.cache.json.get("character-manifest") as Manifest;
    this.createAnimations();
    this.drawTileGrid();

    this.localName = loadOrCreateLocalName();

    const startScreen = isoToScreen(0, 0);
    this.player = this.add.sprite(startScreen.x, startScreen.y, ATLAS_KEY, "idle_se_00");
    this.player.setOrigin(0.5, 1);
    this.player.y += BASELINE_OFFSET;
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
    for (const anim of this.manifest.animations) {
      const key = `anim_${anim.key}`;
      if (this.anims.exists(key)) continue;
      const frames = [] as Phaser.Types.Animations.AnimationFrame[];
      for (let i = 0; i < anim.frames; i++) {
        frames.push({ key: ATLAS_KEY, frame: `${anim.key}_${String(i).padStart(2, "0")}` });
      }
      this.anims.create({
        key,
        frames,
        frameRate: 8,
        repeat: anim.loop ? -1 : 0,
      });
    }
  }

  private drawTileGrid(): void {
    const g = this.add.graphics();
    g.setDepth(-1000);
    for (let ix = -GRID_RADIUS; ix <= GRID_RADIUS; ix++) {
      for (let iy = -GRID_RADIUS; iy <= GRID_RADIUS; iy++) {
        const { x, y } = isoToScreen(ix, iy);
        const shade = (ix + iy) & 1 ? 0x3a3f50 : 0x2e3340;
        g.fillStyle(shade, 1);
        g.beginPath();
        g.moveTo(x, y - TILE_HEIGHT / 2);
        g.lineTo(x + TILE_WIDTH / 2, y);
        g.lineTo(x, y + TILE_HEIGHT / 2);
        g.lineTo(x - TILE_WIDTH / 2, y);
        g.closePath();
        g.fillPath();
        g.lineStyle(1, 0x1f2230, 0.6);
        g.strokePath();
      }
    }
  }

  private playAnim(action: Action, direction: Direction): void {
    const resolved = atlasAnimationKey(action, direction);
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
      const inputIso = ix !== 0 || iy !== 0 ? { x: ix, y: iy } : screenToIso(moveVec.x, moveVec.y);
      this.facing = directionFromVector(inputIso, this.facing);
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

    this.mp.sendUpdate({
      action: this.action,
      facing: this.facing,
      name: this.localName,
      speed: moving ? MOVE_SPEED : 0,
      x: this.player.x,
      y: this.player.y,
    });

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
    const sprite = this.add.sprite(state.x, state.y, ATLAS_KEY, "idle_se_00");
    sprite.setOrigin(0.5, 1);
    const label = this.add.text(state.x, state.y - sprite.displayHeight, state.name, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      color: "#ffd27a",
      stroke: "#000000",
      strokeThickness: 3,
    });
    label.setOrigin(0.5, 1);
    const dir = (DIRECTIONS as readonly Direction[]).includes(state.facing) ? state.facing : "se";
    const resolved = atlasAnimationKey(state.action, dir);
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
    const resolved = atlasAnimationKey(state.action, dir);
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
