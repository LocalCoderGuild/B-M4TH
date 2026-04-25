import type { Token } from "./lexer";

export class EvaluatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluatorError";
  }
}

// AST
type NumNode = { kind: "num"; value: number };
type BinNode = {
  kind: "bin";
  op: "+" | "-" | "×" | "÷";
  left: ASTNode;
  right: ASTNode;
};
type ASTNode = NumNode | BinNode;

function evalAST(node: ASTNode): number {
  if (node.kind === "num") return node.value;
  const l = evalAST(node.left);
  const r = evalAST(node.right);
  switch (node.op) {
    case "+": return l + r;
    case "-": return l - r;
    case "×": return l * r;
    case "÷":
      if (r === 0) throw new EvaluatorError("Division by zero");
      if (l % r !== 0) throw new EvaluatorError(`Non-integer division: ${l} ÷ ${r}`);
      return l / r;
  }
}

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  parseExpr(): ASTNode {
    // unary minus is allowed only as the very first token of an expression side
    let node: ASTNode;
    const first = this.tokens[this.pos];
    if (first?.type === "op" && first.op === "-") {
      this.pos++;
      const afterMinus = this.tokens[this.pos];
      if (afterMinus?.type === "number" && afterMinus.value === 0) {
        throw new EvaluatorError("Unary minus on zero (-0) is not valid");
      }
      node = { kind: "bin", op: "-", left: { kind: "num", value: 0 }, right: this.parseTerm() };
    } else {
      node = this.parseTerm();
    }
    while (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos];
      if (tok?.type === "op" && (tok.op === "+" || tok.op === "-")) {
        this.pos++;
        node = { kind: "bin", op: tok.op, left: node, right: this.parseTerm() };
      } else {
        break;
      }
    }
    return node;
  }

  parseTerm(): ASTNode {
    let node = this.parsePrimary();
    while (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos];
      if (tok?.type === "op" && (tok.op === "×" || tok.op === "÷")) {
        this.pos++;
        node = { kind: "bin", op: tok.op, left: node, right: this.parsePrimary() };
      } else {
        break;
      }
    }
    return node;
  }

  parsePrimary(): ASTNode {
    const tok = this.tokens[this.pos];
    if (tok?.type !== "number") {
      throw new EvaluatorError(
        `Expected number at position ${this.pos}, got ${tok?.type ?? "end of input"}`,
      );
    }
    this.pos++;
    return { kind: "num", value: tok.value };
  }

  isAtEnd(): boolean {
    return this.pos >= this.tokens.length;
  }
}

export function evaluate(tokens: Token[]): boolean {
  const eqIndices = tokens.reduce<number[]>((acc, t, i) => {
    if (t.type === "equals") acc.push(i);
    return acc;
  }, []);

  if (eqIndices.length === 0) throw new EvaluatorError("No equals sign in equation");

  // Split tokens into segments at each = sign (supports chain equations: a = b = c)
  const segments: Token[][] = [];
  let prev = 0;
  for (const idx of eqIndices) {
    segments.push(tokens.slice(prev, idx));
    prev = idx + 1;
  }
  segments.push(tokens.slice(prev));

  let referenceValue: number | null = null;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg.length === 0) {
      throw new EvaluatorError(
        i === 0 ? "Empty left side of equation" :
        i === segments.length - 1 ? "Empty right side of equation" :
        "Empty expression between equals signs",
      );
    }
    const parser = new Parser(seg);
    const ast = parser.parseExpr();
    if (!parser.isAtEnd()) {
      throw new EvaluatorError(
        i === 0 ? "Unexpected tokens on left side" : "Unexpected tokens in expression",
      );
    }
    const value = evalAST(ast);
    if (referenceValue === null) {
      referenceValue = value;
    } else if (value !== referenceValue) {
      return false;
    }
  }

  return true;
}
