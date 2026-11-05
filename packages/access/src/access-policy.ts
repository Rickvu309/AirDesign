export const accessPolicy = {
  linkTtlMs: 900_000,
  resendWaitMs: 30_000,
  codeLength: 6,
  attemptLimit: 5,
  sessionTtlSeconds: 2_592_000,
  sessionUpdateAgeSeconds: 60,
  intentTtlMs: 86_400_000,
  sendCapPerHour: 5,
  sendWindowMs: 3_600_000,
} as const
