import type { AirDesignProps } from "../types.ts";

export function ColorPickerButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
    "boxSizing": "border-box",
    "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "textAlign": "start",
    "textOverflow": "ellipsis",
    "width": "208px",
    "whiteSpace": "nowrap",
    "border": "1px solid var(--ad-divider, rgb(230, 230, 230))",
    "borderRadius": "5px",
    "padding": "0px 4px 0px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="Color picker" aria-expanded="false" type="button" className={className} {...rest}>
    <span style={{
      "display": "flex"
    }}>
      <span style={{
        "alignItems": "center",
        "boxSizing": "content-box",
        "columnGap": "6px",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "paddingLeft": "4px",
        "rowGap": "6px"
      }}>
        <div style={{
          "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
          "flexShrink": "0",
          "height": "14px",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "position": "relative",
          "width": "14px",
          "borderRadius": "2px"
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
          <div style={{
            "bottom": "-7px",
            "boxShadow": "var(--ad-border, rgba(0, 0, 0, 0.1)) 0px 0px 0px 2px inset",
            "left": "-7px",
            "position": "absolute",
            "right": "-7px",
            "top": "-7px",
            "transform": "matrix(0.5, 0, 0, 0.5, 0, 0)",
            "transformOrigin": "14px 14px",
            "borderRadius": "20%"
          }}></div>
        </div>
        <div style={{
          "display": "flex",
          "minWidth": "0px"
        }} aria-label="White">
          <div style={{
            "flexShrink": "1000",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "textOverflow": "ellipsis",
            "whiteSpace": "pre-wrap"
          }}>
            <span style={{
              "whiteSpace": "pre"
            }}>Whit</span>
          </div>
          <div style={{
            "flexShrink": "0.5",
            "maxWidth": "80%",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "textOverflow": "ellipsis",
            "whiteSpace": "pre-wrap"
          }}>
            <span style={{
              "whiteSpace": "pre"
            }}>e</span>
          </div>
        </div>
      </span>
    </span>
    <div style={{
      "flexShrink": "0"
    }} aria-hidden="true">
      <svg style={{
        "display": "block",
        "height": "16px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "16px"
      }} width="16" height="16" fill="none" viewBox="0 0 16 16">
        <path style={{
          "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
        }} d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
      </svg>
    </div>
  </button>;
}
