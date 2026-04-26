import { describe, expect, test } from "bun:test";
import { TileBag, assignTile, getTileConfigs, getTotalTileCount } from "@engine/tile-bag";
import { getEffectiveFace, TILE_CONFIGS } from "@entities";
import type { Tile } from "@entities";
import seedrandom from "seedrandom";

function tileFromConfig(face: string, id: string): Tile {
  const cfg = TILE_CONFIGS.find((t) => t.face === face);
  if (!cfg) throw new Error(`Unknown tile face: ${face}`);
  return { id, type: cfg.type, face: cfg.face, value: cfg.value };
}

describe("seedrandom - determinism", () => {
  test("same seed produces same sequence", () => {
    const rng1 = seedrandom("42");
    const rng2 = seedrandom("42");
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  test("different seeds produce different sequences", () => {
    const rng1 = seedrandom("42");
    const rng2 = seedrandom("99");
    let same = 0;
    for (let i = 0; i < 100; i++) {
      if (rng1() === rng2()) same++;
    }
    expect(same).toBeLessThan(10);
  });

  test("returns values in [0, 1)", () => {
    const rng = seedrandom("12345");
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("TileBag - tile distribution", () => {
  test("total tile count matches specification", () => {
    expect(getTotalTileCount()).toBe(100);
  });

  test("creates a bag with exactly 100 tiles", () => {
    const bag = TileBag.create(1);
    expect(bag.size).toBe(100);
  });

  test("contains correct count of each tile type", () => {
    const bag = TileBag.create(1);
    const configs = getTileConfigs();
    for (const config of configs) {
      expect(bag.filterByFace(config.face).length).toBe(config.count);
    }
  });

  test("every tile has a unique id", () => {
    const bag = TileBag.create(1);
    const all = bag.peekAll();
    const ids = new Set(all.map((t) => t.id));
    expect(ids.size).toBe(all.length);
  });

  test("tile ids are valid UUIDs", () => {
    const bag = TileBag.create(1);
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    for (const tile of bag.peekAll()) {
      expect(uuidRe.test(tile.id)).toBe(true);
    }
  });

  test("number tiles have correct type and value", () => {
    const bag = TileBag.create(1);
    const zeros = bag.filterByFace("0");
    expect(zeros.length).toBe(5);
    for (const t of zeros) {
      expect(t.type).toBe("number");
      expect(t.value).toBe(1);
    }
  });

  test("operator tiles have correct type", () => {
    const bag = TileBag.create(1);
    const plus = bag.filterByFace("+");
    expect(plus.length).toBe(4);
    for (const t of plus) {
      expect(t.type).toBe("operator");
      expect(t.value).toBe(2);
    }

    const equals = bag.filterByFace("=");
    expect(equals.length).toBe(11);
    for (const t of equals) {
      expect(t.type).toBe("operator");
      expect(t.value).toBe(1);
    }
  });

  test("+/- operator tiles exist with correct count and value", () => {
    const bag = TileBag.create(1);
    const plusMinus = bag.filterByFace("+/-");
    expect(plusMinus.length).toBe(5);
    for (const t of plusMinus) {
      expect(t.type).toBe("operator");
      expect(t.value).toBe(1);
    }
  });

  test("blank tiles exist with zero value", () => {
    const bag = TileBag.create(1);
    const blanks = bag.filterByFace("BLANK");
    expect(blanks.length).toBe(4);
    for (const t of blanks) {
      expect(t.type).toBe("blank");
      expect(t.value).toBe(0);
    }
  });

  test("high-value number tiles (face 10-20) exist", () => {
    const bag = TileBag.create(1);
    const ten = bag.filterByFace("10");
    expect(ten.length).toBe(2);
    expect(ten[0]!.value).toBe(3);

    const twenty = bag.filterByFace("20");
    expect(twenty.length).toBe(1);
    expect(twenty[0]!.value).toBe(5);
  });

  test("÷ operator has count 4 and value 2", () => {
    const bag = TileBag.create(1);
    const div = bag.filterByFace("÷");
    expect(div.length).toBe(4);
    for (const t of div) {
      expect(t.value).toBe(2);
    }
  });

  test("×/÷ combined operator has count 4 and value 1", () => {
    const bag = TileBag.create(1);
    const mulDiv = bag.filterByFace("×/÷");
    expect(mulDiv.length).toBe(4);
    for (const t of mulDiv) {
      expect(t.type).toBe("operator");
      expect(t.value).toBe(1);
    }
  });

  test("two bags created concurrently have no id collisions", () => {
    const bag1 = TileBag.create(1);
    const bag2 = TileBag.create(2);
    const ids1 = new Set(bag1.peekAll().map((t) => t.id));
    const ids2 = new Set(bag2.peekAll().map((t) => t.id));
    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false);
    }
  });
});

describe("TileBag - draw (stack behavior)", () => {
  test("draws requested number of tiles", () => {
    const bag = TileBag.create(1);
    const drawn = bag.draw(8);
    expect(drawn.length).toBe(8);
    expect(bag.size).toBe(92);
  });

  test("drawn tiles are removed from bag", () => {
    const bag = TileBag.create(1);
    const drawn = bag.draw(3);
    const remaining = bag.peekAll();
    for (const tile of drawn) {
      expect(remaining.find((t) => t.id === tile.id)).toBeUndefined();
    }
  });

  test("drawing more than available returns all remaining", () => {
    const bag = TileBag.create(1);
    const drawn = bag.draw(999);
    expect(drawn.length).toBe(100);
    expect(bag.isEmpty).toBe(true);
    expect(bag.size).toBe(0);
  });

  test("drawing zero tiles returns empty array", () => {
    const bag = TileBag.create(1);
    const drawn = bag.draw(0);
    expect(drawn.length).toBe(0);
    expect(bag.size).toBe(100);
  });

  test("can fill both player racks from fresh bag", () => {
    const bag = TileBag.create(1);
    const p1 = bag.draw(8);
    const p2 = bag.draw(8);
    expect(p1.length).toBe(8);
    expect(p2.length).toBe(8);
    expect(bag.size).toBe(84);
  });

  test("draw removes from top of stack", () => {
    const bag = TileBag.fromTiles([
      tileFromConfig("1", "a"),
      tileFromConfig("2", "b"),
      tileFromConfig("3", "c"),
    ]);
    const drawn = bag.draw(2);
    expect(drawn.map((t) => t.id)).toEqual(["b", "c"]);
    expect(bag.size).toBe(1);
    expect(bag.peekAll()[0]!.id).toBe("a");
  });
});

describe("TileBag - swap", () => {
  test("canSwap returns true when bag has more than SWAP_BAG_MINIMUM tiles", () => {
    const bag = TileBag.create(1);
    expect(bag.canSwap()).toBe(true);
  });

  test("canSwap returns false when bag has SWAP_BAG_MINIMUM or fewer tiles", () => {
    const makeBag = (n: number) =>
      TileBag.fromTiles(
        Array.from({ length: n }, (_, i) => ({
          ...tileFromConfig("1", `t_${i}`),
        })),
      );

    expect(makeBag(5).canSwap()).toBe(false);
    expect(makeBag(4).canSwap()).toBe(false);
  });

  test("canSwap returns true when bag has exactly SWAP_BAG_MINIMUM + 1 tiles", () => {
    const bag = TileBag.fromTiles(
      Array.from({ length: 6 }, (_, i) => ({
        ...tileFromConfig("1", `t_${i}`),
      })),
    );
    expect(bag.canSwap()).toBe(true);
  });

  test("swap returns same number of new tiles", () => {
    const bag = TileBag.create(1);
    const returned = bag.draw(3);
    const rng = seedrandom("10");
    const drawn = bag.swap(returned, rng);
    expect(drawn.length).toBe(3);
    expect(bag.size).toBe(97);
  });

  test("swap does not return the same tiles that were swapped", () => {
    const bag = TileBag.create(1);
    const returned = bag.draw(3);
    const returnedIds = new Set(returned.map((t) => t.id));
    const rng = seedrandom("10");
    const drawn = bag.swap(returned, rng);
    for (const tile of drawn) {
      expect(returnedIds.has(tile.id)).toBe(false);
    }
  });

  test("push adds tiles back to bag", () => {
    const bag = TileBag.create(1);
    const drawn = bag.draw(3);
    expect(bag.size).toBe(97);
    bag.push(...drawn);
    expect(bag.size).toBe(100);
  });
});

describe("TileBag - determinism", () => {
  test("same seed produces identical face ordering", () => {
    const bag1 = TileBag.create(42);
    const bag2 = TileBag.create(42);
    const a1 = bag1.peekAll();
    const a2 = bag2.peekAll();
    expect(a1.map((t) => t.face)).toEqual(a2.map((t) => t.face));
  });

  test("different seeds produce different orderings", () => {
    const bag1 = TileBag.create(1);
    const bag2 = TileBag.create(2);
    let samePosition = 0;
    const a1 = bag1.peekAll();
    const a2 = bag2.peekAll();
    for (let i = 0; i < a1.length; i++) {
      if (a1[i]!.face === a2[i]!.face) samePosition++;
    }
    expect(samePosition).toBeLessThan(100);
  });
});

describe("TileBag - encapsulation", () => {
  test("peekAll returns copies — mutating result does not affect bag", () => {
    const bag = TileBag.create(1);
    const peeked = bag.peekAll();
    const originalFace = peeked[0]!.face;
    peeked[0]!.face = "HACKED";
    expect(bag.peekAll()[0]!.face).toBe(originalFace);
  });

  test("filterByFace returns copies — mutating result does not affect bag", () => {
    const bag = TileBag.create(1);
    const plus = bag.filterByFace("+");
    if (plus.length > 0) {
      plus[0]!.face = "HACKED";
      expect(bag.filterByFace("HACKED").length).toBe(0);
    }
  });

  test("drawn tiles are independent copies from peekAll", () => {
    const bag = TileBag.fromTiles([
      tileFromConfig("1", "a"),
    ]);
    const peeked = bag.peekAll();
    const drawn = bag.draw(1);
    expect(drawn[0]!.id).toBe(peeked[0]!.id);
    expect(drawn[0]).not.toBe(peeked[0]);
  });
});

describe("assignTile", () => {
  function makeTile(face: string): Tile {
    return tileFromConfig(face, "test");
  }

  test("+/- assigned to '+'", () => {
    const tile = makeTile("+/-");
    const assigned = assignTile(tile, "+");
    expect(assigned.assignedFace).toBe("+");
    expect(getEffectiveFace(assigned)).toBe("+");
  });

  test("+/- assigned to '-'", () => {
    const tile = makeTile("+/-");
    const assigned = assignTile(tile, "-");
    expect(assigned.assignedFace).toBe("-");
    expect(getEffectiveFace(assigned)).toBe("-");
  });

  test("+/- rejects invalid assignment", () => {
    const tile = makeTile("+/-");
    expect(() => assignTile(tile, "×")).toThrow();
    expect(() => assignTile(tile, "5")).toThrow();
  });

  test("×/÷ assigned to '×'", () => {
    const tile = makeTile("×/÷");
    const assigned = assignTile(tile, "×");
    expect(assigned.assignedFace).toBe("×");
    expect(getEffectiveFace(assigned)).toBe("×");
  });

  test("×/÷ assigned to '÷'", () => {
    const tile = makeTile("×/÷");
    const assigned = assignTile(tile, "÷");
    expect(assigned.assignedFace).toBe("÷");
    expect(getEffectiveFace(assigned)).toBe("÷");
  });

  test("×/÷ rejects invalid assignment", () => {
    const tile = makeTile("×/÷");
    expect(() => assignTile(tile, "+")).toThrow();
  });

  test("BLANK assigned to a number", () => {
    const tile = makeTile("BLANK");
    const assigned = assignTile(tile, "7");
    expect(assigned.assignedFace).toBe("7");
    expect(getEffectiveFace(assigned)).toBe("7");
  });

  test("BLANK assigned to a multi-digit number", () => {
    const tile = makeTile("BLANK");
    const assigned = assignTile(tile, "20");
    expect(assigned.assignedFace).toBe("20");
    expect(getEffectiveFace(assigned)).toBe("20");
  });

  test("BLANK assigned to an operator", () => {
    const tile = makeTile("BLANK");
    const assigned = assignTile(tile, "+");
    expect(assigned.assignedFace).toBe("+");
    expect(getEffectiveFace(assigned)).toBe("+");
  });

  test("BLANK assigned to equals", () => {
    const tile = makeTile("BLANK");
    const assigned = assignTile(tile, "=");
    expect(assigned.assignedFace).toBe("=");
    expect(getEffectiveFace(assigned)).toBe("=");
  });

  test("BLANK rejects invalid assignment", () => {
    const tile = makeTile("BLANK");
    expect(() => assignTile(tile, "+/-" as any)).toThrow();
    expect(() => assignTile(tile, "21" as any)).toThrow();
    expect(() => assignTile(tile, "BLANK" as any)).toThrow();
  });

  test("regular number tile cannot be assigned", () => {
    const tile = makeTile("5");
    expect(() => assignTile(tile, "6" as any)).toThrow();
  });

  test("regular operator tile cannot be assigned", () => {
    const tile = makeTile("+");
    expect(() => assignTile(tile, "-" as any)).toThrow();
  });

  test("assignment does not mutate original tile", () => {
    const tile = makeTile("+/-");
    const assigned = assignTile(tile, "+");
    expect(tile.assignedFace).toBeUndefined();
    expect(assigned.assignedFace).toBe("+");
    expect(assigned).not.toBe(tile);
  });
});
