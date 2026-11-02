import type { AirDesignComponentProps } from "../types.ts";

export function AgentComposer({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "display": "flex",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 274,
    ...style
  }} className={className}>
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
                          <span style={{
        "whiteSpace": "nowrap"
      }}>The button action for this text area changes between Send and Stop as the agent works.</span>
                        </div>
                        <div style={{
      "backgroundColor": "rgb(255, 255, 255)",
      "display": "flex",
      "flexGrow": "1",
      "position": "relative"
    }}>
                          <div style={{
        "boxSizing": "border-box",
        "flexGrow": "1",
        "fontFamily": "Inter",
        "fontSize": "13px",
        "lineHeight": "20px",
        "maxHeight": "198.75px",
        "minHeight": "68px",
        "overflowWrap": "break-word",
        "overflowX": "auto",
        "overflowY": "auto",
        "position": "relative",
        "width": "272px",
        "wordBreak": "break-word",
        "whiteSpace": "pre-wrap",
        "padding": "12px 16px"
      }} aria-label="Prompt for AI agent" role="textbox" aria-disabled="false" aria-placeholder="">
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
        "color": "rgba(0, 0, 0, 0.5)",
        "display": "-webkit-box",
        "fontFamily": "Inter",
        "fontSize": "13px",
        "left": "16px",
        "lineHeight": "20px",
        "overflowWrap": "break-word",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "position": "absolute",
        "right": "16px",
        "top": "12px",
        "WebkitBoxOrient": "vertical",
        "WebkitLineClamp": "2",
        "minWidth": "0px",
        "minHeight": "0px"
      }} aria-hidden="true">
                            Ask for changes
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
                      </div>;
}
