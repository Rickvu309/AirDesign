declare module "pngjs" {
  export const PNG: {
    readonly sync: {
      read(buffer: Buffer): { readonly width: number; readonly height: number; readonly data: Buffer }
    }
  }
}
