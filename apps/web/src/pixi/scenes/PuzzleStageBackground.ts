import { Container, Graphics, type Application, type Ticker } from "pixi.js";
import { Confetti } from "../effects/Confetti";
import { PuzzleSparkles } from "../effects/PuzzleSparkles";

export interface PuzzleStageOptions {
  intensity: number;
  dither: boolean;
  vignette: boolean;
}

interface Floater {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
}

export class PuzzleStageBackground {
  readonly sparkles = new PuzzleSparkles();
  readonly confetti = new Confetti();
  private readonly root = new Container();
  private readonly backdrop = new Graphics();
  private readonly floatLayer = new Container();
  private readonly overlay = new Graphics();
  private readonly floaters: Floater[] = [];
  private twinkleMs = 0;
  private width = 1;
  private height = 1;
  private options: PuzzleStageOptions;

  constructor(private readonly app: Application, options: PuzzleStageOptions) {
    this.options = options;
    this.root.eventMode = "none";
    this.app.stage.addChild(this.root);
    this.root.addChild(this.backdrop, this.floatLayer, this.sparkles.container, this.confetti.container, this.overlay);
    this.buildFloaters();
    this.resize();
  }

  setOptions(options: PuzzleStageOptions): void {
    this.options = options;
    this.drawBackdrop();
  }

  resize(): void {
    this.width = Math.max(1, this.app.renderer.width / this.app.renderer.resolution);
    this.height = Math.max(1, this.app.renderer.height / this.app.renderer.resolution);
    this.drawBackdrop();
    for (const f of this.floaters) {
      f.x = Math.random() * this.width;
      f.y = Math.random() * this.height;
      this.drawFloater(f);
    }
  }

  update(ticker: Ticker): void {
    const motion = Math.max(0, this.options.intensity);
    for (const f of this.floaters) {
      f.x += f.vx * ticker.deltaTime * motion;
      f.y += f.vy * ticker.deltaTime * motion;
      if (f.x < -24) f.x = this.width + 24;
      if (f.x > this.width + 24) f.x = -24;
      if (f.y < -24) f.y = this.height + 24;
      if (f.y > this.height + 24) f.y = -24;
      this.drawFloater(f);
    }

    this.twinkleMs += ticker.deltaMS * motion;
    if (this.twinkleMs > 760) {
      this.twinkleMs = 0;
      this.sparkles.burst(Math.random() * this.width, Math.random() * this.height * 0.72, {
        count: 4,
        color: 0xffffff,
        speed: 0.55,
        size: 3,
        life: 520,
      });
    }
    this.sparkles.update(ticker);
    this.confetti.update(ticker);
  }

  onCellSelect(x: number, y: number): void {
    this.sparkles.pulse(x, y, 0xffd166);
  }

  onEntryCorrect(x: number, y: number): void {
    this.sparkles.burst(x, y, { count: 16, color: 0x30d99b, speed: 2.1, size: 4, life: 620 });
  }

  onEntryWrong(x: number, y: number): void {
    this.sparkles.burst(x, y, { count: 10, color: 0xff4d6d, speed: 1.4, size: 5, life: 420 });
  }

  onCombo(level: number, x?: number, y?: number): void {
    const count = Math.min(30, 10 + level * 4);
    this.sparkles.burst(x ?? this.width * 0.5, y ?? this.height * 0.22, {
      count,
      color: 0xff6fb1,
      speed: 2.4,
      size: 5,
      life: 760,
    });
  }

  onBingo(): void {
    this.confetti.burst(this.width, this.height, 110);
    this.sparkles.burst(this.width * 0.5, this.height * 0.35, {
      count: 36,
      color: 0xffd166,
      speed: 3,
      size: 6,
      life: 980,
    });
  }

  onPuzzleComplete(): void {
    this.confetti.burst(this.width, this.height, 150);
    this.sparkles.burst(this.width * 0.5, this.height * 0.45, {
      count: 44,
      color: 0x3dd6d0,
      speed: 3.2,
      size: 5,
      life: 1200,
    });
  }

  destroy(): void {
    this.sparkles.destroy();
    this.confetti.destroy();
    this.root.destroy({ children: true });
  }

  private buildFloaters(): void {
    const colors = [0xd76a2d, 0xc74363, 0xe6b84a, 0x6f7895];
    for (let i = 0; i < 18; i++) {
      const g = new Graphics();
      g.eventMode = "none";
      const floater: Floater = {
        g,
        x: 0,
        y: 0,
        vx: -0.18 + Math.random() * 0.36,
        vy: 0.04 + Math.random() * 0.14,
        size: 4 + Math.random() * 10,
        color: colors[i % colors.length]!,
      };
      this.floaters.push(floater);
      this.floatLayer.addChild(g);
    }
  }

  private drawBackdrop(): void {
    this.backdrop.clear();
    const bands = [
      { y: 0, h: 0.28, color: 0x101522 },
      { y: 0.28, h: 0.24, color: 0x0d1220 },
      { y: 0.52, h: 0.25, color: 0x0a0e19 },
      { y: 0.77, h: 0.23, color: 0x070a12 },
    ];
    for (const band of bands) {
      this.backdrop.rect(0, this.height * band.y, this.width, this.height * band.h + 1).fill({ color: band.color });
    }
    this.backdrop.circle(this.width * 0.15, this.height * 0.16, Math.min(this.width, this.height) * 0.2).fill({
      color: 0xd76a2d,
      alpha: 0.055,
    });
    this.backdrop.circle(this.width * 0.86, this.height * 0.28, Math.min(this.width, this.height) * 0.18).fill({
      color: 0xc74363,
      alpha: 0.05,
    });

    this.overlay.clear();
    if (this.options.dither) {
      const step = 8;
      for (let y = 0; y < this.height; y += step) {
        for (let x = (y / step) % 2 === 0 ? 0 : step / 2; x < this.width; x += step) {
          this.overlay.rect(x, y, 1, 1).fill({ color: 0xf2f0df, alpha: 0.045 });
        }
      }
    }
    if (this.options.vignette) {
      const edge = Math.max(this.width, this.height);
      this.overlay.rect(0, 0, this.width, this.height).stroke({ width: edge * 0.055, color: 0x000000, alpha: 0.24 });
    }
  }

  private drawFloater(f: Floater): void {
    f.g.clear();
    f.g.position.set(Math.round(f.x), Math.round(f.y));
    f.g.rect(-f.size / 2, -f.size / 2, f.size, f.size).fill({ color: f.color, alpha: 0.08 });
    f.g.rect(-f.size / 2, -f.size / 2, f.size, f.size).stroke({ width: 1, color: f.color, alpha: 0.18 });
  }
}
