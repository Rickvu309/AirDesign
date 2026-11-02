import type { AirDesignProps } from "../types.js";

export function NewChatButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "flex-start",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
    "columnGap": "14px",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "rowGap": "14px",
    "textAlign": "left",
    "width": "290px",
    "borderRadius": "5px",
    "padding": "8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" className={className} {...rest}>
          <div style={{
      "flexShrink": "0",
      "height": "32px",
      "position": "relative",
      "width": "32px"
    }}>
            <div style={{
        "alignItems": "center",
        "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
        "boxSizing": "content-box",
        "display": "flex",
        "height": "32px",
        "justifyContent": "center",
        "width": "32px",
        "border": "1px solid var(--ad-border, rgba(0, 0, 0, 0.1))",
        "borderRadius": "5px"
      }} aria-hidden="true">
              <svg style={{
          "display": "block",
          "height": "24px",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "width": "24px"
        }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path style={{
            "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
          }} fillRule="evenodd" d="M10.39 6.057c.599-1.407 2.624-1.407 3.222 0l.056.146L14.7 9.302l3.1 1.034c1.6.534 1.6 2.799 0 3.333L14.7 14.7l-1.032 3.1-.055.145c-.618 1.454-2.76 1.406-3.278-.145l-1.034-3.1-3.099-1.032c-1.551-.517-1.6-2.66-.145-3.279l.145-.054 3.099-1.034 1.034-3.1zm2.3.387c-.256-.59-1.123-.59-1.378 0l-.034.087-1.029 3.087-.158.474-.474.158-3.098 1.034c-.69.23-.69 1.206 0 1.435l3.098 1.033.474.158.158.475 1.034 3.1.052.12c.298.566 1.168.526 1.384-.12l1.032-3.1.158-.475.475-.158 3.1-1.033.12-.05c.566-.298.526-1.17-.12-1.385l-3.1-1.034-.475-.158-.158-.475-1.032-3.099h-.001z" clipRule="evenodd"></path>
              </svg>
            </div>
          </div>
          <div style={{
      "columnGap": "2px",
      "display": "flex",
      "flexDirection": "column",
      "flexGrow": "1",
      "rowGap": "2px",
      "minWidth": "0px"
    }}>
            <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "rowGap": "8px",
        "minWidth": "0px"
      }}>
              <div style={{
          "alignItems": "center",
          "columnGap": "4px",
          "display": "flex",
          "flexGrow": "1",
          "rowGap": "4px",
          "minWidth": "0px"
        }}>
                <div style={{
            "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
            "fontWeight": "550",
            "letterSpacing": "0.05504px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "textOverflow": "ellipsis",
            "minWidth": "0px",
            "whiteSpace": "nowrap"
          }}>
                  <span style={{
              "whiteSpace": "nowrap"
            }}>New chat</span>
                </div>
              </div>
              <div style={{
          "alignItems": "center",
          "columnGap": "8px",
          "display": "flex",
          "flexShrink": "0",
          "justifyContent": "flex-end",
          "rowGap": "8px"
        }}>
                <div style={{
            "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
            "flexShrink": "0",
            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
            "fontWeight": "450",
            "letterSpacing": "0.05504px",
            "maxWidth": "80px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "textOverflow": "ellipsis",
            "whiteSpace": "nowrap"
          }}>
                  <span style={{
              "whiteSpace": "nowrap"
            }}>Just now</span>
                </div>
              </div>
            </div>
            <div style={{
        "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
        "display": "-webkit-box",
        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
        "fontWeight": "450",
        "letterSpacing": "0.05504px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textOverflow": "ellipsis",
        "WebkitBoxOrient": "vertical",
        "WebkitLineClamp": "2"
      }}>
              Not started
            </div>
          </div>
        </button>;
}
