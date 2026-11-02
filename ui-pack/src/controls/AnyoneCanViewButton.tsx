import type { AirDesignComponentProps } from "../types.ts";

export function AnyoneCanViewButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "justifyItems": "center",
    "lineHeight": "16px",
    "marginLeft": "-12px",
    "marginRight": "-16px",
    "minHeight": "36px",
    "outlineColor": "rgba(0, 0, 0, 0)",
    "outlineStyle": "solid",
    "outlineWidth": "1px",
    "textAlign": "start",
    "width": "496px",
    "borderRadius": "5px",
    "padding": "0px 16px 0px 12px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <span style={{
      "alignItems": "center",
      "display": "flex",
      "flexShrink": "0",
      "height": "32px",
      "justifyContent": "center",
      "marginRight": "4px",
      "width": "32px"
    }}>
    <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
          "fill": "rgba(0, 0, 0, 0.898)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12.465 17.738c-.233.23-.389.262-.465.262s-.232-.032-.465-.262c-.238-.234-.498-.623-.737-1.182-.434-1.013-.738-2.433-.79-4.056h3.984c-.052 1.623-.356 3.044-.79 4.056-.24.56-.5.948-.737 1.182m1.527-6.238h-3.984c.052-1.623.356-3.044.79-4.056.24-.56.5-.948.737-1.182.233-.23.389-.262.465-.262s.232.032.465.262c.238.234.498.623.737 1.182.434 1.012.738 2.433.79 4.056m1 1c-.065 2.176-.558 4.078-1.282 5.253a6.005 6.005 0 0 0 4.27-5.253zm2.988-1a6.005 6.005 0 0 0-4.27-5.253c.724 1.175 1.217 3.077 1.282 5.253zm-8.972 0c.065-2.176.558-4.078 1.282-5.253A6.005 6.005 0 0 0 6.02 11.5zm-2.987 1a6.005 6.005 0 0 0 4.27 5.253c-.725-1.175-1.218-3.077-1.283-5.253zM19 12a7 7 0 1 0-14 0 7 7 0 0 0 14 0" clipRule="evenodd"></path>
    </svg>
  </span>
  <div style={{
      "alignItems": "center",
      "display": "flex",
      "flexGrow": "1",
      "height": "24px",
      "justifyContent": "space-between",
      "maxWidth": "100%",
      "overflowX": "hidden",
      "overflowY": "auto"
    }}>
    <div style={{
        "alignItems": "center",
        "color": "rgba(0, 0, 0, 0.898)",
        "columnGap": "5px",
        "display": "flex",
        "flexGrow": "1",
        "justifyContent": "space-between",
        "rowGap": "5px"
      }}>
      <div>
        <span style={{
            "display": "contents"
          }}>
          Anyone
        </span>
      </div>
      <div style={{
          "alignItems": "center",
          "boxSizing": "content-box",
          "columnGap": "0px",
          "display": "flex",
          "justifyContent": "center",
          "paddingRight": "8px",
          "rowGap": "0px",
          "whiteSpace": "nowrap"
        }}>
        <span style={{
            "display": "contents",
            "minWidth": "0px",
            "minHeight": "0px"
          }}>
          <span style={{
              "whiteSpace": "nowrap"
            }}>can view</span>
        </span>
        <svg style={{
            "display": "block",
            "height": "24px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "24px"
          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path style={{
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.647 9.147a.5.5 0 0 1 .707 0l2.5 2.5a.5.5 0 0 1 0 .707l-2.5 2.5a.5.5 0 0 1-.707-.707L12.793 12l-2.146-2.146a.5.5 0 0 1 0-.707"></path>
        </svg>
      </div>
    </div>
  </div>
</button>;
}
