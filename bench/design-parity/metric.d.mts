export const metricVersion: "foreground-edges-v1"
export function compareDesign(design:Uint8Array,capture:Uint8Array):Promise<{score:number;ratio:number;foregroundLoss:number;edgeLoss:number;sizeLoss:number;backgroundLoss:number}>
