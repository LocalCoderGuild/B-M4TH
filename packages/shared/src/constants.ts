export const ALL_OPERATOR_FACES = ["+", "-", "×", "÷", "="] as const;

export type OperatorFace = (typeof ALL_OPERATOR_FACES)[number];
