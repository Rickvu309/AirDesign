import type {AgentRun} from "../../../../packages/agent/src/activity.ts"
export type AiraSnapshot={enabled:boolean;run:AgentRun|null;remote:{id:string;run:string|null;active:boolean;targets:string[]}[]}
export async function airaRequest(deck:string,action?:"send"|"stop"|"resume"|"undo",input:Record<string,unknown>={}){
  const response=await fetch(`/api/aira${action ? `/${action}` : ""}?deck=${encodeURIComponent(deck)}`,action ? {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...input,action})} : {})
  if(!response.ok){const failure=await response.json();throw new Error(failure.code ?? "Unable to reach Aira. Your changes are saved.")}
  return response.json()
}
