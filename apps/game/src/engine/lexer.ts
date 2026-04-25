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

function flushNumBuffer(buf: string): Token {
  if (buf.length > 1 && buf[0] === "0") {
    throw new LexError(`Multi-digit number cannot have a leading zero: "${buf}"`);
  }
  return { type: "number", value: parseInt(buf, 10) };
}

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
      if (numBuffer.length >= 3) {
        throw new LexError(
          `Number too long: concatenated digits cannot exceed 3 digits ("${numBuffer}${face}")`,
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
        tokens.push(flushNumBuffer(numBuffer));
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
    tokens.push(flushNumBuffer(numBuffer));
  }

  return tokens;
}
