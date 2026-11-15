const descriptorsOf = () =>
  new Map(Reflect.ownKeys(globalThis).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))

const sameDescriptor = (left, right) =>
  left !== undefined &&
  right !== undefined &&
  left.value === right.value &&
  left.get === right.get &&
  left.set === right.set &&
  left.writable === right.writable &&
  left.enumerable === right.enumerable &&
  left.configurable === right.configurable

export const keepGlobals = () => {
  const kept = descriptorsOf()
  return () => {
    for (const [key, now] of descriptorsOf()) {
      const before = kept.get(key)
      if (before === undefined) {
        if (now.configurable) Reflect.deleteProperty(globalThis, key)
      } else if (!sameDescriptor(before, now)) {
        if (now.configurable) Object.defineProperty(globalThis, key, before)
        else if (now.writable) globalThis[key] = before.value
      }
    }
  }
}
