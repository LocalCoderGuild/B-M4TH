export type Token =
  | { type: "number"; value: number }
  | { type: "op"; op: "+" | "-" | "×" | "÷" }
  | { type: "equals" };

export class LexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LexError";
  }
}

const SINGLE_DIGIT_RE = /^\d$/;
const MULTI_DIGIT_RE = /^\d{2,}$/;

export function lex(faces: string[]): Token[] {
  const tokens: Token[] = [];
  let numBuffer = "";
  // true after any number token has been emitted; reset by operators/equals
  let prevWasNumber = false;

  for (const face of faces) {
    if (SINGLE_DIGIT_RE.test(face)) {
      // single-digit tile: cannot follow a standalone multi-digit tile
      if (prevWasNumber && numBuffer === "") {
        throw new LexError(
          `Single-digit tile "${face}" cannot be placed adjacent to a multi-digit tile`,
        );
      }
      numBuffer += face;
    } else if (MULTI_DIGIT_RE.test(face)) {
      // multi-digit tile: must stand alone — no adjacent number tiles on either side
      if (numBuffer !== "") {
        throw new LexError(
          `Multi-digit tile "${face}" cannot be adjacent to single-digit tiles`,
        );
      }
      if (prevWasNumber) {
        throw new LexError(
          `Multi-digit tile "${face}" cannot be adjacent to another number tile`,
        );
      }
      tokens.push({ type: "number", value: parseInt(face, 10) });
      prevWasNumber = true;
    } else {
      // operator or equals: flush single-digit buffer first
      if (numBuffer !== "") {
        tokens.push({ type: "number", value: parseInt(numBuffer, 10) });
        numBuffer = "";
      }
      prevWasNumber = false;
      if (face === "=") {
        tokens.push({ type: "equals" });
      } else if (face === "+" || face === "-" || face === "×" || face === "÷") {
        tokens.push({ type: "op", op: face });
      } else {
        throw new LexError(`Unrecognized token: "${face}"`);
      }
    }
  }

  if (numBuffer !== "") {
    tokens.push({ type: "number", value: parseInt(numBuffer, 10) });
  }

  return tokens;
}
