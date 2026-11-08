import type {Page} from "playwright"
import type {Step} from "./registry.ts"

type BrowserStep=Extract<Step,{kind:"wait-text"|"click"|"keyboard-activate"|"dialog-click"|"selector-click"|"hover"|"fill"|"select"}>|Step&{kind:"offline"}

export function perform(page:Page,step:BrowserStep,stack:undefined,owner:undefined):Promise<void>
