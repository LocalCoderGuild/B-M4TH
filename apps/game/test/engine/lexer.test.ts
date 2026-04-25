import { describe, expect, test } from "bun:test";
import { lex, LexError } from "@engine/lexer";

describe("lex - single-digit tiles", () => {
  test("single digit tile", () => {
    expect(lex(["5"])).toEqual([{ type: "number", value: 5 }]);
  });

  test("zero tile", () => {
    expect(lex(["0"])).toEqual([{ type: "number", value: 0 }]);
  });

  test("two adjacent single-digit tiles concatenate", () => {
    expect(lex(["1", "0"])).toEqual([{ type: "number", value: 10 }]);
  });

  test("three adjacent single-digit tiles concatenate", () => {
    expect(lex(["1", "2", "3"])).toEqual([{ type: "number", value: 123 }]);
  });

  test("blank concat 3 tiles: 9 8 6 → 986", () => {
    expect(lex(["9", "8", "6"])).toEqual([{ type: "number", value: 986 }]);
  });

  test("single-digit tiles separated by operator do not concatenate", () => {
    expect(lex(["1", "+", "0"])).toEqual([
      { type: "number", value: 1 },
      { type: "op", op: "+" },
      { type: "number", value: 0 },
    ]);
  });
});

describe("lex - multi-digit tiles stand alone", () => {
  test("multi-digit tile '10'", () => {
    expect(lex(["10"])).toEqual([{ type: "number", value: 10 }]);
  });

  test("multi-digit tile '13'", () => {
    expect(lex(["13"])).toEqual([{ type: "number", value: 13 }]);
  });

  test("multi-digit tile '20'", () => {
    expect(lex(["20"])).toEqual([{ type: "number", value: 20 }]);
  });

  test("multi-digit tile between operators", () => {
    expect(lex(["13", "+", "7", "=", "20"])).toEqual([
      { type: "number", value: 13 },
      { type: "op", op: "+" },
      { type: "number", value: 7 },
      { type: "equals" },
      { type: "number", value: 20 },
    ]);
  });
});

describe("lex - operators", () => {
  test("plus", () => expect(lex(["+"])).toEqual([{ type: "op", op: "+" }]));
  test("minus", () => expect(lex(["-"])).toEqual([{ type: "op", op: "-" }]));
  test("times", () => expect(lex(["×"])).toEqual([{ type: "op", op: "×" }]));
  test("divide", () => expect(lex(["÷"])).toEqual([{ type: "op", op: "÷" }]));
  test("equals", () => expect(lex(["="])).toEqual([{ type: "equals" }]));
});

describe("lex - full equations", () => {
  test("simple addition equation", () => {
    expect(lex(["2", "+", "3", "=", "5"])).toEqual([
      { type: "number", value: 2 },
      { type: "op", op: "+" },
      { type: "number", value: 3 },
      { type: "equals" },
      { type: "number", value: 5 },
    ]);
  });

  test("single-digit concatenation: 20 ÷ 4 = 5", () => {
    expect(lex(["2", "0", "÷", "4", "=", "5"])).toEqual([
      { type: "number", value: 20 },
      { type: "op", op: "÷" },
      { type: "number", value: 4 },
      { type: "equals" },
      { type: "number", value: 5 },
    ]);
  });

  test("same concatenated number on both sides", () => {
    expect(lex(["1", "3", "=", "1", "3"])).toEqual([
      { type: "number", value: 13 },
      { type: "equals" },
      { type: "number", value: 13 },
    ]);
  });

  test("empty array produces empty token list", () => {
    expect(lex([])).toEqual([]);
  });
});

describe("lex - 3-digit concatenation limit", () => {
  test("3 adjacent digits is valid: 1 4 5 → 145", () => {
    expect(lex(["1", "4", "5"])).toEqual([{ type: "number", value: 145 }]);
  });

  test("4 adjacent digits throws LexError: 6 7 7 7", () => {
    expect(() => lex(["6", "7", "7", "7"])).toThrow(LexError);
  });

  test("4-digit number on right side of equation throws LexError", () => {
    expect(() => lex(["1", "=", "1", "0", "0", "0"])).toThrow(LexError);
  });
});

describe("lex - leading zero in concatenated numbers", () => {
  test("0 alone is valid", () => {
    expect(lex(["0"])).toEqual([{ type: "number", value: 0 }]);
  });

  test("0 followed by 9 throws LexError (leading zero)", () => {
    expect(() => lex(["0", "9"])).toThrow(LexError);
  });

  test("0 followed by 0 throws LexError (leading zero)", () => {
    expect(() => lex(["0", "0"])).toThrow(LexError);
  });

  test("0 followed by digits in expression throws LexError", () => {
    expect(() => lex(["0", "5", "+", "1", "=", "1"])).toThrow(LexError);
  });

  test("non-zero leading digit is fine: 1 0 → 10", () => {
    expect(lex(["1", "0"])).toEqual([{ type: "number", value: 10 }]);
  });
});

describe("lex - invalid mixing of single and multi-digit tiles", () => {
  test("single-digit before multi-digit throws LexError", () => {
    expect(() => lex(["1", "13"])).toThrow(LexError);
  });

  test("multi-digit after single-digit throws LexError", () => {
    expect(() => lex(["1", "2", "10"])).toThrow(LexError);
  });

  test("single-digit after multi-digit throws LexError", () => {
    expect(() => lex(["13", "5"])).toThrow(LexError);
  });

  test("two adjacent multi-digit tiles throw LexError", () => {
    expect(() => lex(["10", "13"])).toThrow(LexError);
  });
});

describe("lex - unresolved tile errors", () => {
  test("unresolved BLANK throws LexError", () => {
    expect(() => lex(["BLANK"])).toThrow(LexError);
  });

  test("unresolved +/- combo throws LexError", () => {
    expect(() => lex(["+/-"])).toThrow(LexError);
  });

  test("unresolved ×/÷ combo throws LexError", () => {
    expect(() => lex(["×/÷"])).toThrow(LexError);
  });

  test("unknown face throws LexError", () => {
    expect(() => lex(["?"])).toThrow(LexError);
  });
});
