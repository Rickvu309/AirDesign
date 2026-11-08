export const fixedMargin:0.01
export const maximumSourceFloor:0.9
export type SourceFloor={code:string;status:"uncalibrated";floor:null;target:null;reason:string}|{code:string;status:"calibrated";floor:number;target:number;repeatIdentical:boolean;captureSha256:string;repeatSha256:string}
export function sourceTarget(score:number):number
export function validateSourceFloor(row:SourceFloor):void
export function sourceVerdict(row:SourceFloor,score:number|undefined):"uncalibrated"|"pass"|"fail"
