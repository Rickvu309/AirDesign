export const appUrl = (path: string): string =>
  new URL(path, document.documentElement.dataset.origin ?? location.origin).href
