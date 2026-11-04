import type { WheelReading } from "./feed.js";

export type Phase = "ready" | "running" | "paused" | "over";
export interface Hazard {
  x: number;
  width: number;
  type: "rock" | "root";
  passed: boolean;
}
export interface Pace {
  speed: number;
  multiplier: number;
  spawnInterval: number;
  intensity: number;
}
export const GROUND = 390;
export const PLAYER_HEIGHT = 56;
export const PLAYER_WIDTH = 46;

export function paceFor(reading: WheelReading | null): Pace {
  const intensity =
    reading?.state === "ACTIVE"
      ? Math.min(1, Math.max(0.12, reading.rpm / 110, reading.speed / 900))
      : 0;
  return {
    intensity,
    speed: 205 + intensity * 155,
    multiplier: 1 + intensity * 2,
    spawnInterval: 2.25 - intensity * 0.85,
  };
}

export class GameEngine {
  phase: Phase = "ready";
  width = 1100;
  score = 0;
  elapsed = 0;
  distance = 0;
  offset = 0;
  jumpHeight = 0;
  velocity = 0;
  slideTime = 0;
  hazards: Hazard[] = [];
  pace = paceFor(null);
  speed = this.pace.speed;
  nextHazard = 2.4;
  jumps = 0;
  slides = 0;
  dodged = 0;
  quakeTime = 0;
  quakeCount = 0;
  onEnd: () => void = () => {};
  private rng: () => number;
  constructor(rng = Math.random) {
    this.rng = rng;
  }
  get playerX() {
    return Math.min(190, Math.max(78, this.width * 0.18));
  }
  get sliding() {
    return this.slideTime > 0 && this.jumpHeight === 0;
  }
  get playerBox() {
    const height = this.sliding ? 26 : PLAYER_HEIGHT;
    return {
      x: this.playerX - 16,
      y: GROUND - this.jumpHeight - height,
      width: PLAYER_WIDTH - 10,
      height: height - 5,
    };
  }
  start() {
    this.phase = "running";
    this.score = 0;
    this.elapsed = 0;
    this.distance = 0;
    this.offset = 0;
    this.jumpHeight = 0;
    this.velocity = 0;
    this.slideTime = 0;
    this.hazards = [];
    this.nextHazard = 2.4;
    this.speed = this.pace.speed;
    this.jumps = 0;
    this.slides = 0;
    this.dodged = 0;
  }
  pause() {
    if (this.phase === "running") this.phase = "paused";
  }
  resume() {
    if (this.phase === "paused") this.phase = "running";
  }
  jump() {
    if (this.phase !== "running" || this.jumpHeight > 0) return false;
    this.slideTime = 0;
    this.velocity = 720;
    this.jumpHeight = 0.1;
    this.jumps++;
    return true;
  }
  slide() {
    if (this.phase !== "running" || this.jumpHeight > 0 || this.sliding)
      return false;
    this.slideTime = 0.8;
    this.slides++;
    return true;
  }
  setReading(reading: WheelReading | null) {
    this.pace = paceFor(reading);
  }
  settle() {
    this.quakeTime = 1.2;
    this.quakeCount++;
  }
  updateEffects(dt: number) {
    this.quakeTime = Math.max(0, this.quakeTime - dt);
  }
  update(dt: number) {
    if (this.phase !== "running") return;
    // Limit catch-up after tab stalls; physics substeps prevent tunnelling through hazards.
    let remaining = Math.min(Math.max(dt, 0), 0.06);
    while (remaining > 0 && this.phase === "running") {
      const step = Math.min(remaining, 1 / 120);
      this.step(step);
      remaining -= step;
    }
  }
  private step(dt: number) {
    this.elapsed += dt;
    this.speed += (this.pace.speed - this.speed) * Math.min(1, dt * 2);
    this.offset += this.speed * dt;
    this.distance += (this.speed * dt) / 28;
    this.score += ((this.speed * dt) / 14) * this.pace.multiplier;
    this.slideTime = Math.max(0, this.slideTime - dt);
    if (this.jumpHeight > 0) {
      this.velocity -= 1800 * dt;
      this.jumpHeight = Math.max(0, this.jumpHeight + this.velocity * dt);
      if (this.jumpHeight === 0) this.velocity = 0;
    }
    this.nextHazard -= dt;
    if (this.nextHazard <= 0) {
      // Fixed minimum separation leaves time to recover from a jump or slide.
      this.hazards.push({
        x: this.width + 70,
        width: 42,
        type: this.elapsed < 7 || this.rng() < 0.62 ? "rock" : "root",
        passed: false,
      });
      this.nextHazard = this.pace.spawnInterval + this.rng() * 0.45;
    }
    const player = this.playerBox;
    for (const hazard of this.hazards) {
      hazard.x -= this.speed * dt;
      if (!hazard.passed && hazard.x + hazard.width < player.x) {
        hazard.passed = true;
        this.dodged++;
      }
      const obstacle =
        hazard.type === "rock"
          ? {
              x: hazard.x + 5,
              y: GROUND - 37,
              width: hazard.width - 10,
              height: 37,
            }
          : {
              x: hazard.x + 6,
              y: GROUND - 139,
              width: hazard.width - 8,
              height: 102,
            };
      if (
        player.x < obstacle.x + obstacle.width &&
        player.x + player.width > obstacle.x &&
        player.y < obstacle.y + obstacle.height &&
        player.y + player.height > obstacle.y
      ) {
        this.phase = "over";
        this.onEnd();
        return;
      }
    }
    this.hazards = this.hazards.filter((hazard) => hazard.x > -100);
  }
}
