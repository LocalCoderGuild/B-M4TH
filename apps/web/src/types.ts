import type {
  TileDto,
  PlayerDto,
  LastMoveDto,
  MatchStateDto,
  BoardCellDto,
} from "@b-m4th/shared";

export type { TileDto, PlayerDto, LastMoveDto, MatchStateDto, BoardCellDto };

export type Role = "host" | "player";
/** @deprecated kept for lingering references — use Role. */
export type Slot = Role;
export type Phase = "waiting" | "playing" | "finished";

export interface RackMessage {
  tiles: TileDto[];
}

export interface ErrorMessage {
  code: string;
  message: string;
}

export interface CreateMatchResponse {
  matchId: string;
  maxPlayers: number;
  minPlayers: number;
  inviteToken: string;
  inviteLink: string;
  hostReservation: unknown;
}

export interface InvitePeekResponse {
  matchId: string;
  expiresAt: number;
  hostName: string;
  maxPlayers: number;
  minPlayers: number;
}

export interface ClaimResponse {
  matchId: string;
  reservation: unknown;
}

export type PremiumType = "normal" | "2x_piece" | "3x_piece" | "2x_eq" | "3x_eq";

export interface PlacedTile {
  row: number;
  col: number;
  tileId: string;
  face: string;
  assignedFace: string | null;
  value: number;
}

export interface PendingPlacement {
  tileId: string;
  row: number;
  col: number;
  face: string;
  assignedFace?: string;
  value: number;
}
