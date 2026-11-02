import type { AirDesignProps } from "../types.js";

export function PresenterNotes({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return (<div style={{
  "alignItems": "center",
  "display": "flex",
  "flexDirection": "column",
  position: "relative",
  fontFamily: "Inter, sans-serif",
  fontSize: 11,
  lineHeight: "16px",
  boxSizing: "border-box",
  flexShrink: 0,
  width: 932,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  ...style
}} className={className} {...rest}>
    <div style={{
    "boxSizing": "content-box",
    "display": "flex",
    "justifyContent": "center",
    "width": "64px",
    "padding": "13px"
  }}>
      <div style={{
      "backgroundColor": "rgba(179, 179, 179, 0.5)",
      "flexShrink": "0",
      "height": "4px",
      "position": "relative",
      "width": "64px",
      "borderRadius": "16px"
    }}>
        <div style={{
        "height": "4px",
        "left": "0px",
        "position": "absolute",
        "top": "0px",
        "width": "64px"
      }} role="separator" aria-orientation="horizontal" aria-valuenow={24} aria-valuetext="24% of maximum size" aria-label="Resize presenter notes">
          <div style={{
          "backgroundColor": "rgba(179, 179, 179, 0.5)",
          "boxSizing": "content-box",
          "left": "32px",
          "opacity": "0",
          "position": "absolute",
          "top": "2px",
          "transform": "matrix(0, 0, 0, 0, -65.0703, -10)",
          "transformOrigin": "65.0703px 10px",
          "borderRadius": "16px",
          "padding": "2px 8px"
        }}>
            <p style={{
            "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
            "fontFamily": "Inter, sans-serif",
            "fontSize": "11px",
            "fontWeight": "400",
            "lineHeight": "16px",
            "marginBottom": "0px",
            "marginTop": "0px",
            "whiteSpace": "nowrap"
          }}>
              <span style={{
              "whiteSpace": "nowrap"
            }}>Show presenter notes</span>
            </p>
          </div>
        </div>
      </div>
    </div>
    <div style={{
    "boxSizing": "border-box",
    "height": "96px",
    "paddingLeft": "32px",
    "paddingRight": "32px",
    "position": "relative",
    "width": "932px"
  }}>
      <div style={{
      "height": "96px",
      "isolation": "isolate",
      "position": "relative"
    }}>
        <div style={{
        "backgroundColor": "var(--ad-divider, rgb(230, 230, 230))",
        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
        "fontSize": "13px",
        "height": "96px",
        "letterSpacing": "-0.003px",
        "lineHeight": "17px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "position": "relative",
        "borderRadius": "8px"
      }}>
          <div style={{
          "alignItems": "flex-start",
          "display": "flex",
          "height": "96px",
          "overflowX": "hidden",
          "overflowY": "scroll",
          "scrollbarWidth": "none",
          "width": "868px"
        }}>
            <div style={{
            "height": "96px",
            "width": "868px"
          }}>
              <div style={{
              "height": "96px"
            }}>
                <div style={{
                "boxSizing": "border-box",
                "height": "96px",
                "padding": "20px"
              }}>
                  <div style={{
                  "height": "56px",
                  "isolation": "isolate"
                }}>
                    <section style={{
                    "height": "56px"
                  }} aria-label="Presenter Notes">
                      <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                      "display": "flex",
                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                      "fontSize": "13px",
                      "fontWeight": "400",
                      "height": "96px",
                      "justifyItems": "center",
                      "left": "0px",
                      "lineHeight": "17px",
                      "opacity": "0",
                      "position": "absolute",
                      "textAlign": "start",
                      "top": "0px",
                      "width": "868px",
                      "zIndex": "-1",
                      "padding": "0px"
                    }} type="button">
                        Press Enter to edit presenter notes
                      </button>
                      <div style={{
                      "height": "56px",
                      "overflowWrap": "break-word",
                      "position": "relative",
                      "wordBreak": "break-word",
                      "zIndex": "1",
                      "whiteSpace": "pre-wrap"
                    }} role="textbox" aria-placeholder="Add presenter notes…">
                        <p style={{
                        "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                        "fontSize": "13px",
                        "fontWeight": "400",
                        "lineHeight": "17px",
                        "marginBottom": "0px",
                        "marginTop": "0px"
                      }}>
                          

                        </p>
                      </div>
                      <div aria-hidden="true"></div>
                    </section>
                    <div style={{
                    "boxSizing": "content-box",
                    "color": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))",
                    "left": "0px",
                    "position": "absolute",
                    "right": "0px",
                    "top": "0px",
                    "padding": "20px"
                  }}>
                      <div style={{
                      "clipPath": "inset(50%)",
                      "height": "1px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "position": "absolute",
                      "width": "1px",
                      "whiteSpace": "nowrap",
                      "margin": "-1px"
                    }}>
                        <div aria-relevant="all" role="status"></div>
                      </div>
                      <div style={{
                      "alignItems": "flex-start",
                      "columnGap": "8px",
                      "display": "flex",
                      "marginBottom": "8px",
                      "position": "relative"
                    }}>
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
                        }}>Add presenter notes…</span>
                        </span>
                        <div style={{
                        "alignItems": "center",
                        "display": "flex",
                        "flexShrink": "0",
                        "marginLeft": "auto",
                        "marginTop": "-4px",
                        "position": "relative",
                        "zIndex": "2"
                      }}>
                          <button style={{
                          "alignItems": "center",
                          "appearance": "auto",
                          "backgroundColor": "rgba(0, 0, 0, 0)",
                          "boxSizing": "border-box",
                          "color": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))",
                          "display": "flex",
                          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                          "fontSize": "13px",
                          "fontWeight": "400",
                          "justifyItems": "center",
                          "lineHeight": "17px",
                          "textAlign": "start",
                          "border": "1px solid var(--ad-border, rgba(0, 0, 0, 0.1))",
                          "borderRadius": "5px",
                          "padding": "0px 36px 0px 4px"
                        }} aria-label="Start with an AI draft" type="button">
                            <svg style={{
                            "display": "block",
                            "height": "24px",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "width": "24px"
                          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                              <path style={{
                              "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                            }} d="M14.5 7.001a.5.5 0 0 1 0 1H7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-4.5a.5.5 0 1 1 1 0v4.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm-1 6a.5.5 0 1 1 0 1h-5a.5.5 0 0 1 0-1zm2-3a.5.5 0 1 1 0 1h-7a.5.5 0 0 1 0-1zm2.515-4.56c.126-.505.844-.505.97 0l.315 1.26 1.26.315c.505.126.505.844 0 .97l-1.26.315-.315 1.26c-.126.505-.844.505-.97 0L17.7 8.3l-1.26-.315c-.505-.126-.505-.844 0-.97L17.7 6.7z"></path>
                            </svg>
                            Start with a draft
                          </button>
                          <div style={{
                          "alignItems": "center",
                          "display": "flex",
                          "position": "absolute",
                          "right": "8px",
                          "top": "13px",
                          "transform": "matrix(1, 0, 0, 1, 0, -9)",
                          "transformOrigin": "10.1719px 9px",
                          "minWidth": "0px",
                          "minHeight": "0px"
                        }}>
                            <a style={{
                            "alignItems": "center",
                            "color": "rgb(0, 0, 238)",
                            "display": "flex",
                            "flexShrink": "0",
                            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                            "fontSize": "13px",
                            "fontWeight": "400",
                            "lineHeight": "17px",
                            "borderRadius": "5px"
                          }} aria-label="AI, Learn more" href="#" rel="noopener" target="_blank">
                              <div style={{
                              "alignItems": "center",
                              "boxSizing": "content-box",
                              "color": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))",
                              "columnGap": "4px",
                              "display": "flex",
                              "fontSize": "11px",
                              "height": "16px",
                              "justifyContent": "center",
                              "paddingLeft": "4px",
                              "paddingRight": "4px",
                              "rowGap": "4px",
                              "border": "1px solid var(--ad-border, rgba(0, 0, 0, 0.1))",
                              "borderRadius": "5px"
                            }}>
                                AI
                              </div>
                            </a>
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
    </div>
  </div>);
}
