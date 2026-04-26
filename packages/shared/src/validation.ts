export const DISPLAY_NAME_MAX_LENGTH = 40;

export type DisplayNameValidationError = "not_string" | "empty" | "too_long";

export type DisplayNameValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: DisplayNameValidationError };

export function validateDisplayName(input: unknown): DisplayNameValidationResult {
  if (typeof input !== "string") {
    return { ok: false, error: "not_string" };
  }

  const value = input.trim();
  if (value.length === 0) {
    return { ok: false, error: "empty" };
  }
  if (value.length > DISPLAY_NAME_MAX_LENGTH) {
    return { ok: false, error: "too_long" };
  }

  return { ok: true, value };
}

export function displayNameErrorMessage(error: DisplayNameValidationError): string {
  switch (error) {
    case "not_string":
    case "empty":
      return "Enter a name";
    case "too_long":
      return "Too long";
  }
}
