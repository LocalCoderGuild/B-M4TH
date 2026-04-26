import { useMatchStore } from "./match-store";
import type { MatchState } from "./match-store";

export function selectIsMyTurn(s: MatchState): boolean {
  return Boolean(
    s.snapshot &&
      s.mySessionId &&
      s.snapshot.currentSessionId === s.mySessionId &&
      s.snapshot.phase === "playing",
  );
}

export function useIsMyTurn(): boolean {
  return useMatchStore(selectIsMyTurn);
}
