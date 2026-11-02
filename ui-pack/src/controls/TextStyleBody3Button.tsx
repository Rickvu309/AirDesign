import type { AirDesignProps } from "../types.ts";

export function TextStyleBody3Button({
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
    "height": "37px",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "272px",
    "borderRadius": "5px",
    "padding": "12px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="" type="button" className={className} {...rest}>
    <span style={{
      display: "flex",
      alignItems: "center",
      width: "100%",
      height: "100%",
      fontFamily: "Inter, sans-serif",
      fontSize: 11,
      fontWeight: 400,
      color: "var(--ad-ink, #222222)"
    }}>Body 3</span>
  </button>;
}
