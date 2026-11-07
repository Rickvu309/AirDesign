import type {SelectHTMLAttributes} from "react"

export function CloseIcon(){return <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="m1 1 8 8M9 1l-8 8"/></svg>}
export function ExternalLinkIcon(){return <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m1 9 8-8M3.5 1H9v5.5"/></svg>}
export function NativeSelect(props:SelectHTMLAttributes<HTMLSelectElement>){return <span className="ad-native-select"><select {...props}/><svg width="8" height="4" viewBox="0 0 8 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m1 .5 3 3 3-3"/></svg></span>}
