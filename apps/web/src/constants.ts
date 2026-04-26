export const BOARD_SIZE = 15;
export const BOARD_CENTER = Math.floor(BOARD_SIZE / 2);

export const FONT_FAMILY = '"Press Start 2P", monospace';
export const BOARD_BG_COLOR = "#070b18";

export const EVENTS = {
  BOARD_TOOLTIP: "b-m4th:board-tooltip",
  BOARD_TOOLTIP_HIDE: "b-m4th:board-tooltip-hide",
  ASSIGN_TILE: "b-m4th:assign-tile",
  PUZZLE_EFFECT: "b-m4th:puzzle-effect",
  BINGO_CALLOUT: "b-m4th:bingo-callout",
  COMBO_CALLOUT: "b-m4th:combo-callout",
} as const;
