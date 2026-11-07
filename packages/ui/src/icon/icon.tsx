import {iconPaths as paths} from "./icon-paths.ts"
export function Icon({name}:{name:keyof typeof paths}){
  return <svg data-icon={name} aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>
}
