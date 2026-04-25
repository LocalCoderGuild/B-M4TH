import { describe, expect, test } from "bun:test";
import {
  getAssignmentDescription,
  getAssignmentGroups,
  getAssignmentTitle,
  needsAssignment,
} from "../../apps/web/src/ui/tile-assignment";

describe("tile assignment helpers", () => {
  test("blank tiles expose number and operator choices", () => {
    expect(getAssignmentGroups("BLANK")).toEqual([
      {
        label: "Numbers",
        options: Array.from({ length: 21 }, (_, i) => String(i)),
      },
      {
        label: "Operators",
        options: ["+", "-", "×", "÷", "="],
      },
    ]);
  });

  test("combo operator tiles expose only their valid operator choices", () => {
    expect(getAssignmentGroups("+/-")).toEqual([{ label: "Operators", options: ["+", "-"] }]);
    expect(getAssignmentGroups("×/÷")).toEqual([{ label: "Operators", options: ["×", "÷"] }]);
  });

  test("assignment is required for unresolved blank and combo operator tiles", () => {
    expect(needsAssignment({ face: "BLANK" })).toBe(true);
    expect(needsAssignment({ face: "+/-" })).toBe(true);
    expect(needsAssignment({ face: "×/÷" })).toBe(true);
  });

  test("assignment is not required once a valid face is chosen", () => {
    expect(needsAssignment({ face: "BLANK", assignedFace: "12" })).toBe(false);
    expect(needsAssignment({ face: "+/-", assignedFace: "+" })).toBe(false);
    expect(needsAssignment({ face: "×/÷", assignedFace: "÷" })).toBe(false);
    expect(needsAssignment({ face: "7" })).toBe(false);
  });

  test("invalid assigned faces still require correction", () => {
    expect(needsAssignment({ face: "+/-", assignedFace: "×" })).toBe(true);
    expect(needsAssignment({ face: "×/÷", assignedFace: "+" })).toBe(true);
  });

  test("dialog copy matches tile type", () => {
    expect(getAssignmentTitle("BLANK")).toBe("Assign blank tile");
    expect(getAssignmentTitle("×/÷")).toBe("Choose ×/÷ tile");
    expect(getAssignmentDescription("+/-")).toBe("Choose which operator this tile should represent.");
  });
});
