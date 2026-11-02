import type { AirDesignComponentProps } from "../types.ts";

export function NewSlidesFileButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(245, 245, 245)",
    "boxShadow": "rgb(230, 230, 230) 0px 0px 0px 1px inset",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "flexShrink": "0",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "textAlign": "start",
    "borderRadius": "9999px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    ...style
  }} aria-label="New Slides file" type="button" className={className}>
                <div style={{
      "display": "grid",
      "gridTemplateColumns": "87.8359px",
      "gridTemplateRows": "32px"
    }}>
                  <div style={{
        "gridColumnEnd": "auto",
        "gridRowEnd": "auto",
        "gridColumnStart": "1",
        "gridRowStart": "1"
      }}>
                    <div style={{
          "alignItems": "center",
          "boxSizing": "content-box",
          "columnGap": "8px",
          "display": "flex",
          "rowGap": "8px",
          "padding": "8px 16px"
        }}>
                      <div style={{
            "backgroundColor": "rgb(255, 92, 22)",
            "borderRadius": "2px"
          }}>
                        <svg style={{
              "display": "block",
              "height": "16px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "16px"
            }} width="16" height="16" fill="none" viewBox="0 0 16 16">
  <path style={{
                "fill": "rgb(255, 255, 255)"
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M4 4h8a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m.434 8H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-.434l.412 1.354a.5.5 0 1 1-.956.292L10.52 12H5.479l-.5 1.646a.5.5 0 1 1-.957-.292zM5 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2m0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2" clipRule="evenodd"></path>
</svg>
                      </div>
                      <span style={{
            "alignItems": "center",
            "columnGap": "4px",
            "display": "flex",
            "rowGap": "4px"
          }}>
                        <span style={{
              "color": "rgba(0, 0, 0, 0.898)",
              "display": "block",
              "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
              "fontWeight": "450",
              "letterSpacing": "0.05504px"
            }}>
  Slides
</span>
                      </span>
                    </div>
                  </div>
                  <div style={{
        "gridColumnEnd": "auto",
        "gridRowEnd": "auto",
        "opacity": "0",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "gridColumnStart": "1",
        "gridRowStart": "1"
      }}>
                    <div style={{
          "backgroundColor": "rgb(255, 255, 255)"
        }}>
                      <div style={{
            "backgroundColor": "rgba(0, 0, 0, 0.05)",
            "height": "32px",
            "minHeight": "12px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "borderRadius": "2px"
          }}>
                        <div style={{
              "backgroundColor": "rgba(255, 255, 255, 0.1)",
              "height": "32px",
              "opacity": "0.560982"
            }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </button>;
}
