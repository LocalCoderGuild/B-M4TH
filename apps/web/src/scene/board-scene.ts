import {
  Application,
  Container,
  Graphics,
  Rectangle,
  Text,
  TextStyle,
  type FederatedPointerEvent,
} from "pixi.js";
import type { BoardCellView } from "../store/match-store";
import type { PendingPlacement, PremiumType } from "../types";

const GRID = 15;

const PREMIUM_COLORS: Record<string, number> = {
  normal: 0x171d2b,
  "2x_piece": 0xc97846, // 2P — orange
  "3x_piece": 0x2d8b8f, // 3P — cyan
  "2x_eq": 0xd6a84a,    // 2E — yellow
  "3x_eq": 0xa33f4e,    // 3E — red
};

const PREMIUM_LABELS: Record<string, string> = {
  "2x_piece": "2P",
  "3x_piece": "3P",
  "2x_eq": "2E",
  "3x_eq": "3E",
};

export interface BoardSceneCallbacks {
  onCellPointerUp: (row: number, col: number) => void;
  onCellPointerEnter: (row: number, col: number) => void;
  onCellPointerLeave: () => void;
  onPlacedTileClick: (row: number, col: number) => void;
  onPendingTileClick: (row: number, col: number) => void;
}

/** Pixi v8 structure: each cell is a Container (the sole event target) with a
 * child Graphics bg and an optional Text label. Pixi v8's Graphics extends
 * ViewContainer with allowChildren=false — adding children directly to a
 * Graphics logs a deprecation warning and breaks rendering. */
interface CellNode {
  container: Container;
  bg: Graphics;
  label: Text | null;
  tileContainer: Container;
}

export class BoardScene {
  private readonly app: Application;
  private readonly host: HTMLElement;
  private readonly callbacks: BoardSceneCallbacks;
  private readonly root = new Container();
  private readonly cellLayer = new Container();
  private readonly tileLayer = new Container();
  private readonly lastMoveLayer = new Container();
  private readonly ghostLayer = new Container();
  private readonly opponentGhostLayer = new Container();
  private readonly highlightLayer = new Container();
  private readonly cells: CellNode[][] = [];
  private cellSize = 40;
  private disposed = false;
  private initialized = false;
  private resizeObserver: ResizeObserver | null = null;
  private currentBoard: BoardCellView[] = [];
  private currentPending: PendingPlacement[] = [];
  private currentHover: { row: number; col: number } | null = null;
  private currentLastMoveIndices: number[] = [];
  private currentLastMoveColor = "";
  private currentOpponentPending: PendingPlacement[] = [];
  private currentOpponentColor = "";

  constructor(host: HTMLElement, callbacks: BoardSceneCallbacks) {
    this.app = new Application();
    this.host = host;
    this.callbacks = callbacks;
  }

  async init(): Promise<void> {
    if (this.disposed) return;
    // Wait for Press Start 2P (loaded via <link>) before Pixi bakes text atlases.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        /* non-fatal */
      }
    }
    await this.app.init({
      background: "#070b18",
      resizeTo: this.host,
      antialias: false,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });
    this.initialized = true;
    if (this.disposed) {
      this.teardown();
      return;
    }
    this.host.innerHTML = "";
    this.host.appendChild(this.app.canvas);
    this.app.canvas.style.imageRendering = "pixelated";
    this.app.stage.addChild(this.root);
    this.root.addChild(this.cellLayer);
    this.root.addChild(this.tileLayer);
    this.root.addChild(this.lastMoveLayer);
    this.root.addChild(this.ghostLayer);
    this.root.addChild(this.opponentGhostLayer);
    this.root.addChild(this.highlightLayer);
    this.buildCells();
    this.layout();

    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(this.host);
  }

  destroy(): void {
    this.disposed = true;
    if (this.initialized) this.teardown();
  }

  private teardown(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    try {
      this.app.destroy(true, { children: true });
    } catch {
      /* best-effort */
    }
  }

  private buildCells(): void {
    for (let row = 0; row < GRID; row++) {
      const rowArr: CellNode[] = [];
      for (let col = 0; col < GRID; col++) {
        // Container is the event target — a single interactive object per cell.
        const container = new Container();
        container.eventMode = "static";
        container.cursor = "pointer";
        // Fixed hitArea covers the whole cell, regardless of what's drawn inside.
        container.hitArea = new Rectangle(0, 0, 1, 1); // updated in layout()

        const rowRef = row;
        const colRef = col;
        container.on("pointerup", (event: FederatedPointerEvent) => {
          event.stopPropagation();
          this.emitEffect("cell-select", rowRef, colRef);
          const cell = this.currentBoard[rowRef * GRID + colRef];
          if (cell?.tile) {
            this.callbacks.onPlacedTileClick(rowRef, colRef);
          } else {
            this.callbacks.onCellPointerUp(rowRef, colRef);
          }
        });
        container.on("pointerover", (event: FederatedPointerEvent) => {
          this.callbacks.onCellPointerEnter(rowRef, colRef);
          this.emitPremiumTooltip(rowRef, colRef, event);
        });
        container.on("pointermove", (event: FederatedPointerEvent) => {
          this.emitPremiumTooltip(rowRef, colRef, event);
        });
        container.on("pointerout", () => {
          this.callbacks.onCellPointerLeave();
          window.dispatchEvent(new CustomEvent("b-m4th:board-tooltip-hide"));
        });

        const bg = new Graphics();
        bg.eventMode = "none";
        const tileContainer = new Container();
        tileContainer.eventMode = "none";

        container.addChild(bg);
        container.addChild(tileContainer);
        this.cellLayer.addChild(container);

        rowArr.push({ container, bg, label: null, tileContainer });
      }
      this.cells.push(rowArr);
    }
  }

  private layout(): void {
    const size = Math.min(this.host.clientWidth, this.host.clientHeight);
    if (size <= 0) return;
    const padding = 8;
    const available = size - padding * 2;
    const cell = Math.max(16, Math.floor(available / GRID));
    this.cellSize = cell;
    const gridPx = cell * GRID;
    this.root.position.set(
      Math.floor((this.host.clientWidth - gridPx) / 2),
      Math.floor((this.host.clientHeight - gridPx) / 2),
    );
    const hit = new Rectangle(0, 0, cell, cell);
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const node = this.cells[r]![c]!;
        node.container.position.set(c * cell, r * cell);
        node.container.hitArea = hit;
      }
    }
    this.renderBoard(this.currentBoard);
    this.renderPending(this.currentPending);
    this.renderHover(this.currentHover);
    this.renderLastMove(this.currentLastMoveIndices, this.currentLastMoveColor);
    this.renderOpponentPending(this.currentOpponentPending, this.currentOpponentColor);
  }

  renderBoard(board: BoardCellView[]): void {
    this.currentBoard = board;
    for (let i = 0; i < board.length; i++) {
      const cell = board[i]!;
      const row = Math.floor(i / GRID);
      const col = i % GRID;
      const node = this.cells[row]?.[col];
      if (!node) continue;
      this.drawCellBg(node.bg, cell.premium as PremiumType, row, col);
      this.drawCellLabel(node, cell.premium);
      this.drawPlacedTile(node, cell);
    }
  }

  renderPending(pending: PendingPlacement[]): void {
    this.currentPending = pending;
    this.ghostLayer.removeChildren();
    for (const p of pending) {
      const g = this.makeTileGraphic(p.face, p.assignedFace ?? null, p.value, true);
      g.position.set(p.col * this.cellSize, p.row * this.cellSize);
      g.eventMode = "static";
      g.cursor = "pointer";
      g.hitArea = new Rectangle(0, 0, this.cellSize, this.cellSize);
      g.on("pointerup", (event: FederatedPointerEvent) => {
        event.stopPropagation();
        this.callbacks.onPendingTileClick(p.row, p.col);
      });
      this.ghostLayer.addChild(g);
    }
  }

  renderHover(hover: { row: number; col: number } | null): void {
    this.currentHover = hover;
    this.highlightLayer.removeChildren();
    if (!hover) return;
    const g = new Graphics();
    g.rect(hover.col * this.cellSize, hover.row * this.cellSize, this.cellSize, this.cellSize)
      .fill({ color: 0xffd45c, alpha: 0.12 })
      .stroke({ width: 4, color: 0xffd45c, alpha: 0.95 });
    g.rect(
      hover.col * this.cellSize + 5,
      hover.row * this.cellSize + 5,
      this.cellSize - 10,
      this.cellSize - 10,
    ).stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
    g.eventMode = "none";
    this.highlightLayer.addChild(g);
  }

  /** Draw a persistent colored border on cells from the last completed move. */
  renderLastMove(indices: number[], colorHex: string): void {
    this.currentLastMoveIndices = indices;
    this.currentLastMoveColor = colorHex;
    this.lastMoveLayer.removeChildren();
    if (!indices.length || !colorHex) return;
    const color = parseInt(colorHex.replace("#", ""), 16);
    for (const idx of indices) {
      const row = Math.floor(idx / GRID);
      const col = idx % GRID;
      const g = new Graphics();
      const inset = 1;
      const size = this.cellSize - inset * 2;
      g.rect(col * this.cellSize + inset, row * this.cellSize + inset, size, size)
        .stroke({ width: 3, color, alpha: 0.9 });
      g.eventMode = "none";
      this.lastMoveLayer.addChild(g);
    }
  }

  /** Draw semi-transparent ghost tiles for the opponent's live pending placements. */
  renderOpponentPending(pending: PendingPlacement[], colorHex: string): void {
    this.currentOpponentPending = pending;
    this.currentOpponentColor = colorHex;
    this.opponentGhostLayer.removeChildren();
    if (!pending.length) return;
    const color = colorHex ? parseInt(colorHex.replace("#", ""), 16) : 0x35f0d0;
    for (const p of pending) {
      const g = this.makeOpponentGhostTile(p, color);
      g.position.set(p.col * this.cellSize, p.row * this.cellSize);
      g.eventMode = "none";
      this.opponentGhostLayer.addChild(g);
    }
  }

  highlightLastPlaced(indices: number[]): void {
    for (const idx of indices) {
      const row = Math.floor(idx / GRID);
      const col = idx % GRID;
      const node = this.cells[row]?.[col];
      if (!node) continue;
      this.emitEffect("entry-correct", row, col);
      node.container.scale.set(1.02);
      node.bg.tint = 0xffffff;
      setTimeout(() => {
        node.container.scale.set(1);
      }, 160);
    }
  }

  /* ---------------- drawing helpers ---------------- */

  private makeOpponentGhostTile(p: PendingPlacement, colorNum: number): Container {
    const container = new Container();
    const size = this.cellSize - 4;
    const offset = 2;
    const displayFace = (p.assignedFace && p.assignedFace.length > 0) ? p.assignedFace : p.face;
    const bg = new Graphics();
    bg.rect(offset, offset, size, size)
      .fill({ color: colorNum, alpha: 0.18 })
      .stroke({ width: 3, color: colorNum, alpha: 0.7 });
    bg.rect(offset + 4, offset + 4, Math.max(1, size - 8), Math.max(1, size - 8))
      .stroke({ width: 1, color: 0xffffff, alpha: 0.12 });
    bg.eventMode = "none";
    container.addChild(bg);
    const faceStyle = new TextStyle({
      fontFamily: "\"Press Start 2P\", monospace",
      fontSize: Math.max(10, Math.floor(size * 0.42)),
      fill: 0xffffff,
      fontWeight: "400",
      dropShadow: { color: 0x050816, blur: 0, distance: 1, alpha: 0.9 },
    });
    const faceText = new Text({ text: displayFace, style: faceStyle });
    faceText.anchor.set(0.5);
    faceText.position.set(this.cellSize / 2, this.cellSize / 2);
    faceText.alpha = 0.8;
    faceText.eventMode = "none";
    container.addChild(faceText);
    if (p.value > 0) {
      const valStyle = new TextStyle({
        fontFamily: "\"Press Start 2P\", monospace",
        fontSize: Math.max(6, Math.floor(size * 0.16)),
        fill: 0xccddff,
        fontWeight: "400",
      });
      const valText = new Text({ text: String(p.value), style: valStyle });
      valText.anchor.set(1, 1);
      valText.position.set(this.cellSize - 4, this.cellSize - 4);
      valText.alpha = 0.7;
      valText.eventMode = "none";
      container.addChild(valText);
    }
    return container;
  }

  private drawCellBg(g: Graphics, premium: PremiumType, row: number, col: number): void {
    g.clear();
    const color = PREMIUM_COLORS[premium] ?? PREMIUM_COLORS.normal!;
    const inset = 1;
    const size = this.cellSize - 2;
    const coreInset = Math.max(3, Math.floor(this.cellSize * 0.14));
    g.rect(inset, inset, size, size).fill({ color: 0x0a0d15 });
    g.rect(inset + 1, inset + 1, Math.max(1, size - 2), Math.max(1, size - 2)).fill({ color, alpha: 0.92 });
    g.rect(inset + coreInset, inset + coreInset, Math.max(1, size - coreInset * 2), Math.max(1, size - coreInset * 2)).fill({
      color: 0x070b18,
      alpha: premium === "normal" ? 0.18 : 0.26,
    });
    g.rect(inset + 3, inset + 3, Math.max(1, size - 6), Math.max(1, size - 6)).stroke({
      width: 1,
      color: 0xffffff,
      alpha: premium === "normal" ? 0.08 : 0.14,
    });
    g.rect(inset, inset, size, size).stroke({ width: 2, color: 0x050816 });
    g.rect(inset + 2, inset + 2, Math.max(1, size - 4), Math.max(1, size - 4)).stroke({
      width: 1,
      color: 0xffffff,
      alpha: 0.08,
    });
    if (row === 7 && col === 7) {
      const star = Math.max(5, this.cellSize * 0.16);
      g.moveTo(this.cellSize / 2, this.cellSize / 2 - star)
        .lineTo(this.cellSize / 2 + star * 0.32, this.cellSize / 2 - star * 0.32)
        .lineTo(this.cellSize / 2 + star, this.cellSize / 2)
        .lineTo(this.cellSize / 2 + star * 0.32, this.cellSize / 2 + star * 0.32)
        .lineTo(this.cellSize / 2, this.cellSize / 2 + star)
        .lineTo(this.cellSize / 2 - star * 0.32, this.cellSize / 2 + star * 0.32)
        .lineTo(this.cellSize / 2 - star, this.cellSize / 2)
        .lineTo(this.cellSize / 2 - star * 0.32, this.cellSize / 2 - star * 0.32)
        .closePath()
        .fill({ color: 0xffd45c, alpha: 0.82 });
    }
  }

  private drawCellLabel(node: CellNode, premium: string): void {
    if (node.label) {
      node.container.removeChild(node.label);
      node.label.destroy();
      node.label = null;
    }
    const text = PREMIUM_LABELS[premium];
    if (!text) return;
    const style = new TextStyle({
      fontFamily: "\"Press Start 2P\", monospace",
      fontSize: Math.max(8, Math.floor(this.cellSize * 0.26)),
      fill: 0xfff3cf,
      fontWeight: "400",
      letterSpacing: 0,
      dropShadow: {
        color: 0x050816,
        blur: 0,
        distance: 2,
        alpha: 1,
      },
    });
    const label = new Text({ text, style });
    label.anchor.set(0.5);
    label.position.set(this.cellSize / 2, this.cellSize / 2 - Math.max(0, Math.floor(this.cellSize * 0.01)));
    label.alpha = 0.95;
    label.eventMode = "none";
    // Insert between bg (idx 0) and tileContainer (idx 1) so a placed tile
    // visually covers the premium label.
    const tileIdx = node.container.getChildIndex(node.tileContainer);
    node.container.addChildAt(label, tileIdx);
    node.label = label;
  }

  private drawPlacedTile(node: CellNode, cell: BoardCellView): void {
    node.tileContainer.removeChildren();
    if (!cell.tile) return;
    const face = cell.tile.assignedFace || cell.tile.face;
    const g = this.makeTileGraphic(face, cell.tile.assignedFace || null, cell.tile.value, false);
    node.tileContainer.addChild(g);
  }

  private makeTileGraphic(
    face: string,
    assignedFace: string | null,
    value: number,
    ghost: boolean,
  ): Container {
    const container = new Container();
    const size = this.cellSize - 4;
    const offset = 2;
    const bg = new Graphics();
    bg.rect(offset, offset, size, size)
      .fill({ color: ghost ? 0x24325d : 0xffd45c, alpha: ghost ? 0.78 : 1 })
      .stroke({ width: 3, color: ghost ? 0x35f0d0 : 0x050816 });
    bg.rect(offset + 4, offset + 4, Math.max(1, size - 8), Math.max(1, size - 8))
      .stroke({ width: 1, color: 0xffffff, alpha: ghost ? 0.16 : 0.28 });
    bg.rect(offset + 3, offset + size - 7, Math.max(1, size - 6), 3)
      .fill({ color: ghost ? 0x35f0d0 : 0xd78322, alpha: ghost ? 0.35 : 0.42 });
    bg.eventMode = "none";
    container.addChild(bg);

    const displayFace = assignedFace && assignedFace.length > 0 ? assignedFace : face;
    const faceStyle = new TextStyle({
      fontFamily: "\"Press Start 2P\", monospace",
      fontSize: Math.max(10, Math.floor(size * 0.42)),
      fill: ghost ? 0xf7fbff : 0x111832,
      fontWeight: "400",
      dropShadow: {
        color: ghost ? 0x050816 : 0xffffff,
        blur: 0,
        distance: 1,
        alpha: ghost ? 1 : 0.42,
      },
    });
    const faceText = new Text({ text: displayFace, style: faceStyle });
    faceText.anchor.set(0.5);
    faceText.position.set(this.cellSize / 2, this.cellSize / 2);
    faceText.eventMode = "none";
    container.addChild(faceText);

    if (value > 0) {
      const valStyle = new TextStyle({
        fontFamily: "\"Press Start 2P\", monospace",
        fontSize: Math.max(6, Math.floor(size * 0.16)),
        fill: ghost ? 0xa7b4e8 : 0x111832,
        fontWeight: "400",
      });
      const valText = new Text({ text: String(value), style: valStyle });
      valText.anchor.set(1, 1);
      valText.position.set(this.cellSize - 4, this.cellSize - 4);
      valText.eventMode = "none";
      container.addChild(valText);
    }

    if (assignedFace && face === "BLANK") {
      const badge = new Graphics();
      badge
        .rect(4, 4, Math.max(8, size * 0.25), Math.max(6, size * 0.2))
        .fill({ color: 0xff6fb1, alpha: 0.9 });
      badge.eventMode = "none";
      container.addChild(badge);
    }

    return container;
  }

  private emitEffect(type: "cell-select" | "entry-correct" | "entry-wrong", row: number, col: number): void {
    const canvasRect = this.app.canvas.getBoundingClientRect();
    const rootX = this.root.position.x + col * this.cellSize + this.cellSize / 2;
    const rootY = this.root.position.y + row * this.cellSize + this.cellSize / 2;
    const x = canvasRect.left + rootX;
    const y = canvasRect.top + rootY;
    window.dispatchEvent(new CustomEvent("b-m4th:puzzle-effect", { detail: { type, x, y } }));
  }

  private emitPremiumTooltip(row: number, col: number, event: FederatedPointerEvent): void {
    const cell = this.currentBoard[row * GRID + col];
    const tooltip = premiumTooltip(cell?.premium);
    if (!tooltip) {
      window.dispatchEvent(new CustomEvent("b-m4th:board-tooltip-hide"));
      return;
    }
    window.dispatchEvent(
      new CustomEvent("b-m4th:board-tooltip", {
        detail: {
          title: tooltip.title,
          body: tooltip.body,
          x: event.clientX,
          y: event.clientY,
        },
      }),
    );
  }
}

function premiumTooltip(premium?: string): { title: string; body: string } | null {
  if (premium === "2x_piece") return { title: "2P", body: "2x Piece Score" };
  if (premium === "3x_piece") return { title: "3P", body: "3x Piece Score" };
  if (premium === "2x_eq") return { title: "2E", body: "2x Equation Word Score" };
  if (premium === "3x_eq") return { title: "3E", body: "3x Equation Word Score" };
  return null;
}
