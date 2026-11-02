import type { AirDesignProps } from "../types.js";

export function LineButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Line" aria-pressed="false" type="button" className={className} {...rest}>
            <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path style={{
        "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
      }} fillRule="evenodd" d="M19.854 4.146a.5.5 0 0 1 0 .708l-15 15a.5.5 0 0 1-.708-.708l15-15a.5.5 0 0 1 .708 0" clipRule="evenodd"></path>
            </svg>
          </button>;
}
