export type Announcement = { readonly text: string; readonly odd: boolean }

export function Announcer({ message }: { message: Announcement | null }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-announcer>
      {message === null ? "" : `${message.text}${message.odd ? "\u00A0" : ""}`}
    </div>
  )
}
