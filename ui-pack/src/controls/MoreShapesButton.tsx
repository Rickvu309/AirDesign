import type { AirDesignProps } from "../types.ts";

export function MoreShapesButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
    "display": "flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "height": "24px",
    "justifyItems": "center",
    "letterSpacing": "0.05504px",
    "lineHeight": "16px",
    "maxWidth": "100%",
    "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
    "outlineOffset": "-1px",
    "outlineStyle": "solid",
    "outlineWidth": "1px",
    "textAlign": "center",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className} {...rest}>
            <span style={{
      "display": "flex",
      "height": "24px",
      "maxWidth": "100%",
      "width": "84.0469px"
    }}>
              <span style={{
        "alignItems": "center",
        "display": "flex",
        "justifyContent": "center",
        "marginLeft": "8px",
        "marginRight": "8px",
        "maxWidth": "100%",
        "overflowX": "hidden",
        "overflowY": "hidden"
      }}>
                <span style={{
          "display": "block",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
  <span style={{
            "display": "contents"
          }}>
    <span style={{
              "whiteSpace": "nowrap"
            }}>More shapes</span>
  </span>
</span>
              </span>
            </span>
          </button>;
}
