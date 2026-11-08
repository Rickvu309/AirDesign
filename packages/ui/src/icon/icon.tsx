import {iconPaths as paths,iconStrokeWidth,type IconName} from "./icon-paths.ts"
export type {IconName} from "./icon-paths.ts"
export function Icon({name}:{name:IconName}){
  return <svg data-icon={name} aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={iconStrokeWidth(name)} strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>
}
