import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { DeckView } from "./deck-view/deck-view"

const deck = new URLSearchParams(window.location.search).get("deck") ?? ""

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DeckView id={deck} />
  </StrictMode>,
)
