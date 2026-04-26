export function createLogger(scope: string) {
  return function log(event: string, details?: Record<string, unknown>): void {
    console.info(scope, { event, ...details });
  };
}
