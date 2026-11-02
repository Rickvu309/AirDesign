import type { AirDesignComponentProps } from "../types.ts";

export function CopyLinkButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(226, 76, 12)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "500",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="Copy link" type="button" className={className}>
                    <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px",
      "fill": "rgb(226, 76, 12)"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <path fill="var(--fpl-icon-color, var(--color-icon))" d="M12.444 10.37a2.998 2.998 0 0 1 .677 4.75l-2 2a3 3 0 1 1-4.243-4.242l1.27-1.27c.262-.263.746-.069.826.293a.44.44 0 0 1-.111.405l-1.278 1.279a2 2 0 1 0 2.829 2.828l2-2a2 2 0 0 0 0-2.828l-.029-.028c-.093-.089-.187-.184-.224-.307a.88.88 0 0 1 .22-.87.05.05 0 0 1 .063-.01m.434-3.492a3 3 0 1 1 4.243 4.242l-1.27 1.27c-.262.262-.745.068-.826-.294a.44.44 0 0 1 .111-.405l1.278-1.278a2 2 0 1 0-2.829-2.828l-2 2a2 2 0 0 0 0 2.828l.029.026c.093.089.186.183.223.306a.88.88 0 0 1-.218.874.05.05 0 0 1-.062.009 3 3 0 0 1-.679-4.75z"></path>
                    </svg>
                    <span style={{
      "display": "block"
    }}>
                      <span style={{
        "display": "contents"
      }}>
  Copy link
</span>
                    </span>
                    <svg style={{
      "display": "block",
      "height": "16px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "16px",
      "fill": "rgb(226, 76, 12)"
    }} width="16" height="16" fill="none" viewBox="0 0 16 16">
                      <path fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
                    </svg>
                  </button>;
}
