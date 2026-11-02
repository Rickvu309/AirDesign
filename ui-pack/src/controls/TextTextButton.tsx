import type { AirDesignProps } from "../types.ts";

export function TextTextButton({
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
    "height": "40px",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "274px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-expanded="true" type="button" className={className} {...rest}>
                  <span style={{
      "alignItems": "center",
      "display": "flex",
      "flexShrink": "0",
      "justifyItems": "center"
    }}>
  <svg style={{
        "display": "block",
        "height": "16px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "16px"
      }} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
    <path style={{
          "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
        }} d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
  </svg>
</span>
                  <span style={{
      "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
      "display": "block",
      "flexBasis": "0%",
      "flexGrow": "1",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontWeight": "550",
      "letterSpacing": "0.05504px",
      "minWidth": "0px"
    }}>
  Text
</span>
                </button>;
}
