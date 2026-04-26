export interface CreateOptions {
  matchId: string;
  seed: string;
}

export interface JoinOptions {
  matchId?: string;
  role?: "host" | "player";
  name?: string;
}

export interface SeatRecord {
  sessionId: string;
  role: "host" | "player";
  seatIndex: number;
  name: string;
  connected: boolean;
}
