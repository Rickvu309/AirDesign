const testFile=/\.test\.[cm]?[jt]sx?$/
const workspaceBuild=/["']run["']\s*,\s*["']build["']/
export function sharedBuildOutputHits(file:string,source:string):string[]{
 if(!testFile.test(file)||!workspaceBuild.test(source)||source.includes("--outDir"))return []
 return ["shared-build-output: a test that builds an app must pass --outDir to a private folder so parallel tests never read a half-written dist"]
}
