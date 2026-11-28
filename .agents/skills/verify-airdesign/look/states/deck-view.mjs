export default {
  name: "deck-view",
  design: null,
  journey: "deck-view",
  at: "deck-view",
}

export function chatDeckViewState(state) {
  return { name: `deck-view-chat-${state}`, design: null, journey: "chat-deck-view", at: `chat-view-${state}` }
}
