import { httpDoomRemote } from "@airdesign/live"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { ChatDeckView } from "./deck-view/chat-deck-view"
import { DeckView } from "./deck-view/deck-view"

const deck = new URLSearchParams(window.location.search).get("deck") ?? ""
const inChat = document.documentElement.hasAttribute("data-mcp-app")

createRoot(document.getElementById("root")!).render(
  <StrictMode>{inChat ? <ChatDeckView /> : <DeckView id={deck} remote={httpDoomRemote()} />}</StrictMode>,
)
