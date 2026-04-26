export function ensureActionAllowed(params: {
  nowMs: number;
  sessionId: string;
  lastActionAt: Map<string, number>;
  rateLimitWindowMs: number;
  sendError: (code: string, message: string) => void;
}): boolean {
  const last = params.lastActionAt.get(params.sessionId) ?? 0;
  if (params.nowMs - last < params.rateLimitWindowMs) {
    params.sendError("rate_limited", "Slow down");
    return false;
  }
  params.lastActionAt.set(params.sessionId, params.nowMs);
  return true;
}

export function ensureLobbyOpen(params: {
  started: boolean;
  phase: string;
  alreadyStartedMsg: string;
  sendError: (code: string, message: string) => void;
}): boolean {
  if (params.started || params.phase !== "waiting") {
    params.sendError("already_started", params.alreadyStartedMsg);
    return false;
  }
  return true;
}

export function ensureHost(params: {
  sessionId: string;
  hostSessionId: string;
  notHostMsg: string;
  sendError: (code: string, message: string) => void;
}): boolean {
  if (params.sessionId !== params.hostSessionId) {
    params.sendError("not_host", params.notHostMsg);
    return false;
  }
  return true;
}

export function ensureRackRecoveryAllowed(params: {
  nowMs: number;
  sessionId: string;
  lastRackRecoveryAt: Map<string, number>;
  rackRecoveryWindowMs: number;
  onThrottled: () => void;
}): boolean {
  const last = params.lastRackRecoveryAt.get(params.sessionId) ?? 0;
  if (params.nowMs - last < params.rackRecoveryWindowMs) {
    params.onThrottled();
    return false;
  }
  params.lastRackRecoveryAt.set(params.sessionId, params.nowMs);
  return true;
}
