import {iconPaths as paths} from "./icon-paths.ts"
export type IconName = keyof typeof paths
export function Icon({name}:{name:IconName}){
  return <svg data-icon={name} aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === "undo" || name === "redo" ? "1.5" : "1.6"} strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>
}
