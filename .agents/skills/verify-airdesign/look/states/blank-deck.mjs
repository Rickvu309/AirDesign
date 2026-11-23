import { editor } from "../editor-screen.mjs"
import { openDoomDeck } from "../doom-deck.mjs"

export default { name: "blank-deck", design: editor, drive: (kit) => openDoomDeck(kit) }
