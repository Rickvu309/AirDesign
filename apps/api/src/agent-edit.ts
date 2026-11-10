export const agentEdit = {
  first(deck: string) {
    return { deck, base: 0, changes: [{ value: "21" }] }
  },
  second(deck: string) {
    return { deck, base: 1, changes: [{ value: "22" }] }
  },
  claimed(deck: string) {
    return { deck, base: 1, changes: [{ value: "99" }], runId: "client-run", readAt: 5, actor: "person" }
  },
  other(deck: string) {
    return { deck, base: 1, changes: [{ value: "no" }] }
  },
}
