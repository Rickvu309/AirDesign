export function checkWorkerIdentity(report:Record<string,unknown>,sha:string):{workerSha:string} {
  if(report.workerSha!==sha)throw new Error("worker commit does not match --expect-sha")
  return {workerSha:sha}
}
