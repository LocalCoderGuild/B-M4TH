import { Container, Graphics, type Ticker } from "pixi.js";

interface ConfettiParticle {
  g: Graphics;
  active: boolean;
  age: number;
  life: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: number;
}

const COLORS = [0xff6fb1, 0x3dd6d0, 0xffd166, 0x30d99b, 0x8e44ad, 0x4cc9f0];

export class Confetti {
  readonly container = new Container();
  private readonly pool: ConfettiParticle[] = [];

  constructor(private readonly maxParticles = 220) {}

  burst(width: number, height: number, count = 80): void {
    for (let i = 0; i < count; i++) {
      const p = this.nextParticle();
      if (!p) return;
      p.active = true;
      p.age = 0;
      p.life = 1100 + Math.random() * 900;
      p.x = width * (0.2 + Math.random() * 0.6);
      p.y = height * 0.12 + Math.random() * 32;
      p.vx = -2.2 + Math.random() * 4.4;
      p.vy = -2 - Math.random() * 4;
      p.rot = Math.random() * Math.PI;
      p.vr = -0.16 + Math.random() * 0.32;
      p.size = 5 + Math.random() * 8;
      p.color = COLORS[Math.floor(Math.random() * COLORS.length)]!;
      p.g.visible = true;
      p.g.alpha = 1;
      this.draw(p);
    }
  }

  update(ticker: Ticker): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.age += ticker.deltaMS;
      if (p.age >= p.life) {
        p.active = false;
        p.g.visible = false;
        continue;
      }
      p.x += p.vx * ticker.deltaTime;
      p.y += p.vy * ticker.deltaTime;
      p.vy += 0.075 * ticker.deltaTime;
      p.rot += p.vr * ticker.deltaTime;
      p.g.alpha = Math.max(0, 1 - p.age / p.life);
      this.draw(p);
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.pool.length = 0;
  }

  private nextParticle(): ConfettiParticle | null {
    let particle = this.pool.find((p) => !p.active);
    if (!particle && this.pool.length < this.maxParticles) {
      const g = new Graphics();
      g.eventMode = "none";
      particle = {
        g,
        active: false,
        age: 0,
        life: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rot: 0,
        vr: 0,
        size: 0,
        color: 0xffffff,
      };
      this.pool.push(particle);
      this.container.addChild(g);
    }
    return particle ?? null;
  }

  private draw(p: ConfettiParticle): void {
    p.g.clear();
    p.g.position.set(p.x, p.y);
    p.g.rotation = p.rot;
    p.g.rect(-p.size / 2, -p.size / 2, p.size, Math.max(3, p.size * 0.58)).fill({ color: p.color });
  }
}
