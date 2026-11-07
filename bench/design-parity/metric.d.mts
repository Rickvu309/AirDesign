export const metricVersion: "local-oklab-v2"
export function compareDesign(design:Uint8Array,capture:Uint8Array):Promise<{score:number;globalScore:number;colorLoss:number;localLoss:number;worstRegion:{column:number;row:number;score:number};ratio:number;foregroundLoss:number;edgeLoss:number;sizeLoss:number;backgroundLoss:number}>
