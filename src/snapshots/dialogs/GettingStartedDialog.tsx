import type { AirDesignProps } from "../types.js";

export function GettingStartedDialog({
  style,
  className,
  ...rest
}: AirDesignProps<"section">) {
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
  }} className={className} {...rest}>
                          <h2 style={{
      "clipPath": "inset(50%)",
      "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
      "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
      "boxShadow": "var(--ad-border-strong, rgba(0, 0, 0, 0.15)) 0px 2px 5px 0px, rgba(0, 0, 0, 0.18) 0px 10px 24px 0px, rgba(0, 0, 0, 0.08) 0px 0px 0.5px 0px",
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
                  "fill": "var(--ad-brand, rgb(255, 92, 22))"
                }} d="M0 5a5 5 0 0 1 5-5h14a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5z"></path>
            <path style={{
                  "fill": "var(--ad-surface, rgb(255, 255, 255))"
                }} d="M17 6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1.68l.661 2.365a.5.5 0 1 1-.962.27L14.28 16H9.72l-.738 2.635a.5.5 0 0 1-.962-.27L8.68 16H7l-.204-.01A2 2 0 0 1 5 14V8a2 2 0 0 1 2-2zM7 7a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm1.5 4.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2m0-3a1 1 0 1 1 0 2 1 1 0 0 1 0-2"></path>
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
                "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                      "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                    }} d="M16.224 7.082a.501.501 0 0 1 .694.693l-.065.078L12.707 12l4.146 4.146.065.078a.5.5 0 0 1-.694.694l-.078-.065L12 12.706l-4.147 4.147a.5.5 0 1 1-.707-.707l4.147-4.147-4.147-4.146-.064-.078a.501.501 0 0 1 .693-.693l.078.064L12 11.293l4.146-4.147z"></path>
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
                        "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                          "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
                          "boxShadow": "var(--ad-border, rgba(0, 0, 0, 0.1)) 0px 1px 3px 0px, var(--ad-border, rgba(0, 0, 0, 0.1)) 0px 3px 8px 0px, rgba(0, 0, 0, 0.18) 0px 0px 0.5px 0px",
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
                              "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
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
                                  "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                                "color": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))",
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
                                  "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                                  "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
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
                                        "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                                      }} d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6"></path>
    </svg>
  </span>
</button>
                          </span>
                          <button style={{
                                "alignItems": "center",
                                "appearance": "auto",
                                "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
                                "boxSizing": "border-box",
                                "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                                "border": "1px solid var(--ad-divider, rgb(230, 230, 230))",
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
                                    "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                                  }} d="M8 2a6 6 0 0 1 5.934 6.895C13.719 10.325 12.39 11 11.274 11H9c0 .821-.343 1.61-.93 2.129-.576.508-1.394.75-2.238.463l-.169-.065A6.001 6.001 0 0 1 8 2m0 1a5 5 0 0 0-1.947 9.606C7.07 13.036 8 12.104 8 11a1 1 0 0 1 1-1h2.274l.149-.006c.69-.05 1.321-.452 1.492-1.104l.03-.144Q13 8.381 13 8a5 5 0 0 0-5-5M5.25 7.986a.75.75 0 1 1-.002 1.502.75.75 0 0 1 .002-1.502m5.5-1.486a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5m-5-1.5a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5m3-.5a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5"></path>
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
                                "backgroundColor": "var(--ad-divider-strong, rgb(217, 217, 217))",
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
                                    "fill": "var(--ad-surface, rgb(255, 255, 255))"
                                  }} d="M11.725 5.582a.5.5 0 0 1 .629.064l4.5 4.5a.5.5 0 1 1-.707.707L12.5 7.208V18a.5.5 0 0 1-1 0V7.207l-3.646 3.647a.5.5 0 1 1-.708-.707l4.5-4.5z"></path>
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
                            "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
                            "boxSizing": "border-box",
                            "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                            "border": "1px solid var(--ad-divider, rgb(230, 230, 230))",
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
                                "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                                "display": "block",
                                "fontSize": "13px",
                                "fontWeight": "550",
                                "letterSpacing": "-0.032px",
                                "lineHeight": "22px"
                              }}>
  Start from scratch
</span>
                          <span style={{
                                "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
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
                                "boxShadow": "var(--ad-border-strong, rgba(0, 0, 0, 0.15)) 0px 2px 5px 0px, rgba(0, 0, 0, 0.12) 0px 10px 16px 0px, rgba(0, 0, 0, 0.12) 0px 0px 0.5px 0px",
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
                            "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
                            "boxSizing": "border-box",
                            "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                            "border": "1px solid var(--ad-divider, rgb(230, 230, 230))",
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
                                "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                                "display": "block",
                                "fontSize": "13px",
                                "fontWeight": "550",
                                "letterSpacing": "-0.032px",
                                "lineHeight": "22px"
                              }}>
  Use a template
</span>
                          <span style={{
                                "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
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
                                  "border": "1px solid var(--ad-border, rgba(0, 0, 0, 0.1))",
                                  "borderRadius": "5px"
                                }} alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23e6e6e6'/%3E%3C/svg%3E" aria-hidden="true"></img>
  <img style={{
                                  "boxShadow": "var(--ad-border-strong, rgba(0, 0, 0, 0.15)) 0px 2px 5px 0px, rgba(0, 0, 0, 0.18) 0px 10px 24px 0px, rgba(0, 0, 0, 0.08) 0px 0px 0.5px 0px",
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
                                  "border": "1px solid var(--ad-border, rgba(0, 0, 0, 0.1))",
                                  "borderRadius": "5px"
                                }} alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23e6e6e6'/%3E%3C/svg%3E" aria-hidden="true"></img>
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
