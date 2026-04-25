import { describe, expect, test } from "bun:test";
import { lex, LexError } from "@engine/lexer";
import { evaluate, EvaluatorError } from "@engine/evaluator";

function eq(faces: string[]): boolean {
  return evaluate(lex(faces));
}

describe("evaluate - basic arithmetic", () => {
  test("2 + 3 = 5 is true", () => {
    expect(eq(["2", "+", "3", "=", "5"])).toBe(true);
  });

  test("2 + 3 = 6 is false", () => {
    expect(eq(["2", "+", "3", "=", "6"])).toBe(false);
  });

  test("6 - 4 = 2 is true", () => {
    expect(eq(["6", "-", "4", "=", "2"])).toBe(true);
  });

  test("2 × 3 = 6 is true", () => {
    expect(eq(["2", "×", "3", "=", "6"])).toBe(true);
  });

  test("10 ÷ 2 = 5 is true", () => {
    expect(eq(["10", "÷", "2", "=", "5"])).toBe(true);
  });

  test("identity 13 = 13 is true", () => {
    expect(eq(["13", "=", "13"])).toBe(true);
  });

  test("identity 13 = 12 is false", () => {
    expect(eq(["13", "=", "12"])).toBe(false);
  });

  test("0 ÷ 5 = 0 is true", () => {
    expect(eq(["0", "÷", "5", "=", "0"])).toBe(true);
  });
});

describe("evaluate - BODMAS/PEMDAS", () => {
  test("2 + 3 × 4 = 14  (× before +)", () => {
    expect(eq(["2", "+", "3", "×", "4", "=", "14"])).toBe(true);
  });

  test("2 × 3 + 4 = 10  (× before +)", () => {
    expect(eq(["2", "×", "3", "+", "4", "=", "10"])).toBe(true);
  });

  test("2 + 3 × 4 = 20 is false (that would be left-to-right)", () => {
    expect(eq(["2", "+", "3", "×", "4", "=", "20"])).toBe(false);
  });

  test("12 ÷ 4 + 1 = 4", () => {
    expect(eq(["12", "÷", "4", "+", "1", "=", "4"])).toBe(true);
  });

  test("2 × 3 + 4 × 5 = 26", () => {
    expect(eq(["2", "×", "3", "+", "4", "×", "5", "=", "26"])).toBe(true);
  });

  test("both sides can be expressions: 2 + 3 = 1 + 4", () => {
    expect(eq(["2", "+", "3", "=", "1", "+", "4"])).toBe(true);
  });
});

describe("evaluate - digit concatenation", () => {
  test("1 0 + 5 = 15  (10 from adjacent tiles)", () => {
    expect(eq(["1", "0", "+", "5", "=", "15"])).toBe(true);
  });

  test("2 × 1 0 = 20", () => {
    expect(eq(["2", "×", "1", "0", "=", "20"])).toBe(true);
  });
});

describe("evaluate - integer division enforcement", () => {
  test("non-integer division throws EvaluatorError", () => {
    expect(() => eq(["10", "÷", "3", "=", "3"])).toThrow(EvaluatorError);
  });

  test("division by zero throws EvaluatorError", () => {
    expect(() => eq(["5", "÷", "0", "=", "1"])).toThrow(EvaluatorError);
  });
});

describe("evaluate - unary minus", () => {
  test("-2 × 5 = -10 is true", () => {
    expect(eq(["-", "2", "×", "5", "=", "-", "1", "0"])).toBe(true);
  });

  test("+2 × -5 = -10 throws EvaluatorError (op-to-op: × followed by -)", () => {
    expect(() => eq(["+", "2", "×", "-", "5", "=", "-", "1", "0"])).toThrow(EvaluatorError);
  });

  test("leading minus on right side: 5 - 8 = -3 is true", () => {
    expect(eq(["5", "-", "8", "=", "-", "3"])).toBe(true);
  });

  test("unary minus mid-expression after × throws EvaluatorError", () => {
    expect(() => eq(["2", "×", "-", "5", "=", "-", "1", "0"])).toThrow(EvaluatorError);
  });

  test("-0 throws EvaluatorError", () => {
    expect(() => eq(["-", "0", "=", "0"])).toThrow(EvaluatorError);
  });

  test("+0 throws EvaluatorError (unary + is never valid)", () => {
    expect(() => eq(["+", "0", "=", "0"])).toThrow(EvaluatorError);
  });
});

describe("evaluate - chain equations", () => {
  test("-10 + 9 = -1 = -10 ÷ 10 is true", () => {
    expect(eq(["-", "1", "0", "+", "9", "=", "-", "1", "=", "-", "1", "0", "÷", "1", "0"])).toBe(true);
  });

  test("5 = 5 = 5 is true", () => {
    expect(eq(["5", "=", "5", "=", "5"])).toBe(true);
  });

  test("2 + 3 = 10 ÷ 2 = 5 is true", () => {
    expect(eq(["2", "+", "3", "=", "10", "÷", "2", "=", "5"])).toBe(true);
  });

  test("1 = 1 = 2 is false (segments disagree)", () => {
    expect(eq(["1", "=", "1", "=", "2"])).toBe(false);
  });

  test("adjacent equals signs throw EvaluatorError (empty segment)", () => {
    expect(() => eq(["1", "=", "=", "1"])).toThrow(EvaluatorError);
  });

  test("15-tile chain with multiple equals: 1+2=3=1×3=9÷3=3 is true", () => {
    expect(eq(["1", "+", "2", "=", "3", "=", "1", "×", "3", "=", "9", "÷", "3", "=", "3"])).toBe(true);
  });

  test("chain with minus: 5-2=3=4-1=3 is true", () => {
    expect(eq(["5", "-", "2", "=", "3", "=", "4", "-", "1", "=", "3"])).toBe(true);
  });

  test("chain with minus: 9-3=6=8-2=10-4=6 is true", () => {
    expect(eq(["9", "-", "3", "=", "6", "=", "8", "-", "2", "=", "1", "0", "-", "4", "=", "6"])).toBe(true);
  });

  test("chain with blanks and 3 equals: -8+2×3=-2=10-12=-2 is true", () => {
    expect(eq(["-", "8", "+", "2", "×", "3", "=", "-", "2", "=", "1", "0", "-", "1", "2", "=", "-", "2"])).toBe(true);
  });
});

describe("evaluate - structural errors", () => {
  test("no equals sign throws EvaluatorError", () => {
    expect(() => evaluate([{ type: "number", value: 5 }])).toThrow(EvaluatorError);
  });

  test("chain equation 1 = 1 = 1 is true", () => {
    expect(eq(["1", "=", "1", "=", "1"])).toBe(true);
  });

  test("empty left side throws EvaluatorError", () => {
    expect(() => eq(["=", "5"])).toThrow(EvaluatorError);
  });

  test("empty right side throws EvaluatorError", () => {
    expect(() => eq(["5", "="])).toThrow(EvaluatorError);
  });

  test("operator without right operand throws EvaluatorError", () => {
    expect(() => eq(["5", "+", "=", "5"])).toThrow(EvaluatorError);
  });

  test("consecutive operators throws EvaluatorError", () => {
    expect(() => eq(["5", "+", "+", "3", "=", "8"])).toThrow(EvaluatorError);
  });

  test("trailing operator throws EvaluatorError", () => {
    expect(() => eq(["5", "+", "3", "+", "=", "8"])).toThrow(EvaluatorError);
  });
});

describe("evaluate - stress: large numbers from concatenation", () => {
  test("123 + 456 = 579", () => {
    expect(eq(["1", "2", "3", "+", "4", "5", "6", "=", "5", "7", "9"])).toBe(true);
  });

  test("999 + 1 = 1000 throws LexError (4-digit concatenation exceeds limit)", () => {
    expect(() => eq(["9", "9", "9", "+", "1", "=", "1", "0", "0", "0"])).toThrow(LexError);
  });

  test("100 - 1 = 99", () => {
    expect(eq(["1", "0", "0", "-", "1", "=", "9", "9"])).toBe(true);
  });

  test("50 × 2 = 100", () => {
    expect(eq(["5", "0", "×", "2", "=", "1", "0", "0"])).toBe(true);
  });

  test("1000 ÷ 8 = 125 throws LexError (4-digit concatenation exceeds limit)", () => {
    expect(() => eq(["1", "0", "0", "0", "÷", "8", "=", "1", "2", "5"])).toThrow(LexError);
  });

  test("9 × 9 = 81", () => {
    expect(eq(["9", "×", "9", "=", "8", "1"])).toBe(true);
  });

  test("99 × 9 = 891", () => {
    expect(eq(["9", "9", "×", "9", "=", "8", "9", "1"])).toBe(true);
  });

  test("999 × 0 = 0", () => {
    expect(eq(["9", "9", "9", "×", "0", "=", "0"])).toBe(true);
  });
});

describe("evaluate - stress: deep operator chains", () => {
  test("1 + 2 + 3 + 4 + 5 = 15", () => {
    expect(eq(["1", "+", "2", "+", "3", "+", "4", "+", "5", "=", "1", "5"])).toBe(true);
  });

  test("20 - 1 - 2 - 3 - 4 = 10", () => {
    expect(eq(["20", "-", "1", "-", "2", "-", "3", "-", "4", "=", "10"])).toBe(true);
  });

  test("2 × 3 × 4 = 24", () => {
    expect(eq(["2", "×", "3", "×", "4", "=", "2", "4"])).toBe(true);
  });

  test("1 + 2 × 3 + 4 × 5 + 6 = 33", () => {
    expect(eq(["1", "+", "2", "×", "3", "+", "4", "×", "5", "+", "6", "=", "3", "3"])).toBe(true);
  });

  test("3 × 4 + 5 × 6 + 7 × 8 = 98", () => {
    expect(eq(["3", "×", "4", "+", "5", "×", "6", "+", "7", "×", "8", "=", "9", "8"])).toBe(true);
  });

  test("100 ÷ 2 ÷ 5 = 10", () => {
    expect(eq(["1", "0", "0", "÷", "2", "÷", "5", "=", "10"])).toBe(true);
  });

  test("1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 = 10", () => {
    expect(eq(["1", "+", "1", "+", "1", "+", "1", "+", "1", "+", "1", "+", "1", "+", "1", "+", "1", "+", "1", "=", "10"])).toBe(true);
  });

  test("2 × 2 × 2 × 2 × 2 = 32", () => {
    expect(eq(["2", "×", "2", "×", "2", "×", "2", "×", "2", "=", "3", "2"])).toBe(true);
  });

  test("mixed: 20 ÷ 4 + 3 × 6 - 5 = 18", () => {
    expect(eq(["20", "÷", "4", "+", "3", "×", "6", "-", "5", "=", "18"])).toBe(true);
  });

  test("both sides complex: 3 × 5 + 2 = 10 + 7", () => {
    expect(eq(["3", "×", "5", "+", "2", "=", "10", "+", "7"])).toBe(true);
  });
});

describe("evaluate - stress: multi-digit tiles in equations", () => {
  test("13 + 7 = 20", () => {
    expect(eq(["13", "+", "7", "=", "20"])).toBe(true);
  });

  test("20 - 11 = 9", () => {
    expect(eq(["20", "-", "11", "=", "9"])).toBe(true);
  });

  test("19 + 1 = 20", () => {
    expect(eq(["19", "+", "1", "=", "20"])).toBe(true);
  });

  test("10 × 2 = 20", () => {
    expect(eq(["10", "×", "2", "=", "20"])).toBe(true);
  });

  test("17 + 3 = 20", () => {
    expect(eq(["17", "+", "3", "=", "20"])).toBe(true);
  });

  test("14 - 6 = 8", () => {
    expect(eq(["14", "-", "6", "=", "8"])).toBe(true);
  });

  test("15 ÷ 3 = 5", () => {
    expect(eq(["15", "÷", "3", "=", "5"])).toBe(true);
  });

  test("16 ÷ 4 = 4", () => {
    expect(eq(["16", "÷", "4", "=", "4"])).toBe(true);
  });

  test("18 ÷ 6 = 3", () => {
    expect(eq(["18", "÷", "6", "=", "3"])).toBe(true);
  });

  test("12 + 3 + 5 = 20", () => {
    expect(eq(["12", "+", "3", "+", "5", "=", "20"])).toBe(true);
  });

  test("11 × 0 = 0", () => {
    expect(eq(["11", "×", "0", "=", "0"])).toBe(true);
  });

  test("20 ÷ 10 = 2", () => {
    expect(eq(["20", "÷", "10", "=", "2"])).toBe(true);
  });
});

describe("evaluate - stress: BODMAS edge cases", () => {
  test("× and ÷ same precedence left-to-right: 12 ÷ 3 × 4 = 16", () => {
    expect(eq(["12", "÷", "3", "×", "4", "=", "16"])).toBe(true);
  });

  test("× before -: 10 - 2 × 3 = 4", () => {
    expect(eq(["10", "-", "2", "×", "3", "=", "4"])).toBe(true);
  });

  test("÷ before -: 20 - 12 ÷ 4 = 17", () => {
    expect(eq(["20", "-", "12", "÷", "4", "=", "17"])).toBe(true);
  });

  test("alternating: 2 + 3 × 4 - 6 ÷ 2 = 11", () => {
    expect(eq(["2", "+", "3", "×", "4", "-", "6", "÷", "2", "=", "11"])).toBe(true);
  });

  test("all four ops: 20 ÷ 5 + 3 × 4 - 2 = 14", () => {
    expect(eq(["20", "÷", "5", "+", "3", "×", "4", "-", "2", "=", "14"])).toBe(true);
  });

  test("double multiply: 2 × 3 × 5 + 1 = 31", () => {
    expect(eq(["2", "×", "3", "×", "5", "+", "1", "=", "3", "1"])).toBe(true);
  });

  test("left-associative ÷: 100 ÷ 10 ÷ 2 = 5", () => {
    expect(eq(["1", "0", "0", "÷", "10", "÷", "2", "=", "5"])).toBe(true);
  });

  test("identity both sides single: 0 = 0", () => {
    expect(eq(["0", "=", "0"])).toBe(true);
  });

  test("complex both sides equal: 2 × 3 + 4 = 5 + 5", () => {
    expect(eq(["2", "×", "3", "+", "4", "=", "5", "+", "5"])).toBe(true);
  });

  test("complex both sides not equal: 2 × 3 + 4 = 5 + 6", () => {
    expect(eq(["2", "×", "3", "+", "4", "=", "5", "+", "6"])).toBe(false);
  });
});

describe("evaluate - stress: false equations", () => {
  test("1 + 1 = 3", () => {
    expect(eq(["1", "+", "1", "=", "3"])).toBe(false);
  });

  test("5 × 5 = 24", () => {
    expect(eq(["5", "×", "5", "=", "2", "4"])).toBe(false);
  });

  test("20 ÷ 3 = 6 throws (non-integer division)", () => {
    expect(() => eq(["20", "÷", "3", "=", "6"])).toThrow(EvaluatorError);
  });

  test("99 + 1 = 100 is false (99 from concatenation)", () => {
    expect(eq(["9", "9", "+", "1", "=", "10"])).toBe(false);
  });

  test("0 × 999 = 1", () => {
    expect(eq(["0", "×", "9", "9", "9", "=", "1"])).toBe(false);
  });

  test("2 + 2 × 2 = 8 is false (should be 6)", () => {
    expect(eq(["2", "+", "2", "×", "2", "=", "8"])).toBe(false);
  });
});

describe("evaluate - stress: more error cases", () => {
  test("chain equation 1 = 1 = 1 = 1 is true", () => {
    expect(eq(["1", "=", "1", "=", "1", "=", "1"])).toBe(true);
  });

  test("only equals throws", () => {
    expect(() => eq(["="])).toThrow(EvaluatorError);
  });

  test("equals equals throws", () => {
    expect(() => eq(["=", "="])).toThrow(EvaluatorError);
  });

  test("number operator number with no equals throws", () => {
    expect(() => eq(["1", "+", "2"])).toThrow(EvaluatorError);
  });

  test("double minus throws", () => {
    expect(() => eq(["5", "-", "-", "3", "=", "2"])).toThrow(EvaluatorError);
  });

  test("double plus throws", () => {
    expect(() => eq(["5", "+", "+", "3", "=", "8"])).toThrow(EvaluatorError);
  });

  test("double × throws", () => {
    expect(() => eq(["5", "×", "×", "3", "=", "15"])).toThrow(EvaluatorError);
  });

  test("double ÷ throws", () => {
    expect(() => eq(["10", "÷", "÷", "2", "=", "5"])).toThrow(EvaluatorError);
  });

  test("equals followed by operator throws", () => {
    expect(() => eq(["5", "=", "+", "5"])).toThrow(EvaluatorError);
  });

  test("operator followed by equals throws", () => {
    expect(() => eq(["5", "+", "=", "5"])).toThrow(EvaluatorError);
  });

  test("leading × throws", () => {
    expect(() => eq(["×", "5", "=", "5"])).toThrow(EvaluatorError);
  });

  test("leading ÷ throws", () => {
    expect(() => eq(["÷", "5", "=", "5"])).toThrow(EvaluatorError);
  });

  test("7 ÷ 2 throws (non-integer)", () => {
    expect(() => eq(["7", "÷", "2", "=", "3"])).toThrow(EvaluatorError);
  });

  test("1 ÷ 3 throws (non-integer)", () => {
    expect(() => eq(["1", "÷", "3", "=", "0"])).toThrow(EvaluatorError);
  });

  test("large ÷ small non-integer: 100 ÷ 3 throws", () => {
    expect(() => eq(["1", "0", "0", "÷", "3", "=", "3", "3"])).toThrow(EvaluatorError);
  });

  test("division by zero deep in chain: 5 + 3 ÷ 0 = 8 throws", () => {
    expect(() => eq(["5", "+", "3", "÷", "0", "=", "8"])).toThrow(EvaluatorError);
  });

  test("non-integer division deep in chain: 5 + 7 ÷ 2 = 8 throws", () => {
    expect(() => eq(["5", "+", "7", "÷", "2", "=", "8"])).toThrow(EvaluatorError);
  });

  test("unary minus mid-right: 5 = 3 × -2 throws", () => {
    expect(() => eq(["5", "=", "3", "×", "-", "2"])).toThrow(EvaluatorError);
  });

  test("unary minus not at very start of left: 2 × -3 = -6 throws", () => {
    expect(() => eq(["2", "×", "-", "3", "=", "-", "6"])).toThrow(EvaluatorError);
  });
});

describe("evaluate - stress: generated cases", () => {
  test("validates 200 generated additive identities", () => {
    for (let n = 1; n <= 200; n++) {
      const a = n;
      const b = n + 1;
      const c = n + 2;
      const rhs = a + b + c;
      expect(eq([`${a}`, "+", `${b}`, "+", `${c}`, "=", `${rhs}`])).toBe(true);
    }
  });

  test("validates 150 generated mixed precedence identities", () => {
    for (let n = 1; n <= 150; n++) {
      const left = n * 6;
      const right = n * 2 + 8;
      expect(eq([`${left}`, "÷", "3", "+", "4", "×", "2", "=", `${right}`])).toBe(true);
    }
  });
});
