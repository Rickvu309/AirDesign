import type { AirDesignProps } from "../types.js";

export function ColorSwatchBlackButton({
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
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "height": "24px",
    "justifyItems": "center",
    "lineHeight": "16px",
    "outlineColor": "var(--ad-divider, rgb(230, 230, 230))",
    "outlineOffset": "-1px",
    "outlineStyle": "solid",
    "outlineWidth": "1px",
    "textAlign": "start",
    "minWidth": "0px",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Color Variable Black with value var(--ad-ink-strong, #000) at 100%" type="button" className={className} {...rest}>
    <div style={{
      "alignItems": "center",
      "display": "flex",
      "height": "14px",
      "justifyContent": "center",
      "lineHeight": "14px",
      "width": "14px",
      "margin": "4px 4px 4px 5px"
    }}>
      <div style={{
        "backgroundColor": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "flexBasis": "14px",
        "flexShrink": "0",
        "height": "14px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "position": "relative",
        "width": "14px",
        "borderRadius": "2px",
        "margin": "4px"
      }} aria-hidden="true">
        <div style={{
          "backgroundImage": "url(\"data:image/svg+xml;utf8,%3Csvg%20width%3D%226%22%20height%3D%226%22%20viewBox%3D%220%200%206%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M0%200H3V3H0V0Z%22%20fill%3D%22%23E1E1E1%22/%3E%3Cpath%20d%3D%22M3%200H6V3H3V0Z%22%20fill%3D%22white%22/%3E%3Cpath%20d%3D%22M3%203H6V6H3V3Z%22%20fill%3D%22%23E1E1E1%22/%3E%3Cpath%20d%3D%22M0%203H3V6H0V3Z%22%20fill%3D%22white%22/%3E%3C/svg%3E%0A\")",
          "borderBottomRightRadius": "1px",
          "borderTopRightRadius": "1px",
          "height": "14px",
          "opacity": "0",
          "position": "absolute",
          "right": "0px",
          "top": "0px",
          "width": "7px"
        }}></div>
      </div>
    </div>
    <div style={{
      "alignContent": "center",
      "boxSizing": "content-box",
      "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "1px",
      "paddingRight": "4px",
      "textOverflow": "ellipsis",
      "width": "128px",
      "whiteSpace": "nowrap"
    }}>
      <div style={{
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textOverflow": "ellipsis"
      }} aria-label="Black">
        <span style={{
          "whiteSpace": "nowrap"
        }}>Black</span>
      </div>
    </div>
  </button>;
}
