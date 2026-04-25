import { Container, Graphics, type Ticker } from "pixi.js";

interface SparkleParticle {
  g: Graphics;
  active: boolean;
  age: number;
  life: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
}

export class PuzzleSparkles {
  readonly container = new Container();
  private readonly pool: SparkleParticle[] = [];
  private readonly maxParticles: number;

  constructor(maxParticles = 140) {
    this.maxParticles = maxParticles;
  }

  pulse(x: number, y: number, color = 0xffd166): void {
    this.burst(x, y, { count: 10, color, speed: 1.3, size: 5, life: 420 });
  }

  burst(
    x: number,
    y: number,
    options: Partial<{ count: number; color: number; speed: number; size: number; life: number }> = {},
  ): void {
    const count = options.count ?? 14;
    const color = options.color ?? 0xffffff;
    const speed = options.speed ?? 2;
    const size = options.size ?? 4;
    const life = options.life ?? 620;

    for (let i = 0; i < count; i++) {
      const p = this.nextParticle();
      if (!p) return;
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.28;
      const velocity = speed * (0.55 + Math.random() * 0.8);
      p.active = true;
      p.age = 0;
      p.life = life * (0.75 + Math.random() * 0.45);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * velocity;
      p.vy = Math.sin(angle) * velocity - 0.25;
      p.size = size * (0.65 + Math.random() * 0.7);
      p.color = color;
      p.g.visible = true;
      p.g.alpha = 1;
      this.draw(p);
    }
  }

  update(ticker: Ticker): void {
    const dt = ticker.deltaMS;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        p.g.visible = false;
        continue;
      }
      const t = p.age / p.life;
      p.x += p.vx * ticker.deltaTime;
      p.y += p.vy * ticker.deltaTime;
      p.vy += 0.035 * ticker.deltaTime;
      p.g.alpha = 1 - t;
      p.g.scale.set(1 + t * 0.7);
      this.draw(p);
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.pool.length = 0;
  }

  private nextParticle(): SparkleParticle | null {
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
        size: 0,
        color: 0xffffff,
      };
      this.pool.push(particle);
      this.container.addChild(g);
    }
    return particle ?? null;
  }

  private draw(p: SparkleParticle): void {
    const half = p.size / 2;
    p.g.clear();
    p.g.moveTo(p.x, p.y - p.size)
      .lineTo(p.x + half, p.y - half)
      .lineTo(p.x + p.size, p.y)
      .lineTo(p.x + half, p.y + half)
      .lineTo(p.x, p.y + p.size)
      .lineTo(p.x - half, p.y + half)
      .lineTo(p.x - p.size, p.y)
      .lineTo(p.x - half, p.y - half)
      .closePath()
      .fill({ color: p.color });
  }
}
