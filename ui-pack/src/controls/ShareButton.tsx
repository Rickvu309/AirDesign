import type { AirDesignProps } from "../types.ts";

export function ShareButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "var(--ad-brand, rgb(255, 92, 22))",
    "color": "var(--ad-surface, rgb(255, 255, 255))",
    "display": "flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "height": "32px",
    "justifyItems": "center",
    "letterSpacing": "0.05504px",
    "lineHeight": "16px",
    "maxWidth": "100%",
    "textAlign": "center",
    "borderRadius": "5px",
    "padding": "0px 12px",
    "width": "64px",
    "minWidth": "64px",
    "flexShrink": "0",
    "boxSizing": "border-box",
    "justifyContent": "center",
    position: "relative",
    ...style
  }} type="button" className={className} {...rest}>
                        <span style={{
      "display": "flex",
      "height": "32px",
      "width": "auto",
      "flexShrink": "0",
      "alignItems": "center",
      "justifyContent": "center"
    }}>
                          <span style={{
        "alignItems": "center",
        "display": "flex",
        "justifyContent": "center",
        "marginLeft": "0px",
        "marginRight": "0px",
        "overflowX": "visible",
        "overflowY": "visible"
      }}>
                            <span style={{
          "display": "block",
          "overflowX": "visible",
          "overflowY": "visible",
          "textOverflow": "clip",
          "whiteSpace": "nowrap"
        }}>
                              <span style={{
            "display": "contents"
          }}>
                                <span style={{
              "whiteSpace": "nowrap"
            }}>Share</span>
                              </span>
                            </span>
                          </span>
                        </span>
                      </button>;
}
