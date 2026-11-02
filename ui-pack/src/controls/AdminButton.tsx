import type { AirDesignProps } from "../types.ts";

export function AdminButton({
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
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className} {...rest}>
              <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "height": "28px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "4px",
      "paddingRight": "4px",
      "width": "224px",
      "borderRadius": "5px",
      "margin": "2px 8px"
    }}>
                <div></div>
                <div style={{
        "alignItems": "center",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "216px"
      }}>
                  <span style={{
          "alignItems": "center",
          "columnGap": "8px",
          "display": "flex",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "rowGap": "8px",
          "width": "201.242px"
        }}>
  <div style={{
            "alignItems": "center",
            "display": "flex",
            "flexShrink": "0",
            "height": "24px",
            "justifyContent": "center",
            "width": "24px"
          }} aria-hidden="true">
    <div style={{
              "height": "24px",
              "width": "24px"
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
                }} fillRule="evenodd" d="M15.755 7.234a1 1 0 0 1-1.505-.87c.002-.52-.342-1.138-1.038-1.26a7 7 0 0 0-2.424 0c-.696.122-1.04.74-1.038 1.26a1 1 0 0 1-1.505.87c-.45-.262-1.155-.273-1.608.267A7 7 0 0 0 5.42 9.603c-.241.664.122 1.27.574 1.527a1 1 0 0 1 0 1.74c-.452.258-.815.863-.574 1.527a7 7 0 0 0 1.216 2.102c.453.54 1.158.529 1.608.267a1 1 0 0 1 1.505.87c-.002.52.342 1.138 1.038 1.26a7 7 0 0 0 2.424 0c.696-.122 1.04-.74 1.038-1.26a1 1 0 0 1 1.505-.87c.45.262 1.155.273 1.608-.267a7 7 0 0 0 1.216-2.102c.241-.664-.122-1.27-.574-1.528a1 1 0 0 1 0-1.739c.452-.258.815-.864.573-1.527a7 7 0 0 0-1.215-2.102c-.453-.54-1.158-.529-1.608-.267m-1.505.869a2 2 0 0 0 2.008-.005c.112-.064.256-.052.34.046.444.53.8 1.139 1.041 1.802.044.12-.018.252-.13.316a2 2 0 0 0 0 3.476c.112.064.174.195.13.316a6 6 0 0 1-1.042 1.802c-.082.098-.227.11-.339.046a2 2 0 0 0-3.008 1.737c0 .13-.083.249-.21.271a6 6 0 0 1-2.08 0c-.127-.022-.21-.142-.21-.27a2 2 0 0 0-3.007-1.74c-.112.065-.257.053-.34-.045a6 6 0 0 1-1.041-1.802c-.044-.12.018-.252.13-.316a2 2 0 0 0 0-3.476c-.112-.064-.174-.195-.13-.316a6 6 0 0 1 1.042-1.802c.082-.098.227-.11.339-.046A2 2 0 0 0 10.75 6.36c0-.13.083-.249.21-.271a6 6 0 0 1 2.08 0c.127.022.21.141.21.27a2 2 0 0 0 1 1.743M10.5 12a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5" clipRule="evenodd"></path>
      </svg>
    </div>
  </div>
  <span style={{
            "display": "block",
            "maxWidth": "100%",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "textOverflow": "ellipsis",
            "whiteSpace": "nowrap"
          }}>
    <span style={{
              "whiteSpace": "nowrap"
            }}>Admin</span>
  </span>
</span>
                  <div style={{
          "alignItems": "center",
          "display": "flex",
          "flexShrink": "0"
        }}>
  <div>
    <strong style={{
              "alignItems": "center",
              "backgroundColor": "var(--ad-divider, rgb(230, 230, 230))",
              "boxSizing": "content-box",
              "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
              "display": "inline-flex",
              "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
              "fontSize": "11px",
              "fontWeight": "450",
              "height": "16px",
              "letterSpacing": "0.05504px",
              "lineHeight": "16px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "paddingLeft": "4px",
              "paddingRight": "4px",
              "position": "relative",
              "borderRadius": "5px"
            }} aria-label="2 admin notifications">
      <span style={{
                "display": "block",
                "flexGrow": "1",
                "overflowX": "hidden",
                "overflowY": "hidden",
                "textOverflow": "ellipsis",
                "whiteSpace": "nowrap"
              }}>
        <span style={{
                  "whiteSpace": "nowrap"
                }}>2</span>
      </span>
    </strong>
  </div>
</div>
                </div>
              </div>
            </button>;
}
