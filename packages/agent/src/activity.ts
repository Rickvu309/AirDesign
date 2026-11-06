export type ActivityContent={kind:"tool";name:string;scope?:string}|{kind:"message";text:string}
export type RunActivity=ActivityContent & {id:number}
export type AgentRun={id:string;owner:string;deck:string;request:string;selection:string[];kind:"working"|"complete"|"failed"|"stopped"|"undone";events:RunActivity[];completed:string[]}
