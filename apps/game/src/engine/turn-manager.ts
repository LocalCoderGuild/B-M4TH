import type { Placement } from "@entities";
import { Board } from "./board";
import { TileBag } from "./tile-bag";
import { MoveValidator } from "./move-validator";
import { BoardScanner, type ScannedEquation } from "./board-scanner";
import { lex, LexError } from "./lexer";
import { evaluate, EvaluatorError } from "./evaluator";
import { Scorer, type TurnScoreBreakdown } from "./scorer";

export type PlayResult =
  | { ok: true; equations: ScannedEquation[] }
  | { ok: false; error: string };

export type SwapResult = { ok: true } | { ok: false; error: string };
export type PlayAndScoreResult =
  | { ok: true; equations: ScannedEquation[]; score: TurnScoreBreakdown }
  | { ok: false; error: string };

export class TurnManager {
  // Precondition: all placement tiles must already be placed on the board
  static validatePlay(
    board: Board,
    placements: Placement[],
    isFirstMove: boolean,
  ): PlayResult {
    if (placements.length === 0) {
      return { ok: false, error: "No tiles placed" };
    }

    if (!MoveValidator.isLinear(placements)) {
      return { ok: false, error: "Tiles must be placed in a single row or column" };
    }

    if (!MoveValidator.hasNoGaps(board, placements)) {
      return { ok: false, error: "Placement has gaps — all cells between placed tiles must be filled" };
    }

    if (!MoveValidator.isConnected(board, placements, isFirstMove)) {
      return {
        ok: false,
        error: isFirstMove
          ? "First move must cover the center square"
          : "Tiles must connect to an existing tile on the board",
      };
    }

    const equations = BoardScanner.scan(board, placements);

    if (equations.length === 0) {
      return { ok: false, error: "No valid equation formed (need at least 2 tiles in a line)" };
    }

    for (const eq of equations) {
      let tokens;
      try {
        tokens = lex(eq.faces);
      } catch (e) {
        if (e instanceof LexError) {
          return { ok: false, error: `Invalid tile sequence: ${e.message}` };
        }
        throw e;
      }

      let valid;
      try {
        valid = evaluate(tokens);
      } catch (e) {
        if (e instanceof EvaluatorError) {
          return { ok: false, error: `Invalid equation: ${e.message}` };
        }
        throw e;
      }

      if (!valid) {
        return { ok: false, error: `Equation is mathematically false: ${eq.faces.join(" ")}` };
      }
    }

    return { ok: true, equations };
  }

  static validateSwap(bag: TileBag): SwapResult {
    if (!bag.canSwap()) {
      return { ok: false, error: "Cannot swap: bag must have more than 5 tiles remaining" };
    }
    return { ok: true };
  }

  static validateAndScorePlay(
    board: Board,
    placements: Placement[],
    isFirstMove: boolean,
  ): PlayAndScoreResult {
    const result = this.validatePlay(board, placements, isFirstMove);
    if (!result.ok) return result;
    const score = Scorer.scoreTurn(board, placements, result.equations);
    return {
      ok: true,
      equations: result.equations,
      score,
    };
  }
}
