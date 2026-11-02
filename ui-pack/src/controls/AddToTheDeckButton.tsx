import type { AirDesignProps } from "../types.ts";

export function AddToTheDeckButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "lineHeight": "16px",
    "textAlign": "left",
    "width": "272px",
    "borderRadius": "13px",
    "padding": "8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" aria-expanded="false" className={className} {...rest}>
                            <span style={{
      "alignItems": "center",
      "display": "flex",
      "flexShrink": "0",
      "height": "24px",
      "justifyContent": "center",
      "width": "24px"
    }} aria-hidden="true">
                              <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
          "fill": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))"
        }} fillRule="evenodd" d="M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0m1 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-6.5-2.5a.5.5 0 0 0-1 0v2h-2a.5.5 0 0 0 0 1h2v2a.5.5 0 0 0 1 0v-2h2a.5.5 0 0 0 0-1h-2z" clipRule="evenodd"></path>
</svg>
                            </span>
                            <span style={{
      "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
      "display": "block",
      "flexGrow": "1",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "13px",
      "fontWeight": "450",
      "letterSpacing": "-0.032px",
      "lineHeight": "22px",
      "marginLeft": "8px"
    }}>
  Add to the deck
</span>
                            <span style={{
      "alignItems": "center",
      "display": "flex",
      "flexShrink": "0",
      "height": "24px",
      "justifyContent": "center",
      "marginLeft": "4px",
      "width": "24px"
    }} aria-hidden="true">
  <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
          "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
        }} d="M15.647 10.147a.5.5 0 1 1 .707.707l-4 4a.5.5 0 0 1-.707 0l-4-4a.5.5 0 1 1 .707-.707L12 13.793z"></path>
  </svg>
</span>
                          </button>;
}
