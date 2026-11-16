import { presentState } from "../present-deck.mjs"

export default {
  name: "presenter-view",
  design: "/screens/s52-01-present-presenter-view",
  drive: (kit) => presentState(kit, "presenter"),
}
