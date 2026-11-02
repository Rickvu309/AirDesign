import type { CSSProperties } from "react";
export interface AirDesignComponentProps {
  style?: CSSProperties;
  className?: string;
}
export function GettingStartedDialog({
  style,
  className
}: AirDesignComponentProps) {
  return <section style={{
    "maxHeight": "738.4px",
    "minWidth": "240px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 840,
    maxWidth: "none",
    ...style
  }} className={className}>
                          <h2 style={{
      "clipPath": "inset(50%)",
      "color": "rgba(0, 0, 0, 0.898)",
      "fontFamily": "Inter, sans-serif",
      "fontSize": "11px",
      "fontWeight": "400",
      "height": "1px",
      "lineHeight": "16px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "position": "absolute",
      "width": "1px",
      "whiteSpace": "nowrap",
      "margin": "-1px"
    }}>
  <span style={{
        "whiteSpace": "nowrap"
      }}>Getting started</span>
</h2>
                          <div style={{
      "backgroundColor": "rgb(255, 255, 255)",
      "boxShadow": "rgba(0, 0, 0, 0.15) 0px 2px 5px 0px, rgba(0, 0, 0, 0.18) 0px 10px 24px 0px, rgba(0, 0, 0, 0.08) 0px 0px 0.5px 0px",
      "display": "grid",
      "gridTemplateAreas": "\"header header\" \"sidebar body\" \"sidebar footer\"",
      "gridTemplateColumns": "0px 840px",
      "gridTemplateRows": "49px 631px 0px",
      "height": "680px",
      "maxHeight": "738.4px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "position": "relative",
      "borderRadius": "13px"
    }}>
  <div style={{
        "borderBottomColor": "rgba(0, 0, 0, 0)",
        "borderBottomStyle": "solid",
        "borderBottomWidth": "1px",
        "boxSizing": "border-box",
        "gridColumnEnd": "header",
        "gridColumnStart": "header",
        "gridRowEnd": "header",
        "gridRowStart": "header",
        "minHeight": "48px",
        "minWidth": "0px",
        "padding": "12px"
      }}>
    <div style={{
          "alignItems": "center",
          "columnGap": "16px",
          "display": "flex",
          "rowGap": "16px",
          "width": "816px"
        }}>
      <div style={{
            "alignItems": "center",
            "columnGap": "8px",
            "display": "flex",
            "rowGap": "8px",
            "minWidth": "0px"
          }}>
        <div style={{
              "display": "contents",
              "minWidth": "0px",
              "minHeight": "0px"
            }}>
          <svg style={{
                "display": "block",
                "height": "24px",
                "overflowX": "hidden",
                "overflowY": "hidden",
                "width": "24px"
              }} width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path style={{
                  "fill": "rgb(255, 92, 22)"
                }} fill="var(--color-bg-brand)" d="M0 5a5 5 0 0 1 5-5h14a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5z"></path>
            <path style={{
                  "fill": "rgb(255, 255, 255)"
                }} fill="var(--color-icon-onbrand)" d="M17 6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1.68l.661 2.365a.5.5 0 1 1-.962.27L14.28 16H9.72l-.738 2.635a.5.5 0 0 1-.962-.27L8.68 16H7l-.204-.01A2 2 0 0 1 5 14V8a2 2 0 0 1 2-2zM7 7a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm1.5 4.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2m0-3a1 1 0 1 1 0 2 1 1 0 0 1 0-2"></path>
          </svg>
        </div>
        <span style={{
              "display": "block",
              "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
              "fontSize": "13px",
              "fontWeight": "550",
              "letterSpacing": "-0.032px",
              "lineHeight": "22px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "textOverflow": "ellipsis",
              "minWidth": "0px",
              "whiteSpace": "nowrap"
            }}>
          <span style={{
                "whiteSpace": "nowrap"
              }}>Getting started</span>
        </span>
      </div>
      <div style={{
            "flexShrink": "0",
            "marginLeft": "auto"
          }}>
        <div>
          <button style={{
                "alignItems": "center",
                "appearance": "auto",
                "backgroundColor": "rgba(0, 0, 0, 0)",
                "color": "rgb(0, 0, 0)",
                "display": "grid",
                "fontFamily": "Inter, sans-serif",
                "fontSize": "11px",
                "fontWeight": "400",
                "gridTemplateColumns": "24px",
                "gridTemplateRows": "24px",
                "height": "24px",
                "justifyItems": "center",
                "lineHeight": "16px",
                "minWidth": "24px",
                "outlineColor": "rgba(0, 0, 0, 0)",
                "outlineOffset": "-1px",
                "outlineStyle": "solid",
                "outlineWidth": "1px",
                "textAlign": "start",
                "width": "24px",
                "borderRadius": "5px",
                "padding": "0px"
              }} aria-label="Close" type="button">
            <span style={{
                  "alignItems": "center",
                  "display": "flex",
                  "height": "24px",
                  "justifyContent": "center",
                  "minWidth": "24px",
                  "width": "24px",
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
                      "fill": "rgba(0, 0, 0, 0.898)"
                    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M16.224 7.082a.501.501 0 0 1 .694.693l-.065.078L12.707 12l4.146 4.146.065.078a.5.5 0 0 1-.694.694l-.078-.065L12 12.706l-4.147 4.147a.5.5 0 1 1-.707-.707l4.147-4.147-4.147-4.146-.064-.078a.501.501 0 0 1 .693-.693l.078.064L12 11.293l4.146-4.147z"></path>
              </svg>
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
  <div style={{
        "gridColumnEnd": "body",
        "gridColumnStart": "body",
        "gridRowEnd": "body",
        "gridRowStart": "body",
        "height": "631px",
        "position": "relative",
        "width": "840px",
        "minWidth": "0px",
        "minHeight": "0px"
      }} role="none">
    <div style={{
          "height": "631px",
          "overflowX": "hidden",
          "overflowY": "auto",
          "position": "relative",
          "scrollbarWidth": "none",
          "width": "840px"
        }} role="none">
      <div style={{
            "alignSelf": "stretch",
            "boxSizing": "border-box",
            "display": "flex",
            "flexDirection": "column",
            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
            "fontWeight": "450",
            "letterSpacing": "0.05504px",
            "minHeight": "100%",
            "position": "relative",
            "padding": "16px"
          }} role="none">
        <div style={{
              "backgroundImage": "radial-gradient(57% 59%, color(srgb 1 0.87451 0.8 / 0.5) 0%, color(srgb 1 0.87451 0.8 / 0.275) 22%, color(srgb 1 0.87451 0.8 / 0.11) 42%, color(srgb 1 0.87451 0.8 / 0.03) 60%, rgba(0, 0, 0, 0) 72%)",
              "bottom": "0px",
              "left": "0px",
              "position": "absolute",
              "right": "0px",
              "top": "0px",
              "minWidth": "0px",
              "minHeight": "0px"
            }} aria-hidden="true"></div>
        <div style={{
              "columnGap": "24px",
              "display": "flex",
              "flexDirection": "column",
              "flexGrow": "1",
              "position": "relative",
              "rowGap": "24px",
              "width": "808px",
              "marginRight": "auto",
              "marginLeft": "auto"
            }}>
          <div style={{
                "display": "flex",
                "flexDirection": "column",
                "flexGrow": "1",
                "width": "808px",
                "marginRight": "auto",
                "marginLeft": "auto"
              }}>
            <div style={{
                  "display": "flex",
                  "flexGrow": "1",
                  "justifyContent": "center",
                  "width": "808px"
                }}>
              <div style={{
                    "alignItems": "center",
                    "display": "flex",
                    "flexDirection": "column",
                    "minHeight": "100%",
                    "width": "808px"
                  }}>
                <div style={{
                      "alignItems": "center",
                      "boxSizing": "border-box",
                      "display": "flex",
                      "flexDirection": "column",
                      "marginBottom": "auto",
                      "marginTop": "auto",
                      "maxWidth": "744px",
                      "width": "744px",
                      "padding": "24px"
                    }}>
                  <h1 style={{
                        "color": "rgba(0, 0, 0, 0.898)",
                        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                        "fontSize": "24px",
                        "fontWeight": "550",
                        "letterSpacing": "-0.408px",
                        "lineHeight": "32px",
                        "marginBottom": "24px",
                        "marginTop": "0px"
                      }}>
                    What would you like to present?
                  </h1>
                  <div style={{
                        "marginLeft": "auto",
                        "marginRight": "auto",
                        "maxWidth": "680px",
                        "position": "relative",
                        "width": "680px"
                      }}>
                    <form style={{
                          "backgroundColor": "rgb(255, 255, 255)",
                          "boxShadow": "rgba(0, 0, 0, 0.1) 0px 1px 3px 0px, rgba(0, 0, 0, 0.1) 0px 3px 8px 0px, rgba(0, 0, 0, 0.18) 0px 0px 0.5px 0px",
                          "boxSizing": "border-box",
                          "maxWidth": "680px",
                          "overflowX": "hidden",
                          "overflowY": "hidden",
                          "position": "relative",
                          "width": "680px",
                          "zIndex": "1",
                          "borderRadius": "28px",
                          "padding": "16px"
                        }}>
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
                    </form>
                  </div>
                  <div style={{
                        "marginTop": "24px",
                        "width": "696px"
                      }}>
                    <div style={{
                          "boxSizing": "border-box",
                          "columnGap": "24px",
                          "display": "flex",
                          "justifyContent": "center",
                          "paddingLeft": "12px",
                          "paddingRight": "12px",
                          "rowGap": "24px",
                          "width": "696px"
                        }}>
                      <button style={{
                            "alignItems": "center",
                            "appearance": "auto",
                            "aspectRatio": "1.25 / 1",
                            "backgroundColor": "rgb(255, 255, 255)",
                            "boxSizing": "border-box",
                            "color": "rgb(0, 0, 0)",
                            "display": "flex",
                            "flexBasis": "0px",
                            "flexGrow": "1",
                            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                            "fontSize": "11px",
                            "fontWeight": "450",
                            "height": "180px",
                            "justifyItems": "center",
                            "lineHeight": "16px",
                            "maxHeight": "180px",
                            "maxWidth": "312px",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "position": "relative",
                            "textAlign": "start",
                            "border": "1px solid rgb(230, 230, 230)",
                            "borderRadius": "13px",
                            "padding": "0px"
                          }} aria-label="Start from scratch" type="button">
                        <div style={{
                              "alignItems": "center",
                              "boxSizing": "content-box",
                              "display": "flex",
                              "flexDirection": "column",
                              "left": "0px",
                              "paddingLeft": "24px",
                              "paddingRight": "24px",
                              "position": "absolute",
                              "right": "0px",
                              "top": "24px",
                              "minWidth": "0px",
                              "minHeight": "0px"
                            }} aria-hidden="true">
                          <span style={{
                                "color": "rgba(0, 0, 0, 0.898)",
                                "display": "block",
                                "fontSize": "13px",
                                "fontWeight": "550",
                                "letterSpacing": "-0.032px",
                                "lineHeight": "22px"
                              }}>
  Start from scratch
</span>
                          <span style={{
                                "color": "rgba(0, 0, 0, 0.5)",
                                "display": "block",
                                "textAlign": "center"
                              }}>
  Build using empty slides
</span>
                        </div>
                        <div style={{
                              "display": "flex",
                              "justifyContent": "center",
                              "left": "0px",
                              "position": "absolute",
                              "right": "0px",
                              "top": "99px",
                              "minWidth": "0px",
                              "minHeight": "0px"
                            }}>
                          <img style={{
                                "boxShadow": "rgba(0, 0, 0, 0.15) 0px 2px 5px 0px, rgba(0, 0, 0, 0.12) 0px 10px 16px 0px, rgba(0, 0, 0, 0.12) 0px 0px 0.5px 0px",
                                "display": "block",
                                "height": "110px",
                                "objectFit": "cover",
                                "objectPosition": "0% 0%",
                                "overflowX": "clip",
                                "overflowY": "clip",
                                "transform": "matrix(1, 0, 0, 1, 0, 0)",
                                "transformOrigin": "98px 55px",
                                "width": "196px",
                                "borderRadius": "5px"
                              }} alt="" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxOTYiIGhlaWdodD0iMTEwIiB2aWV3Qm94PSIwIDAgMTk2IDExMCI+PHJlY3Qgd2lkdGg9IjE5NiIgaGVpZ2h0PSIxMTAiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNNjIgMHYxMTAiIHN0cm9rZT0iI2U2ZTZlNiIvPjxyZWN0IHg9IjAiIHk9IjMyIiB3aWR0aD0iNjIiIGhlaWdodD0iNzgiIGZpbGw9IiNmYWZhZmEiLz48cmVjdCB4PSI4IiB5PSIzOCIgd2lkdGg9IjQ0IiBoZWlnaHQ9IjI4IiByeD0iMiIgZmlsbD0iI2VlZSIvPjxyZWN0IHg9IjgiIHk9Ijc0IiB3aWR0aD0iNDQiIGhlaWdodD0iMjgiIHJ4PSIyIiBmaWxsPSIjZWVlIi8+PHJlY3QgeD0iNzUiIHk9IjM0IiB3aWR0aD0iMTA2IiBoZWlnaHQ9IjYwIiByeD0iMiIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjZTZlNmU2Ii8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoOCA1KSBzY2FsZSguMjMpIj48cGF0aCBkPSJNMTMgNTdsMTktNTAgMTkgNTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzFhMWExYSIgc3Ryb2tlLXdpZHRoPSIzLjA2MyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTYgNDRsNTItMTQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmNThhZSIgc3Ryb2tlLXdpZHRoPSIyLjE4OCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9nPjwvc3ZnPg==" aria-hidden="true"></img>
                        </div>
                      </button>
                      <button style={{
                            "alignItems": "center",
                            "appearance": "auto",
                            "aspectRatio": "1.25 / 1",
                            "backgroundColor": "rgb(255, 255, 255)",
                            "boxSizing": "border-box",
                            "color": "rgb(0, 0, 0)",
                            "display": "flex",
                            "flexBasis": "0px",
                            "flexGrow": "1",
                            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                            "fontSize": "11px",
                            "fontWeight": "450",
                            "height": "180px",
                            "justifyItems": "center",
                            "lineHeight": "16px",
                            "maxHeight": "180px",
                            "maxWidth": "312px",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "position": "relative",
                            "textAlign": "start",
                            "border": "1px solid rgb(230, 230, 230)",
                            "borderRadius": "13px",
                            "padding": "0px"
                          }} aria-label="Use a template" type="button">
                        <div style={{
                              "alignItems": "center",
                              "boxSizing": "content-box",
                              "display": "flex",
                              "flexDirection": "column",
                              "left": "0px",
                              "paddingLeft": "24px",
                              "paddingRight": "24px",
                              "position": "absolute",
                              "right": "0px",
                              "top": "24px",
                              "minWidth": "0px",
                              "minHeight": "0px"
                            }} aria-hidden="true">
                          <span style={{
                                "color": "rgba(0, 0, 0, 0.898)",
                                "display": "block",
                                "fontSize": "13px",
                                "fontWeight": "550",
                                "letterSpacing": "-0.032px",
                                "lineHeight": "22px"
                              }}>
  Use a template
</span>
                          <span style={{
                                "color": "rgba(0, 0, 0, 0.5)",
                                "display": "block",
                                "textAlign": "center"
                              }}>
  Browse AirDesign and team-made decks
</span>
                        </div>
                        <div style={{
                              "display": "flex",
                              "justifyContent": "center",
                              "left": "0px",
                              "position": "absolute",
                              "right": "0px",
                              "top": "99px",
                              "minWidth": "0px",
                              "minHeight": "0px"
                            }}>
                          <div style={{
                                "height": "129px",
                                "position": "relative",
                                "width": "205px"
                              }}>
  <img style={{
                                  "boxSizing": "border-box",
                                  "display": "block",
                                  "height": "104px",
                                  "left": "14px",
                                  "objectFit": "cover",
                                  "objectPosition": "0% 0%",
                                  "overflowX": "clip",
                                  "overflowY": "clip",
                                  "position": "absolute",
                                  "top": "0px",
                                  "transform": "matrix(0.997224, 0.0744566, -0.0744566, 0.997224, 0, 0)",
                                  "transformOrigin": "92px 52px",
                                  "width": "184px",
                                  "border": "1px solid rgba(0, 0, 0, 0.1)",
                                  "borderRadius": "5px"
                                }} alt="" src="https://static.figma.com/uploads/bc26f7aba942ed9012e84b07a510c6b17d291ecb" aria-hidden="true"></img>
  <img style={{
                                  "boxShadow": "rgba(0, 0, 0, 0.15) 0px 2px 5px 0px, rgba(0, 0, 0, 0.18) 0px 10px 24px 0px, rgba(0, 0, 0, 0.08) 0px 0px 0.5px 0px",
                                  "boxSizing": "border-box",
                                  "display": "block",
                                  "height": "104px",
                                  "left": "0px",
                                  "objectFit": "cover",
                                  "objectPosition": "0% 0%",
                                  "overflowX": "clip",
                                  "overflowY": "clip",
                                  "position": "absolute",
                                  "top": "12px",
                                  "transform": "matrix(0.997564, 0.0697565, -0.0697565, 0.997564, 0, 0)",
                                  "transformOrigin": "92px 52px",
                                  "width": "184px",
                                  "border": "1px solid rgba(0, 0, 0, 0.1)",
                                  "borderRadius": "5px"
                                }} alt="" src="https://static.figma.com/uploads/b47bf7fc72021ed470c7c2f65b194be3e49fcd0f" aria-hidden="true"></img>
</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
                        </section>;
}
export function ShareDialog({
  style,
  className
}: AirDesignComponentProps) {
  return <section style={{
    "maxHeight": "738.4px",
    "minWidth": "240px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 480,
    maxWidth: "none",
    ...style
  }} className={className}>
    <div style={{
      "columnGap": "8px",
      "display": "flex",
      "flexDirection": "column",
      "maxHeight": "830.7px",
      "rowGap": "8px"
    }}>
      <div style={{
        "backgroundColor": "rgb(255, 255, 255)",
        "boxShadow": "rgba(0, 0, 0, 0.15) 0px 2px 5px 0px, rgba(0, 0, 0, 0.18) 0px 10px 24px 0px, rgba(0, 0, 0, 0.08) 0px 0px 0.5px 0px",
        "display": "grid",
        "gridTemplateAreas": "\"header header\" \"sidebar body\" \"sidebar footer\"",
        "gridTemplateColumns": "0px 480px",
        "gridTemplateRows": "40px 170px 0px",
        "maxHeight": "738.4px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "borderRadius": "13px"
      }}>
        <div style={{
          "alignItems": "center",
          "boxShadow": "rgb(230, 230, 230) 0px -1px 0px 0px inset",
          "boxSizing": "border-box",
          "display": "flex",
          "gridColumnEnd": "header",
          "gridColumnStart": "header",
          "gridRowEnd": "header",
          "gridRowStart": "header",
          "minHeight": "40px",
          "paddingLeft": "8px",
          "paddingRight": "32px",
          "minWidth": "0px"
        }}>
          <div style={{
            "alignItems": "center",
            "display": "flex",
            "flexGrow": "1",
            "fontWeight": "500",
            "justifyContent": "space-between"
          }}>
            <div style={{
              "display": "flex",
              "justifyContent": "space-between"
            }}>
              <h2 style={{
                "color": "rgba(0, 0, 0, 0.898)",
                "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                "fontSize": "11px",
                "fontWeight": "550",
                "letterSpacing": "0.05504px",
                "lineHeight": "16px",
                "marginBottom": "12px",
                "marginLeft": "8px",
                "marginTop": "12px"
              }}>
                Share these slides
              </h2>
            </div>
            <span style={{
              "display": "block",
              "marginRight": "10px"
            }}>
              <div style={{
                "alignItems": "center",
                "alignSelf": "start",
                "columnGap": "8px",
                "display": "flex",
                "justifyContent": "flex-end",
                "minHeight": "40px",
                "rowGap": "8px",
                "marginLeft": "auto"
              }}>
                <div style={{
                  "display": "contents",
                  "minWidth": "0px",
                  "minHeight": "0px"
                }} role="presentation">
                  <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgba(0, 0, 0, 0)",
                    "color": "rgb(226, 76, 12)",
                    "display": "flex",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "500",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "0px"
                  }} aria-haspopup="menu" aria-expanded="false" aria-label="Copy link" type="button">
                    <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px",
                      "fill": "rgb(226, 76, 12)"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <path fill="var(--fpl-icon-color, var(--color-icon))" d="M12.444 10.37a2.998 2.998 0 0 1 .677 4.75l-2 2a3 3 0 1 1-4.243-4.242l1.27-1.27c.262-.263.746-.069.826.293a.44.44 0 0 1-.111.405l-1.278 1.279a2 2 0 1 0 2.829 2.828l2-2a2 2 0 0 0 0-2.828l-.029-.028c-.093-.089-.187-.184-.224-.307a.88.88 0 0 1 .22-.87.05.05 0 0 1 .063-.01m.434-3.492a3 3 0 1 1 4.243 4.242l-1.27 1.27c-.262.262-.745.068-.826-.294a.44.44 0 0 1 .111-.405l1.278-1.278a2 2 0 1 0-2.829-2.828l-2 2a2 2 0 0 0 0 2.828l.029.026c.093.089.186.183.223.306a.88.88 0 0 1-.218.874.05.05 0 0 1-.062.009 3 3 0 0 1-.679-4.75z"></path>
                    </svg>
                    <span style={{
                      "display": "block"
                    }}>
                      <span style={{
                        "display": "contents"
                      }}>
  Copy link
</span>
                    </span>
                    <svg style={{
                      "display": "block",
                      "height": "16px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "16px",
                      "fill": "rgb(226, 76, 12)"
                    }} width="16" height="16" fill="none" viewBox="0 0 16 16">
                      <path fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </span>
          </div>
        </div>
        <div style={{
          "gridColumnEnd": "body",
          "gridColumnStart": "body",
          "gridRowEnd": "body",
          "gridRowStart": "body",
          "height": "170px",
          "position": "relative",
          "width": "480px",
          "minWidth": "0px",
          "minHeight": "0px"
        }} role="none">
          <div style={{
            "height": "170px",
            "overflowX": "hidden",
            "overflowY": "auto",
            "position": "relative",
            "scrollbarWidth": "none",
            "width": "480px"
          }} role="none">
            <div style={{
              "boxSizing": "border-box",
              "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
              "fontWeight": "450",
              "letterSpacing": "0.05504px",
              "paddingLeft": "16px",
              "paddingRight": "16px",
              "paddingTop": "8px"
            }} role="none">
              <div style={{
                "display": "flex",
                "flexDirection": "column"
              }}>
                <div style={{
                  "boxSizing": "content-box",
                  "paddingBottom": "8px",
                  "paddingTop": "8px"
                }}>
                  <form>
                    <div style={{
                      "alignItems": "start",
                      "display": "grid",
                      "gridTemplateColumns": "394.602px 53.3984px",
                      "gridTemplateRows": "34px"
                    }}>
                      <div style={{
                        "flexGrow": "1",
                        "marginRight": "8px",
                        "position": "relative",
                        "minWidth": "0px"
                      }}>
  <div style={{
                          "alignItems": "flex-start",
                          "backgroundColor": "rgb(245, 245, 245)",
                          "boxSizing": "content-box",
                          "display": "flex",
                          "justifyContent": "space-between",
                          "border": "1px solid rgb(245, 245, 245)",
                          "borderRadius": "5px",
                          "padding": "4px"
                        }} role="group">
    <div style={{
                            "alignContent": "flex-start",
                            "columnGap": "4px",
                            "display": "flex",
                            "flexBasis": "0%",
                            "flexGrow": "1",
                            "flexWrap": "wrap",
                            "rowGap": "4px",
                            "minWidth": "0px",
                            "borderRadius": "3px"
                          }}>
      <input style={{
                              "appearance": "auto",
                              "backgroundColor": "rgb(245, 245, 245)",
                              "boxSizing": "content-box",
                              "color": "rgba(0, 0, 0, 0.898)",
                              "display": "block",
                              "flexGrow": "1",
                              "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                              "fontSize": "11px",
                              "fontWeight": "450",
                              "lineHeight": "16px",
                              "marginLeft": "4px",
                              "overflowX": "clip",
                              "overflowY": "clip",
                              "unicodeBidi": "isolate",
                              "width": "367.602px",
                              "border": "1px solid rgba(0, 0, 0, 0)",
                              "padding": "3px 3px 3px 0px"
                            }} aria-expanded="false" aria-label="Add comma separated emails to invite" placeholder="Add comma separated emails to invite" role="combobox" value=""></input>
    </div>
  </div>
</div>
                      <button style={{
                        "alignItems": "center",
                        "appearance": "auto",
                        "backgroundColor": "rgb(217, 217, 217)",
                        "boxSizing": "border-box",
                        "color": "rgb(255, 255, 255)",
                        "display": "flex",
                        "flexShrink": "0",
                        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                        "fontSize": "11px",
                        "fontWeight": "550",
                        "height": "32px",
                        "justifyContent": "center",
                        "justifyItems": "center",
                        "lineHeight": "16px",
                        "textAlign": "center",
                        "width": "53.3984px",
                        "minWidth": "0px",
                        "borderRadius": "5px",
                        "padding": "4px 12px"
                      }} type="submit" aria-disabled="true" disabled={true}>
  Invite
</button>
                    </div>
                  </form>
                </div>
                <div style={{
                  "marginBottom": "8px",
                  "marginLeft": "-16px",
                  "marginRight": "-16px",
                  "maxHeight": "323.05px",
                  "minHeight": "40px",
                  "overflowX": "hidden",
                  "overflowY": "auto"
                }}>
                  <div style={{
                    "boxSizing": "content-box",
                    "paddingLeft": "8px",
                    "paddingRight": "8px"
                  }}>
                    <div style={{
                      "alignItems": "center",
                      "boxSizing": "border-box",
                      "color": "rgba(0, 0, 0, 0.5)",
                      "display": "flex",
                      "height": "28px",
                      "marginTop": "4px",
                      "paddingBottom": "6px",
                      "paddingTop": "6px"
                    }}>
                      <h2 style={{
                        "color": "rgba(0, 0, 0, 0.5)",
                        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                        "fontSize": "11px",
                        "fontWeight": "550",
                        "lineHeight": "16px",
                        "marginBottom": "12px",
                        "marginLeft": "8px",
                        "marginTop": "12px"
                      }}>
  Who has access
</h2>
                    </div>
                    <button style={{
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
                      "padding": "0px 16px 0px 12px"
                    }} type="button">
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
</button>
                    <div style={{
                      "alignItems": "center",
                      "display": "flex",
                      "minHeight": "36px",
                      "width": "464px"
                    }}>
  <div style={{
                        "alignItems": "center",
                        "display": "flex",
                        "flexShrink": "0",
                        "height": "32px",
                        "justifyContent": "center",
                        "marginRight": "4px",
                        "width": "32px"
                      }}>
    <img style={{
                          "color": "rgb(255, 255, 255)",
                          "display": "block",
                          "flexBasis": "24px",
                          "flexShrink": "0",
                          "height": "24px",
                          "overflowX": "clip",
                          "overflowY": "clip",
                          "width": "24px",
                          "borderRadius": "100%"
                        }} alt="" src="https://s3-alpha.figma.com/profile/2352a4b9-1db3-49d6-bb4d-651586207271"></img>
  </div>
  <div style={{
                        "alignItems": "center",
                        "display": "flex",
                        "flexGrow": "1",
                        "height": "16px",
                        "justifyContent": "space-between",
                        "maxWidth": "100%",
                        "overflowX": "hidden",
                        "overflowY": "auto"
                      }}>
    <div style={{
                          "alignItems": "center",
                          "display": "flex",
                          "flexBasis": "0%",
                          "flexGrow": "1",
                          "marginRight": "12px",
                          "overflowX": "hidden",
                          "overflowY": "auto",
                          "whiteSpace": "pre"
                        }}>
      <span style={{
                            "display": "contents",
                            "minWidth": "0px",
                            "minHeight": "0px"
                          }}>
        <b style={{
                              "color": "rgba(0, 0, 0, 0.898)",
                              "display": "block",
                              "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                              "fontSize": "11px",
                              "fontWeight": "450",
                              "lineHeight": "16px",
                              "overflowX": "hidden",
                              "overflowY": "hidden",
                              "textOverflow": "ellipsis",
                              "whiteSpace": "normal"
                            }}>
          <span style={{
                                "whiteSpace": "nowrap"
                              }}>Quan Vu (Richard)</span>
        </b>
         
        <span style={{
                              "color": "rgba(0, 0, 0, 0.5)",
                              "display": "block"
                            }}>
          <span style={{
                                "display": "contents"
                              }}>
            <span style={{
                                  "whiteSpace": "pre"
                                }}> (you)</span>
          </span>
        </span>
      </span>
    </div>
    <span style={{
                          "boxSizing": "content-box",
                          "display": "block",
                          "paddingRight": "8px"
                        }}>
      owner
    </span>
  </div>
</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{
        "backgroundColor": "rgb(255, 255, 255)",
        "boxShadow": "rgba(0, 0, 0, 0.15) 0px 2px 5px 0px, rgba(0, 0, 0, 0.18) 0px 10px 24px 0px, rgba(0, 0, 0, 0.08) 0px 0px 0.5px 0px",
        "display": "grid",
        "gridTemplateAreas": "\"header header\" \"sidebar body\" \"sidebar footer\"",
        "gridTemplateColumns": "0px 480px",
        "gridTemplateRows": "0px 160px 0px",
        "maxHeight": "738.4px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "borderRadius": "13px"
      }}>
        <div style={{
          "gridColumnEnd": "body",
          "gridColumnStart": "body",
          "gridRowEnd": "body",
          "gridRowStart": "body",
          "height": "160px",
          "position": "relative",
          "width": "480px",
          "minWidth": "0px",
          "minHeight": "0px"
        }} role="none">
          <div style={{
            "height": "160px",
            "overflowX": "hidden",
            "overflowY": "auto",
            "position": "relative",
            "scrollbarWidth": "none",
            "width": "480px"
          }} role="none">
            <div style={{
              "boxSizing": "border-box",
              "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
              "fontWeight": "450",
              "letterSpacing": "0.05504px",
              "paddingLeft": "16px",
              "paddingRight": "16px"
            }} role="none">
              <div style={{
                "boxSizing": "content-box",
                "display": "flex",
                "flexDirection": "column",
                "paddingBottom": "8px",
                "paddingTop": "8px",
                "borderRadius": "2px"
              }}>
                <div style={{
                  "display": "flex"
                }}>
                  <div style={{
                    "alignItems": "center",
                    "boxSizing": "border-box",
                    "display": "flex",
                    "isolation": "isolate",
                    "marginLeft": "-8px",
                    "marginRight": "-8px",
                    "minHeight": "36px",
                    "position": "relative",
                    "width": "464px",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
                    <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "bottom": "0px",
                      "color": "rgb(0, 0, 0)",
                      "display": "flex",
                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                      "fontSize": "11px",
                      "fontWeight": "450",
                      "justifyItems": "center",
                      "left": "0px",
                      "lineHeight": "16px",
                      "position": "absolute",
                      "right": "0px",
                      "textAlign": "start",
                      "top": "0px",
                      "zIndex": "-1",
                      "minWidth": "0px",
                      "minHeight": "0px",
                      "padding": "0px"
                    }} type="button"></button>
                    <div style={{
                      "alignItems": "center",
                      "display": "flex",
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7 7h10a1 1 0 0 1 1 1v2H6V8a1 1 0 0 1 1-1m-1 4v5a1 1 0 0 0 1 1h2v-6zm4 6h7a1 1 0 0 0 1-1v-5h-8zM5 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
  </svg>
</div>
                    <div style={{
                      "columnGap": "10px",
                      "display": "flex",
                      "flexGrow": "1",
                      "rowGap": "10px",
                      "textAlign": "left"
                    }} aria-hidden="true">
  <div style={{
                        "display": "flex",
                        "flexBasis": "0%",
                        "flexDirection": "column",
                        "flexGrow": "1"
                      }}>
    <div style={{
                          "alignItems": "center",
                          "columnGap": "10px",
                          "display": "flex",
                          "rowGap": "10px"
                        }}>
      Publish template
    </div>
  </div>
</div>
                    <div style={{
                      "boxSizing": "content-box",
                      "display": "flex",
                      "justifyContent": "center",
                      "paddingBottom": "1px",
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
                          "fill": "rgba(0, 0, 0, 0.898)"
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.647 9.147a.5.5 0 0 1 .707 0l2.5 2.5a.5.5 0 0 1 0 .707l-2.5 2.5a.5.5 0 0 1-.707-.707L12.793 12l-2.146-2.146a.5.5 0 0 1 0-.707"></path>
  </svg>
</div>
                  </div>
                </div>
                <div style={{
                  "display": "flex"
                }}>
                  <div style={{
                    "alignItems": "center",
                    "boxSizing": "border-box",
                    "display": "flex",
                    "isolation": "isolate",
                    "marginLeft": "-8px",
                    "marginRight": "-8px",
                    "minHeight": "36px",
                    "position": "relative",
                    "width": "464px",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
                    <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "bottom": "0px",
                      "color": "rgb(0, 0, 0)",
                      "display": "flex",
                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                      "fontSize": "11px",
                      "fontWeight": "450",
                      "justifyItems": "center",
                      "left": "0px",
                      "lineHeight": "16px",
                      "position": "absolute",
                      "right": "0px",
                      "textAlign": "start",
                      "top": "0px",
                      "zIndex": "-1",
                      "minWidth": "0px",
                      "minHeight": "0px",
                      "padding": "0px"
                    }} type="button"></button>
                    <div style={{
                      "alignItems": "center",
                      "display": "flex",
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M6 5.903C6 4.43 7.604 3.517 8.87 4.269l10.15 6.028c1.307.776 1.305 2.669-.003 3.442l-10.15 5.995c-1.228.724-2.768-.11-2.863-1.5L6 18.098zm1 12.195a.9.9 0 0 0 1.357.774l10.152-5.995a1 1 0 0 0 .002-1.72L8.359 5.129A.9.9 0 0 0 7 5.903z" clipRule="evenodd"></path>
  </svg>
</div>
                    <div style={{
                      "columnGap": "10px",
                      "display": "flex",
                      "flexGrow": "1",
                      "rowGap": "10px",
                      "textAlign": "left"
                    }} aria-hidden="true">
  <div style={{
                        "display": "flex",
                        "flexBasis": "0%",
                        "flexDirection": "column",
                        "flexGrow": "1"
                      }}>
    <div style={{
                          "alignItems": "center",
                          "columnGap": "10px",
                          "display": "flex",
                          "rowGap": "10px"
                        }}>
      Copy presentation link
    </div>
  </div>
</div>
                  </div>
                </div>
                <div style={{
                  "display": "flex"
                }}>
                  <div style={{
                    "alignItems": "center",
                    "boxSizing": "border-box",
                    "display": "flex",
                    "isolation": "isolate",
                    "marginLeft": "-8px",
                    "marginRight": "-8px",
                    "minHeight": "36px",
                    "position": "relative",
                    "width": "464px",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
                    <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "bottom": "0px",
                      "color": "rgb(0, 0, 0)",
                      "display": "flex",
                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                      "fontSize": "11px",
                      "fontWeight": "450",
                      "justifyItems": "center",
                      "left": "0px",
                      "lineHeight": "16px",
                      "position": "absolute",
                      "right": "0px",
                      "textAlign": "start",
                      "top": "0px",
                      "zIndex": "-1",
                      "minWidth": "0px",
                      "minHeight": "0px",
                      "padding": "0px"
                    }} type="button"></button>
                    <div style={{
                      "alignItems": "center",
                      "display": "flex",
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M16.5 7h-9a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5m-9-1A1.5 1.5 0 0 0 6 7.5v9A1.5 1.5 0 0 0 7.5 18h9a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 16.5 6zm3.354 4.146a.5.5 0 0 1 0 .708L9.707 12l1.147 1.146a.5.5 0 0 1-.708.708l-1.5-1.5a.5.5 0 0 1 0-.708l1.5-1.5a.5.5 0 0 1 .708 0m2.292.708a.5.5 0 0 1 .708-.708l1.5 1.5a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708-.708L14.293 12z" clipRule="evenodd"></path>
  </svg>
</div>
                    <div style={{
                      "columnGap": "10px",
                      "display": "flex",
                      "flexGrow": "1",
                      "rowGap": "10px",
                      "textAlign": "left"
                    }} aria-hidden="true">
  <div style={{
                        "display": "flex",
                        "flexBasis": "0%",
                        "flexDirection": "column",
                        "flexGrow": "1"
                      }}>
    <div style={{
                          "alignItems": "center",
                          "columnGap": "10px",
                          "display": "flex",
                          "rowGap": "10px"
                        }}>
      Get embed code
    </div>
  </div>
</div>
                    <div style={{
                      "boxSizing": "content-box",
                      "display": "flex",
                      "justifyContent": "center",
                      "paddingBottom": "1px",
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
                          "fill": "rgba(0, 0, 0, 0.898)"
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.647 9.147a.5.5 0 0 1 .707 0l2.5 2.5a.5.5 0 0 1 0 .707l-2.5 2.5a.5.5 0 0 1-.707-.707L12.793 12l-2.146-2.146a.5.5 0 0 1 0-.707"></path>
  </svg>
</div>
                  </div>
                </div>
                <div style={{
                  "display": "flex",
                  "whiteSpace": "nowrap"
                }}>
                  <div style={{
                    "alignItems": "center",
                    "boxSizing": "border-box",
                    "display": "flex",
                    "isolation": "isolate",
                    "marginLeft": "-8px",
                    "marginRight": "-8px",
                    "minHeight": "36px",
                    "position": "relative",
                    "width": "464px",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
                    <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgb(255, 223, 204)",
                      "bottom": "0px",
                      "color": "rgb(0, 0, 0)",
                      "display": "flex",
                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                      "fontSize": "11px",
                      "fontWeight": "450",
                      "justifyItems": "center",
                      "left": "0px",
                      "lineHeight": "16px",
                      "position": "absolute",
                      "right": "0px",
                      "textAlign": "start",
                      "top": "0px",
                      "zIndex": "-1",
                      "minWidth": "0px",
                      "minHeight": "0px",
                      "borderRadius": "5px",
                      "padding": "0px"
                    }} type="button"></button>
                    <div style={{
                      "alignItems": "center",
                      "display": "flex",
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M11.725 11.082a.5.5 0 0 1 .629.064l2.5 2.5a.5.5 0 0 1-.707.707L12.5 12.708V18.5a.5.5 0 0 1-1 0v-5.793l-1.646 1.646a.5.5 0 1 1-.707-.707l2.5-2.5zM10.379 6a2 2 0 0 1 1.414.586l1.411 1.411.007.003h3.29a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-2a.5.5 0 1 1 0-1h2a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-3.704l-.007-.003-1.704-1.704A1 1 0 0 0 10.379 7H7.5a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1h2a.5.5 0 0 1 0 1h-2a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"></path>
  </svg>
</div>
                    <div style={{
                      "columnGap": "10px",
                      "display": "flex",
                      "flexGrow": "1",
                      "rowGap": "10px",
                      "textAlign": "left"
                    }} aria-hidden="true">
  <div style={{
                        "display": "flex",
                        "flexBasis": "0%",
                        "flexDirection": "column",
                        "flexGrow": "1"
                      }}>
    <div style={{
                          "alignItems": "center",
                          "columnGap": "10px",
                          "display": "flex",
                          "rowGap": "10px"
                        }}>
      <span style={{
                            "whiteSpace": "nowrap"
                          }}>Ready to share with your team?</span>
      <span style={{
                            "clipPath": "inset(50%)",
                            "display": "block",
                            "height": "1px",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "position": "absolute",
                            "width": "1px",
                            "minWidth": "0px",
                            "minHeight": "0px",
                            "margin": "-1px"
                          }}>
        <span style={{
                              "whiteSpace": "nowrap"
                            }}>Move to folder</span>
      </span>
    </div>
  </div>
</div>
                    <div style={{
                      "position": "relative"
                    }}>
  <button style={{
                        "alignItems": "center",
                        "appearance": "auto",
                        "backgroundColor": "rgb(255, 223, 204)",
                        "color": "rgb(226, 76, 12)",
                        "display": "inline-flex",
                        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                        "fontSize": "11px",
                        "fontWeight": "450",
                        "justifyItems": "center",
                        "lineHeight": "16px",
                        "marginRight": "8px",
                        "textAlign": "start",
                        "borderRadius": "5px",
                        "padding": "0px"
                      }} type="button">
    <span style={{
                          "whiteSpace": "nowrap"
                        }}>Move to folder</span>
  </button>
</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div style={{
      "alignItems": "center",
      "display": "flex",
      "justifyContent": "center",
      "position": "absolute",
      "right": "8px",
      "top": "8px"
    }}>
      <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "rgb(0, 0, 0)",
        "display": "grid",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "gridTemplateColumns": "24px",
        "gridTemplateRows": "24px",
        "height": "24px",
        "justifyItems": "center",
        "lineHeight": "16px",
        "minWidth": "24px",
        "outlineColor": "rgba(0, 0, 0, 0)",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "textAlign": "start",
        "width": "24px",
        "borderRadius": "5px",
        "padding": "0px"
      }} aria-label="Close" type="button">
        <span style={{
          "alignItems": "center",
          "display": "flex",
          "height": "24px",
          "justifyContent": "center",
          "minWidth": "24px",
          "width": "24px",
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
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M16.224 7.082a.501.501 0 0 1 .694.693l-.065.078L12.707 12l4.146 4.146.065.078a.5.5 0 0 1-.694.694l-.078-.065L12 12.706l-4.147 4.147a.5.5 0 1 1-.707-.707l4.147-4.147-4.147-4.146-.064-.078a.501.501 0 0 1 .693-.693l.078.064L12 11.293l4.146-4.147z"></path>
          </svg>
        </span>
      </button>
    </div>
  </section>;
}
export function ShareMoreActions({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "backgroundColor": "rgb(255, 255, 255)",
    "boxShadow": "rgba(0, 0, 0, 0.15) 0px 2px 5px 0px, rgba(0, 0, 0, 0.18) 0px 10px 24px 0px, rgba(0, 0, 0, 0.08) 0px 0px 0.5px 0px",
    "display": "grid",
    "gridTemplateAreas": "\"header header\" \"sidebar body\" \"sidebar footer\"",
    "gridTemplateColumns": "0px 480px",
    "gridTemplateRows": "0px 160px 0px",
    "maxHeight": "738.4px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "borderRadius": "13px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 480,
    ...style
  }} className={className}>
  <div style={{
      "gridColumnEnd": "body",
      "gridColumnStart": "body",
      "gridRowEnd": "body",
      "gridRowStart": "body",
      "height": "160px",
      "position": "relative",
      "width": "480px",
      "minWidth": "0px",
      "minHeight": "0px"
    }} role="none">
    <div style={{
        "height": "160px",
        "overflowX": "hidden",
        "overflowY": "auto",
        "position": "relative",
        "scrollbarWidth": "none",
        "width": "480px"
      }} role="none">
      <div style={{
          "boxSizing": "border-box",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontWeight": "450",
          "letterSpacing": "0.05504px",
          "paddingLeft": "16px",
          "paddingRight": "16px"
        }} role="none">
        <div style={{
            "boxSizing": "content-box",
            "display": "flex",
            "flexDirection": "column",
            "paddingBottom": "8px",
            "paddingTop": "8px",
            "borderRadius": "2px"
          }}>
          <div style={{
              "display": "flex"
            }}>
            <div style={{
                "alignItems": "center",
                "boxSizing": "border-box",
                "display": "flex",
                "isolation": "isolate",
                "marginLeft": "-8px",
                "marginRight": "-8px",
                "minHeight": "36px",
                "position": "relative",
                "width": "464px",
                "border": "1px solid rgba(0, 0, 0, 0)",
                "borderRadius": "5px"
              }}>
              <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "bottom": "0px",
                  "color": "rgb(0, 0, 0)",
                  "display": "flex",
                  "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                  "fontSize": "11px",
                  "fontWeight": "450",
                  "justifyItems": "center",
                  "left": "0px",
                  "lineHeight": "16px",
                  "position": "absolute",
                  "right": "0px",
                  "textAlign": "start",
                  "top": "0px",
                  "zIndex": "-1",
                  "minWidth": "0px",
                  "minHeight": "0px",
                  "padding": "0px"
                }} type="button"></button>
              <div style={{
                  "alignItems": "center",
                  "display": "flex",
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
                    }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7 7h10a1 1 0 0 1 1 1v2H6V8a1 1 0 0 1 1-1m-1 4v5a1 1 0 0 0 1 1h2v-6zm4 6h7a1 1 0 0 0 1-1v-5h-8zM5 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
                </svg>
              </div>
              <div style={{
                  "columnGap": "10px",
                  "display": "flex",
                  "flexGrow": "1",
                  "rowGap": "10px",
                  "textAlign": "left"
                }} aria-hidden="true">
                <div style={{
                    "display": "flex",
                    "flexBasis": "0%",
                    "flexDirection": "column",
                    "flexGrow": "1"
                  }}>
                  <div style={{
                      "alignItems": "center",
                      "columnGap": "10px",
                      "display": "flex",
                      "rowGap": "10px"
                    }}>
                    Publish template
                  </div>
                </div>
              </div>
              <div style={{
                  "boxSizing": "content-box",
                  "display": "flex",
                  "justifyContent": "center",
                  "paddingBottom": "1px",
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
                      "fill": "rgba(0, 0, 0, 0.898)"
                    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.647 9.147a.5.5 0 0 1 .707 0l2.5 2.5a.5.5 0 0 1 0 .707l-2.5 2.5a.5.5 0 0 1-.707-.707L12.793 12l-2.146-2.146a.5.5 0 0 1 0-.707"></path>
                </svg>
              </div>
            </div>
          </div>
          <div style={{
              "display": "flex"
            }}>
            <div style={{
                "alignItems": "center",
                "boxSizing": "border-box",
                "display": "flex",
                "isolation": "isolate",
                "marginLeft": "-8px",
                "marginRight": "-8px",
                "minHeight": "36px",
                "position": "relative",
                "width": "464px",
                "border": "1px solid rgba(0, 0, 0, 0)",
                "borderRadius": "5px"
              }}>
              <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "bottom": "0px",
                  "color": "rgb(0, 0, 0)",
                  "display": "flex",
                  "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                  "fontSize": "11px",
                  "fontWeight": "450",
                  "justifyItems": "center",
                  "left": "0px",
                  "lineHeight": "16px",
                  "position": "absolute",
                  "right": "0px",
                  "textAlign": "start",
                  "top": "0px",
                  "zIndex": "-1",
                  "minWidth": "0px",
                  "minHeight": "0px",
                  "padding": "0px"
                }} type="button"></button>
              <div style={{
                  "alignItems": "center",
                  "display": "flex",
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
                    }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M6 5.903C6 4.43 7.604 3.517 8.87 4.269l10.15 6.028c1.307.776 1.305 2.669-.003 3.442l-10.15 5.995c-1.228.724-2.768-.11-2.863-1.5L6 18.098zm1 12.195a.9.9 0 0 0 1.357.774l10.152-5.995a1 1 0 0 0 .002-1.72L8.359 5.129A.9.9 0 0 0 7 5.903z" clipRule="evenodd"></path>
                </svg>
              </div>
              <div style={{
                  "columnGap": "10px",
                  "display": "flex",
                  "flexGrow": "1",
                  "rowGap": "10px",
                  "textAlign": "left"
                }} aria-hidden="true">
                <div style={{
                    "display": "flex",
                    "flexBasis": "0%",
                    "flexDirection": "column",
                    "flexGrow": "1"
                  }}>
                  <div style={{
                      "alignItems": "center",
                      "columnGap": "10px",
                      "display": "flex",
                      "rowGap": "10px"
                    }}>
                    Copy presentation link
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{
              "display": "flex"
            }}>
            <div style={{
                "alignItems": "center",
                "boxSizing": "border-box",
                "display": "flex",
                "isolation": "isolate",
                "marginLeft": "-8px",
                "marginRight": "-8px",
                "minHeight": "36px",
                "position": "relative",
                "width": "464px",
                "border": "1px solid rgba(0, 0, 0, 0)",
                "borderRadius": "5px"
              }}>
              <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "bottom": "0px",
                  "color": "rgb(0, 0, 0)",
                  "display": "flex",
                  "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                  "fontSize": "11px",
                  "fontWeight": "450",
                  "justifyItems": "center",
                  "left": "0px",
                  "lineHeight": "16px",
                  "position": "absolute",
                  "right": "0px",
                  "textAlign": "start",
                  "top": "0px",
                  "zIndex": "-1",
                  "minWidth": "0px",
                  "minHeight": "0px",
                  "padding": "0px"
                }} type="button"></button>
              <div style={{
                  "alignItems": "center",
                  "display": "flex",
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
                    }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M16.5 7h-9a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5m-9-1A1.5 1.5 0 0 0 6 7.5v9A1.5 1.5 0 0 0 7.5 18h9a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 16.5 6zm3.354 4.146a.5.5 0 0 1 0 .708L9.707 12l1.147 1.146a.5.5 0 0 1-.708.708l-1.5-1.5a.5.5 0 0 1 0-.708l1.5-1.5a.5.5 0 0 1 .708 0m2.292.708a.5.5 0 0 1 .708-.708l1.5 1.5a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708-.708L14.293 12z" clipRule="evenodd"></path>
                </svg>
              </div>
              <div style={{
                  "columnGap": "10px",
                  "display": "flex",
                  "flexGrow": "1",
                  "rowGap": "10px",
                  "textAlign": "left"
                }} aria-hidden="true">
                <div style={{
                    "display": "flex",
                    "flexBasis": "0%",
                    "flexDirection": "column",
                    "flexGrow": "1"
                  }}>
                  <div style={{
                      "alignItems": "center",
                      "columnGap": "10px",
                      "display": "flex",
                      "rowGap": "10px"
                    }}>
                    Get embed code
                  </div>
                </div>
              </div>
              <div style={{
                  "boxSizing": "content-box",
                  "display": "flex",
                  "justifyContent": "center",
                  "paddingBottom": "1px",
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
                      "fill": "rgba(0, 0, 0, 0.898)"
                    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.647 9.147a.5.5 0 0 1 .707 0l2.5 2.5a.5.5 0 0 1 0 .707l-2.5 2.5a.5.5 0 0 1-.707-.707L12.793 12l-2.146-2.146a.5.5 0 0 1 0-.707"></path>
                </svg>
              </div>
            </div>
          </div>
          <div style={{
              "display": "flex",
              "whiteSpace": "nowrap"
            }}>
            <div style={{
                "alignItems": "center",
                "boxSizing": "border-box",
                "display": "flex",
                "isolation": "isolate",
                "marginLeft": "-8px",
                "marginRight": "-8px",
                "minHeight": "36px",
                "position": "relative",
                "width": "464px",
                "border": "1px solid rgba(0, 0, 0, 0)",
                "borderRadius": "5px"
              }}>
              <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgb(255, 223, 204)",
                  "bottom": "0px",
                  "color": "rgb(0, 0, 0)",
                  "display": "flex",
                  "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                  "fontSize": "11px",
                  "fontWeight": "450",
                  "justifyItems": "center",
                  "left": "0px",
                  "lineHeight": "16px",
                  "position": "absolute",
                  "right": "0px",
                  "textAlign": "start",
                  "top": "0px",
                  "zIndex": "-1",
                  "minWidth": "0px",
                  "minHeight": "0px",
                  "borderRadius": "5px",
                  "padding": "0px"
                }} type="button"></button>
              <div style={{
                  "alignItems": "center",
                  "display": "flex",
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
                    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M11.725 11.082a.5.5 0 0 1 .629.064l2.5 2.5a.5.5 0 0 1-.707.707L12.5 12.708V18.5a.5.5 0 0 1-1 0v-5.793l-1.646 1.646a.5.5 0 1 1-.707-.707l2.5-2.5zM10.379 6a2 2 0 0 1 1.414.586l1.411 1.411.007.003h3.29a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-2a.5.5 0 1 1 0-1h2a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-3.704l-.007-.003-1.704-1.704A1 1 0 0 0 10.379 7H7.5a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1h2a.5.5 0 0 1 0 1h-2a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"></path>
                </svg>
              </div>
              <div style={{
                  "columnGap": "10px",
                  "display": "flex",
                  "flexGrow": "1",
                  "rowGap": "10px",
                  "textAlign": "left"
                }} aria-hidden="true">
                <div style={{
                    "display": "flex",
                    "flexBasis": "0%",
                    "flexDirection": "column",
                    "flexGrow": "1"
                  }}>
                  <div style={{
                      "alignItems": "center",
                      "columnGap": "10px",
                      "display": "flex",
                      "rowGap": "10px"
                    }}>
                    <span style={{
                        "whiteSpace": "nowrap"
                      }}>Ready to share with your team?</span>
                    <span style={{
                        "clipPath": "inset(50%)",
                        "display": "block",
                        "height": "1px",
                        "overflowX": "hidden",
                        "overflowY": "hidden",
                        "position": "absolute",
                        "width": "1px",
                        "minWidth": "0px",
                        "minHeight": "0px",
                        "margin": "-1px"
                      }}>
                      <span style={{
                          "whiteSpace": "nowrap"
                        }}>Move to folder</span>
                    </span>
                  </div>
                </div>
              </div>
              <div style={{
                  "position": "relative"
                }}>
                <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgb(255, 223, 204)",
                    "color": "rgb(226, 76, 12)",
                    "display": "inline-flex",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontSize": "11px",
                    "fontWeight": "450",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "marginRight": "8px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "0px"
                  }} type="button">
                  <span style={{
                      "whiteSpace": "nowrap"
                    }}>Move to folder</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>;
}
