import type { AirDesignProps } from "../types.ts";

export function AnimateTabButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
    "boxSizing": "border-box",
    "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
    "display": "grid",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "gridTemplateColumns": "44.3125px",
    "gridTemplateRows": "24px",
    "height": "24px",
    "justifyContent": "center",
    "letterSpacing": "0.05504px",
    "lineHeight": "16px",
    "textAlign": "center",
    "whiteSpace": "nowrap",
    "borderRadius": "5px",
    "padding": "0px 8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" role="tab" aria-selected="false" className={className} {...rest}>
                  <span style={{
      "display": "block",
      "fontWeight": "550",
      "gridColumnStart": "1",
      "gridRowStart": "1",
      "opacity": "0"
    }} aria-hidden="true">
                    <span style={{
        "whiteSpace": "nowrap"
      }}>Animate</span>
                  </span>
                  <span style={{
      "display": "block",
      "gridColumnStart": "1",
      "gridRowStart": "1"
    }}>
                    <span style={{
        "whiteSpace": "nowrap"
      }}>Animate</span>
                  </span>
                </button>;
}
