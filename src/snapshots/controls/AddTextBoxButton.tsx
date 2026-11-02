import type { AirDesignProps } from "../types.js";

export function AddTextBoxButton({
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
    "width": "274px",
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
      "width": "274px"
    }}>
          <span style={{
        "alignItems": "center",
        "boxSizing": "border-box",
        "display": "flex",
        "justifyContent": "center",
        "maxWidth": "100%",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "paddingLeft": "8px",
        "paddingRight": "8px",
        "width": "274px"
      }}>
            <span style={{
          "display": "block",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
              <span style={{
            "alignItems": "center",
            "display": "flex",
            "justifyContent": "center"
          }}>
                <svg style={{
              "display": "block",
              "height": "24px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "24px"
            }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path style={{
                "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
              }} fillRule="evenodd" d="M6 6.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5V9a.5.5 0 0 1-1 0V7h-4.5v10h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2V7H7v2a.5.5 0 0 1-1 0z" clipRule="evenodd"></path>
                </svg>
                <span style={{
              "whiteSpace": "nowrap"
            }}>Add text box</span>
              </span>
            </span>
          </span>
        </span>
      </button>;
}
