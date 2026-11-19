export type Frames = {
  readonly request: (run: () => void) => number
  readonly cancel: (handle: number) => void
}

export const animationFrames: Frames = {
  request: (run) => requestAnimationFrame(run),
  cancel: (handle) => {
    cancelAnimationFrame(handle)
  },
}

export type PerFrame<Value> = {
  readonly push: (value: Value) => void
  readonly flush: () => void
  readonly drop: () => void
}

export function oncePerFrame<Value>(apply: (value: Value) => void, frames: Frames = animationFrames): PerFrame<Value> {
  let waiting: { readonly value: Value } | null = null
  let handle: number | null = null
  function drop() {
    if (handle !== null) frames.cancel(handle)
    handle = null
    waiting = null
  }
  function flush() {
    const due = waiting
    drop()
    if (due !== null) apply(due.value)
  }
  function landed() {
    handle = null
    flush()
  }
  return {
    push(value) {
      waiting = { value }
      if (handle === null) handle = frames.request(landed)
    },
    flush,
    drop,
  }
}
