import type { AirDesignProps } from "../types.js";

export function PresentationFileCard({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return <div role="listitem" style={{
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 366,
    ...style
  }} className={className} {...rest}>
  <div>
    <div style={{
        "isolation": "isolate",
        "position": "relative"
      }} role="group" aria-label="Untitled">
      <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "bottom": "0px",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
          "display": "flex",
          "fontFamily": "Inter, sans-serif",
          "fontSize": "11px",
          "fontWeight": "400",
          "justifyItems": "center",
          "left": "0px",
          "lineHeight": "16px",
          "position": "absolute",
          "right": "0px",
          "textAlign": "start",
          "top": "0px",
          "zIndex": "-1",
          "padding": "0px"
        }} aria-label="Untitled, Slides file" type="button"></button>
      <div style={{
          "boxSizing": "content-box",
          "display": "flex",
          "flexDirection": "column",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "border": "1px solid var(--ad-divider, rgb(230, 230, 230))",
          "borderRadius": "13px"
        }}>
        <div style={{
            "position": "relative"
          }}>
          <div style={{
              "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
              "height": "204.555px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "363.664px"
            }}>
            <div style={{
                "alignItems": "center",
                "aspectRatio": "16 / 9",
                "display": "flex",
                "height": "204.555px",
                "justifyContent": "center",
                "overflowX": "hidden",
                "overflowY": "hidden",
                "position": "relative",
                "width": "363.664px"
              }}>
              <img style={{
                  "display": "block",
                  "height": "204.555px",
                  "objectFit": "contain",
                  "overflowX": "clip",
                  "overflowY": "clip",
                  "width": "363.664px"
                }} alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23e6e6e6'/%3E%3C/svg%3E"></img>
            </div>
          </div>
          <div style={{
              "alignItems": "flex-start",
              "boxSizing": "border-box",
              "columnGap": "16px",
              "display": "flex",
              "flexBasis": "0%",
              "flexGrow": "1",
              "justifyContent": "space-between",
              "left": "0px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "position": "absolute",
              "right": "0px",
              "rowGap": "16px",
              "top": "0px",
              "padding": "16px"
            }}>
            <div style={{
                "overflowX": "hidden",
                "overflowY": "hidden",
                "position": "relative",
                "minWidth": "0px"
              }}>
              <div style={{
                  "alignItems": "center",
                  "columnGap": "8px",
                  "display": "flex",
                  "rowGap": "8px"
                }}></div>
            </div>
            <div style={{
                "minWidth": "min-content",
                "position": "relative"
              }}>
              <div style={{
                  "alignItems": "center",
                  "columnGap": "8px",
                  "display": "flex",
                  "rowGap": "8px"
                }}>
                <div style={{
                    "opacity": "0"
                  }}>
                  <div role="presentation">
                    <button style={{
                        "alignItems": "center",
                        "appearance": "auto",
                        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
                        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                        "display": "flex",
                        "fontFamily": "Inter, sans-serif",
                        "fontSize": "11px",
                        "fontWeight": "400",
                        "height": "24px",
                        "justifyContent": "center",
                        "justifyItems": "center",
                        "lineHeight": "16px",
                        "outlineColor": "var(--ad-divider, rgb(230, 230, 230))",
                        "outlineOffset": "-1px",
                        "outlineStyle": "solid",
                        "outlineWidth": "1px",
                        "textAlign": "start",
                        "width": "24px",
                        "borderRadius": "5px",
                        "padding": "0px"
                      }} aria-label="Add to Starred" aria-pressed="false" type="button">
                      <span style={{
                          "display": "block"
                        }} aria-hidden="true">
                        <svg style={{
                            "display": "block",
                            "height": "16px",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "width": "16px"
                          }} width="16" height="16" fill="none" viewBox="0 0 16 16" data-testid="favorite-star-button-unfavorited-icon">
                          <path style={{
                              "fill": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))"
                            }} fillRule="evenodd" d="M8.952 2.695a1 1 0 0 0-1.904 0l-.9 2.805H3.244a1 1 0 0 0-.58 1.815l2.33 1.655-.938 2.701a1 1 0 0 0 1.516 1.148L8 11.13l2.428 1.691a1 1 0 0 0 1.516-1.148l-.937-2.701 2.328-1.656a1 1 0 0 0-.58-1.815H9.852zM4.97 6.5h1.907l.598-1.863L8 3l.525 1.637.597 1.863h3.633l-1.406 1-1.533 1.09.626 1.802L11 12l-1.396-.973L8 9.91l-1.604 1.117L5 12l.558-1.608.625-1.802L4.651 7.5l-1.407-1z" clipRule="evenodd"></path>
                        </svg>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={{
            "alignItems": "center",
            "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
            "borderTopColor": "var(--ad-divider, rgb(230, 230, 230))",
            "borderTopStyle": "solid",
            "borderTopWidth": "1px",
            "boxSizing": "content-box",
            "columnGap": "12px",
            "display": "flex",
            "rowGap": "12px",
            "padding": "12px 16px"
          }}>
          <div style={{
              "position": "relative"
            }}>
            <div style={{
                "display": "contents"
              }}>
              <svg style={{
                  "display": "block",
                  "height": "16px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "16px"
                }} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-label="Slides file" aria-hidden="true">
                <path style={{
                    "fill": "var(--ad-brand, rgb(255, 92, 22))"
                  }} d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2z"></path>
                <path style={{
                    "fill": "var(--ad-surface, rgb(255, 255, 255))"
                  }} d="M12 3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-.434l.412 1.354a.5.5 0 0 1-.957.292l-.5-1.646H5.479l-.5 1.646a.5.5 0 0 1-.958-.292L4.434 12H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM4 4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zm1 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2m0-3a1 1 0 1 1 0 2 1 1 0 0 1 0-2"></path>
              </svg>
            </div>
          </div>
          <div style={{
              "columnGap": "2px",
              "display": "flex",
              "flexBasis": "0%",
              "flexDirection": "column",
              "flexGrow": "1",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "rowGap": "2px"
            }}>
            <div style={{
                "alignItems": "center",
                "columnGap": "4px",
                "display": "flex",
                "rowGap": "4px"
              }}>
              <span style={{
                  "display": "block",
                  "minWidth": "0px"
                }} aria-hidden="true">
                <div style={{
                    "position": "relative"
                  }}>
                  <h2 style={{
                      "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                      "fontSize": "11px",
                      "fontWeight": "550",
                      "letterSpacing": "0.05504px",
                      "lineHeight": "16px",
                      "marginBottom": "0px",
                      "marginTop": "0px",
                      "maxWidth": "100%",
                      "overflowWrap": "break-word",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "textOverflow": "ellipsis",
                      "whiteSpace": "nowrap"
                    }}>
                    <span style={{
                        "maxWidth": "100%",
                        "overflowX": "hidden",
                        "overflowY": "hidden",
                        "textOverflow": "ellipsis"
                      }}>
                      <span>
                        <span style={{
                            "whiteSpace": "nowrap"
                          }}>Untitled</span>
                      </span>
                    </span>
                  </h2>
                </div>
              </span>
            </div>
            <div style={{
                "position": "relative"
              }}>
              <div style={{
                  "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
                  "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                  "fontWeight": "450",
                  "letterSpacing": "0.05504px",
                  "maxWidth": "100%",
                  "overflowWrap": "break-word",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "textOverflow": "ellipsis",
                  "whiteSpace": "nowrap"
                }}>
                <div style={{
                    "alignItems": "center",
                    "display": "flex",
                    "width": "267.664px"
                  }}>
                  <span style={{
                      "display": "contents",
                      "minWidth": "0px",
                      "minHeight": "0px"
                    }}>
                    <span style={{
                        "whiteSpace": "nowrap"
                      }}>Edited 22 minutes ago</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div style={{
              "position": "relative"
            }}>
            <div style={{
                "alignItems": "center",
                "display": "flex",
                "height": "24px"
              }}>
              <div style={{
                  "alignItems": "center",
                  "display": "flex"
                }} aria-label="People" role="group">
                <span style={{
                    "display": "flex",
                    "flexShrink": "0",
                    "position": "relative"
                  }}>
                  <span style={{
                      "boxSizing": "content-box",
                      "display": "flex",
                      "padding": "6px",
                      "margin": "-6px"
                    }}>
                    <button style={{
                        "alignItems": "center",
                        "appearance": "auto",
                        "backgroundColor": "rgba(0, 0, 0, 0)",
                        "color": "var(--ad-surface, rgb(255, 255, 255))",
                        "display": "flex",
                        "fontFamily": "Inter, sans-serif",
                        "fontSize": "11px",
                        "fontWeight": "400",
                        "height": "24px",
                        "justifyItems": "center",
                        "lineHeight": "16px",
                        "minWidth": "24px",
                        "position": "relative",
                        "textAlign": "start",
                        "width": "24px",
                        "borderRadius": "9999px",
                        "padding": "0px"
                      }} aria-haspopup="dialog" aria-expanded="false" aria-label="Your Name" type="button">
                      <span style={{
                          "alignItems": "center",
                          "bottom": "0px",
                          "display": "flex",
                          "justifyContent": "center",
                          "left": "0px",
                          "overflowX": "hidden",
                          "overflowY": "hidden",
                          "position": "absolute",
                          "right": "0px",
                          "top": "0px",
                          "minWidth": "0px",
                          "minHeight": "0px",
                          "borderRadius": "9999px"
                        }}>
                        <span style={{
                            "display": "block",
                            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                            "fontSize": "15px",
                            "fontWeight": "450",
                            "lineHeight": "24px",
                            "textAlign": "center"
                          }}>
                          Q
                        </span>
                        <img style={{
                            "bottom": "0px",
                            "display": "block",
                            "height": "24px",
                            "left": "0px",
                            "objectFit": "cover",
                            "overflowX": "clip",
                            "overflowY": "clip",
                            "position": "absolute",
                            "right": "0px",
                            "top": "0px",
                            "width": "24px",
                            "minWidth": "0px",
                            "minHeight": "0px"
                          }} src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23e6e6e6'/%3E%3C/svg%3E" alt=""></img>
                        <span style={{
                            "bottom": "0px",
                            "boxSizing": "border-box",
                            "display": "block",
                            "height": "24px",
                            "left": "0px",
                            "position": "absolute",
                            "right": "0px",
                            "top": "0px",
                            "width": "24px",
                            "minWidth": "0px",
                            "minHeight": "0px",
                            "border": "1px solid var(--ad-border, rgba(0, 0, 0, 0.1))",
                            "borderRadius": "9999px"
                          }}></span>
                      </span>
                      <span style={{
                          "bottom": "-2px",
                          "display": "block",
                          "left": "-2px",
                          "position": "absolute",
                          "right": "-2px",
                          "top": "-2px",
                          "minWidth": "0px",
                          "minHeight": "0px",
                          "borderRadius": "9999px"
                        }}></span>
                    </button>
                    <div style={{
                        "display": "contents",
                        "minWidth": "0px",
                        "minHeight": "0px"
                      }}></div>
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>;
}
