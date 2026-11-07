import type {compareDesign} from "./metric.mjs"
type Box={left:number;top:number;width:number;height:number}|{x:number;y:number;width:number;height:number}
export function cropComponent(image:Uint8Array,box:Box):Promise<Buffer>
export function faithfulReference(image:Uint8Array):Promise<Buffer>
export function compareComponent(design:Uint8Array,capture:Uint8Array,designBox:Box,captureBox:Box):Promise<{design:Buffer;capture:Buffer;metric:Awaited<ReturnType<typeof compareDesign>>}>
