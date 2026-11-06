import type {ReactNode} from "react"
export function Conversation({children}:{children:ReactNode}){return <div className="aira-conversation" role="log" aria-label="Conversation with Aira" aria-live="polite" aria-relevant="additions">{children}</div>}
export function Message({children,from}:{children:ReactNode;from:"user"|"assistant"}){return <div className={`aira-message aira-message-${from}`}>{children}</div>}
