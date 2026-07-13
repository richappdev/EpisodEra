export const toErrorMessage = (reason: unknown, fallback: string) =>
  reason instanceof Error ? reason.message : fallback;
