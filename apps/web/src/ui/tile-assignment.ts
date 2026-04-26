export interface AssignableTileLike {
  face: string;
  assignedFace?: string | null;
}

export interface AssignmentGroup {
  label: string;
  options: string[];
}

import { ALL_OPERATOR_FACES } from "@b-m4th/shared";

const DIGIT_FACES = Array.from({ length: 21 }, (_, i) => String(i));

export function getAssignmentGroups(face: string): AssignmentGroup[] | null {
  if (face === "BLANK") {
    return [
      { label: "Numbers", options: DIGIT_FACES },
      { label: "Operators", options: [...ALL_OPERATOR_FACES] },
    ];
  }
  if (face === "+/-") {
    return [{ label: "Operators", options: ["+", "-"] }];
  }
  if (face === "×/÷") {
    return [{ label: "Operators", options: ["×", "÷"] }];
  }
  return null;
}

export function needsAssignment(tile: AssignableTileLike): boolean {
  const groups = getAssignmentGroups(tile.face);
  if (!groups) return false;
  const validOptions = new Set(groups.flatMap((group) => group.options));
  return !tile.assignedFace || !validOptions.has(tile.assignedFace);
}

export function getAssignmentTitle(face: string): string {
  if (face === "BLANK") return "Assign blank tile";
  if (face === "+/-" || face === "×/÷") return `Choose ${face} tile`;
  return "Assign tile";
}

export function getAssignmentDescription(face: string): string {
  if (face === "BLANK") return "Choose a number or operator for this blank.";
  if (face === "+/-" || face === "×/÷") return "Choose which operator this tile should represent.";
  return "Choose how this tile should be played.";
}
