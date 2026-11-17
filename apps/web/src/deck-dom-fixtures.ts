export type JsdomModule = {
  JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
}

export class ResizeObserverFixture {
  observe() {}
  disconnect() {}
}
