import type { AirDesignProps } from "../types.ts";

export function ChangePlanButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "appearance": "auto",
    "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
    "display": "block",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "lineHeight": "16px",
    "textAlign": "center",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Change plan. Your Name is currently on the Professional plan" aria-expanded="false" className={className} {...rest}>
                  <span style={{
      "backgroundColor": "var(--ad-selection-subtle, rgb(242, 249, 255))",
      "boxSizing": "border-box",
      "color": "var(--ad-selection-strong, rgb(0, 123, 229))",
      "display": "flex",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontWeight": "500",
      "letterSpacing": "0.005px",
      "paddingLeft": "6px",
      "paddingRight": "6px",
      "whiteSpace": "nowrap",
      "borderRadius": "4px"
    }}>
  <span style={{
        "whiteSpace": "nowrap"
      }}>Professional</span>
</span>
                </button>;
}
