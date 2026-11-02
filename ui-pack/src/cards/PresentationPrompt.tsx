import type { AirDesignComponentProps } from "../types.ts";

export function PresentationPrompt({
  style,
  className
}: AirDesignComponentProps) {
  return <form style={{
    "backgroundColor": "rgb(255, 255, 255)",
    "boxShadow": "rgba(0, 0, 0, 0.1) 0px 1px 3px 0px, rgba(0, 0, 0, 0.1) 0px 3px 8px 0px, rgba(0, 0, 0, 0.18) 0px 0px 0.5px 0px",
    "boxSizing": "border-box",
    "maxWidth": "680px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "borderRadius": "28px",
    "padding": "16px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    flexShrink: 0,
    width: 680,
    ...style
  }} className={className}>
                      <div style={{
      "display": "flex",
      "flexDirection": "column"
    }}>
                        <div style={{
        "backgroundColor": "rgb(255, 255, 255)",
        "display": "flex",
        "flexGrow": "1",
        "position": "relative"
      }}>
                          <div style={{
          "flexGrow": "1",
          "fontFamily": "Inter",
          "fontSize": "13px",
          "fontWeight": "400",
          "lineHeight": "20px",
          "maxHeight": "200px",
          "minHeight": "20px",
          "overflowWrap": "break-word",
          "overflowX": "auto",
          "overflowY": "auto",
          "position": "relative",
          "width": "648px",
          "wordBreak": "break-word",
          "whiteSpace": "pre-wrap"
        }} role="textbox" aria-disabled="false" aria-placeholder="">
                            <p style={{
            "color": "rgba(0, 0, 0, 0.898)",
            "fontFamily": "Inter",
            "fontSize": "13px",
            "fontWeight": "450",
            "lineHeight": "20px",
            "marginBottom": "0px",
            "marginTop": "0px"
          }}>
  

</p>
                          </div>
                          <div aria-hidden="true"></div>
                          <div style={{
          "color": "rgba(0, 0, 0, 0.3)",
          "display": "-webkit-box",
          "fontFamily": "Inter",
          "fontSize": "13px",
          "fontWeight": "400",
          "left": "0px",
          "lineHeight": "20px",
          "overflowWrap": "break-word",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "position": "absolute",
          "right": "0px",
          "top": "0px",
          "WebkitBoxOrient": "vertical",
          "WebkitLineClamp": "2",
          "minWidth": "0px",
          "minHeight": "0px"
        }} aria-hidden="true">
                            Add your thoughts, notes, or outline to start building your first draft
                          </div>
                        </div>
                        <div style={{
        "clipPath": "inset(50%)",
        "height": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "position": "absolute",
        "width": "1px",
        "minWidth": "0px",
        "minHeight": "0px",
        "whiteSpace": "nowrap",
        "margin": "-1px"
      }}>
                          <div aria-relevant="all" role="status"></div>
                        </div>
                      </div>
                      <div style={{
      "alignItems": "center",
      "display": "flex",
      "justifyContent": "space-between",
      "marginTop": "8px"
    }}>
                        <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "rowGap": "8px"
      }}>
                          <span style={{
          "display": "flex",
          "position": "relative"
        }}>
                            <button style={{
            "alignItems": "center",
            "appearance": "auto",
            "backgroundColor": "rgba(0, 0, 0, 0)",
            "boxSizing": "border-box",
            "color": "rgb(0, 0, 0)",
            "display": "grid",
            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
            "fontSize": "11px",
            "fontWeight": "450",
            "gridTemplateColumns": "24px",
            "gridTemplateRows": "32px",
            "height": "32px",
            "justifyItems": "center",
            "lineHeight": "16px",
            "minWidth": "32px",
            "outlineColor": "rgba(0, 0, 0, 0.1)",
            "outlineOffset": "-1px",
            "outlineStyle": "solid",
            "outlineWidth": "1px",
            "textAlign": "start",
            "width": "32px",
            "borderRadius": "9999px",
            "padding": "0px 4px"
          }} aria-label="Add context" aria-haspopup="menu" aria-expanded="false" type="button">
  <span style={{
              "alignItems": "center",
              "display": "flex",
              "height": "24px",
              "justifyContent": "center",
              "minWidth": "24px",
              "width": "24px",
              "borderRadius": "9999px"
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
                }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6"></path>
    </svg>
  </span>
</button>
                          </span>
                          <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgb(255, 255, 255)",
          "boxSizing": "border-box",
          "color": "rgba(0, 0, 0, 0.898)",
          "columnGap": "4px",
          "display": "flex",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontSize": "11px",
          "fontWeight": "450",
          "height": "32px",
          "justifyItems": "center",
          "lineHeight": "16px",
          "maxWidth": "240px",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "rowGap": "4px",
          "textAlign": "start",
          "minWidth": "0px",
          "border": "1px solid rgb(230, 230, 230)",
          "borderRadius": "9999px",
          "padding": "4px 8px"
        }} aria-label="Select deck template" type="button">
                            <svg style={{
            "display": "block",
            "flexShrink": "0",
            "height": "16px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "16px"
          }} width="16" height="16" fill="none" viewBox="0 0 16 16">
  <path style={{
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M8 2a6 6 0 0 1 5.934 6.895C13.719 10.325 12.39 11 11.274 11H9c0 .821-.343 1.61-.93 2.129-.576.508-1.394.75-2.238.463l-.169-.065A6.001 6.001 0 0 1 8 2m0 1a5 5 0 0 0-1.947 9.606C7.07 13.036 8 12.104 8 11a1 1 0 0 1 1-1h2.274l.149-.006c.69-.05 1.321-.452 1.492-1.104l.03-.144Q13 8.381 13 8a5 5 0 0 0-5-5M5.25 7.986a.75.75 0 1 1-.002 1.502.75.75 0 0 1 .002-1.502m5.5-1.486a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5m-5-1.5a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5m3-.5a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5"></path>
</svg>
                            <span style={{
            "display": "block",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "textOverflow": "ellipsis",
            "minWidth": "0px",
            "whiteSpace": "nowrap"
          }}>
  <span style={{
              "whiteSpace": "nowrap"
            }}>Select deck template</span>
</span>
                          </button>
                        </div>
                        <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "rowGap": "8px"
      }}>
                          <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgb(217, 217, 217)",
          "color": "rgba(16, 16, 16, 0.3)",
          "display": "flex",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontSize": "11px",
          "fontWeight": "450",
          "height": "32px",
          "justifyContent": "center",
          "justifyItems": "center",
          "lineHeight": "16px",
          "textAlign": "start",
          "width": "32px",
          "borderRadius": "9999px",
          "padding": "0px"
        }} aria-label="Send prompt" type="submit" aria-disabled="true" disabled={true}>
  <svg style={{
            "display": "block",
            "height": "24px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "24px"
          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
              "fill": "rgb(255, 255, 255)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M11.725 5.582a.5.5 0 0 1 .629.064l4.5 4.5a.5.5 0 1 1-.707.707L12.5 7.208V18a.5.5 0 0 1-1 0V7.207l-3.646 3.647a.5.5 0 1 1-.708-.707l4.5-4.5z"></path>
  </svg>
</button>
                        </div>
                      </div>
                    </form>;
}
