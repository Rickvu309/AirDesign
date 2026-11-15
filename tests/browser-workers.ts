export const workerCap = 4
export const workerOverrideName = "AIRDESIGN_BROWSER_WORKERS"

const coresPerWorker = 4

export const onCi = (env: NodeJS.ProcessEnv): boolean => env.CI === "true" || env.CI === "1"

type WorkerChoice = { cores: number; ci: boolean; override: string | undefined }

const parsedOverride = (override: string | undefined): number | undefined => {
  if (override === undefined || !/^[1-9]\d*$/.test(override)) return undefined
  return Number(override)
}

export const workerLimit = ({ cores, ci, override }: WorkerChoice): number => {
  if (ci) return cores
  return parsedOverride(override) ?? Math.max(1, Math.min(workerCap, Math.floor(cores / coresPerWorker)))
}

export const workerRefusal = ({ workers, ...choice }: WorkerChoice & { workers: number }): string | undefined => {
  const limit = workerLimit(choice)
  if (choice.ci || workers <= limit) return undefined
  return `this machine is shared: use at most ${limit} workers, got ${workers}; set ${workerOverrideName} to override`
}
