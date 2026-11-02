import type { AirDesignComponentProps } from "../types.ts";

export function MakeAnImageButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgba(0, 0, 0, 0.898)",
    "display": "flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "height": "24px",
    "justifyItems": "center",
    "letterSpacing": "0.05504px",
    "lineHeight": "16px",
    "maxWidth": "100%",
    "outlineColor": "rgba(0, 0, 0, 0.1)",
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
  }} aria-label="Make an image" type="button" className={className}>
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
          "alignItems": "center",
          "display": "flex",
          "height": "24px",
          "marginLeft": "-8px",
          "marginRight": "4px"
        }} aria-hidden="true">
          <svg style={{
            "display": "block",
            "height": "24px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "24px"
          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path style={{
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M13.5 5.999a.5.5 0 0 1 0 1h-6a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 1 1 0v6a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5v-9a1.5 1.5 0 0 1 1.5-1.5zm-3.275 5.082a.5.5 0 0 1 .629.065l4 4a.5.5 0 0 1-.707.706L10.5 12.206l-1.646 1.646a.5.5 0 1 1-.708-.707l2-2zm6.79-6.642c.126-.505.844-.505.97 0L18.3 5.7l1.26.315c.505.126.505.844 0 .97L18.3 7.3l-.315 1.26c-.126.505-.844.505-.97 0L16.7 7.3l-1.26-.315c-.505-.126-.505-.844 0-.97L16.7 5.7z"></path>
          </svg>
        </span>
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
            }}>Make an image</span>
          </span>
        </span>
      </span>
    </span>
  </button>;
}
