import { Application } from "pixi.js";

export interface CreatePixiAppOptions {
  host: HTMLElement;
  backgroundAlpha?: number;
  maxDpr?: number;
}

export async function createPixiApp({
  host,
  backgroundAlpha = 0,
  maxDpr = 2,
}: CreatePixiAppOptions): Promise<Application> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    backgroundAlpha,
    antialias: false,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, maxDpr),
    preference: "webgl",
  });

  app.canvas.style.width = "100%";
  app.canvas.style.height = "100%";
  app.canvas.style.display = "block";
  app.canvas.style.pointerEvents = "none";

  return app;
}
