import type { AirDesignProps } from "../types.js";

export function FileAgentsButton({
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
    "columnGap": "2px",
    "display": "flex",
    "flexDirection": "column",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "rowGap": "2px",
    "textAlign": "start",
    "width": "56px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-expanded="false" aria-label="Agents" type="button" className={className} {...rest}>
        <div style={{
      "alignItems": "center",
      "display": "flex",
      "height": "32px",
      "justifyContent": "center",
      "width": "32px",
      "borderRadius": "5px"
    }}>
          <span style={{
        "display": "flex"
      }}>
            <div style={{
          "height": "fit-content",
          "position": "relative",
          "width": "fit-content"
        }}>
              <svg style={{
            "display": "block",
            "height": "24px",
            "maskComposite": "exclude",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "24px"
          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path style={{
              "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
            }} fillRule="evenodd" d="M10.39 6.057c.599-1.407 2.624-1.407 3.222 0l.056.146L14.7 9.302l3.1 1.034c1.6.534 1.6 2.799 0 3.333L14.7 14.7l-1.032 3.1-.055.145c-.618 1.454-2.76 1.406-3.278-.145l-1.034-3.1-3.099-1.032c-1.551-.517-1.6-2.66-.145-3.279l.145-.054 3.099-1.034 1.034-3.1zm2.3.387c-.256-.59-1.123-.59-1.378 0l-.034.087-1.029 3.087-.158.474-.474.158-3.098 1.034c-.69.23-.69 1.206 0 1.435l3.098 1.033.474.158.158.475 1.034 3.1.052.12c.298.566 1.168.526 1.384-.12l1.032-3.1.158-.475.475-.158 3.1-1.033.12-.05c.566-.298.526-1.17-.12-1.385l-3.1-1.034-.475-.158-.158-.475-1.032-3.099h-.001z" clipRule="evenodd"></path>
              </svg>
            </div>
          </span>
        </div>
        <span style={{
      "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
      "display": "block",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "9px",
      "fontWeight": "450",
      "height": "14px",
      "letterSpacing": "0.04496px",
      "lineHeight": "14px",
      "marginLeft": "8px",
      "marginRight": "8px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "position": "relative",
      "textAlign": "center",
      "width": "40px",
      "whiteSpace": "nowrap"
    }}>
          <span style={{
        "whiteSpace": "nowrap"
      }}>Agents</span>
        </span>
      </button>;
}
