import type { AirDesignProps } from "../types.ts";

export function ShareDialog({
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
    width: 480,
    maxWidth: "none",
    ...style
  }} className={className} {...rest}>
    <div style={{
      "columnGap": "8px",
      "display": "flex",
      "flexDirection": "column",
      "maxHeight": "830.7px",
      "rowGap": "8px"
    }}>
      <div style={{
        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
        "boxShadow": "var(--ad-border-strong, rgba(0, 0, 0, 0.15)) 0px 2px 5px 0px, rgba(0, 0, 0, 0.18) 0px 10px 24px 0px, rgba(0, 0, 0, 0.08) 0px 0px 0.5px 0px",
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
          "boxShadow": "var(--ad-divider, rgb(230, 230, 230)) 0px -1px 0px 0px inset",
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
                "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                    "color": "var(--ad-brand-strong, rgb(226, 76, 12))",
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
                      "fill": "var(--ad-brand-strong, rgb(226, 76, 12))"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <path d="M12.444 10.37a2.998 2.998 0 0 1 .677 4.75l-2 2a3 3 0 1 1-4.243-4.242l1.27-1.27c.262-.263.746-.069.826.293a.44.44 0 0 1-.111.405l-1.278 1.279a2 2 0 1 0 2.829 2.828l2-2a2 2 0 0 0 0-2.828l-.029-.028c-.093-.089-.187-.184-.224-.307a.88.88 0 0 1 .22-.87.05.05 0 0 1 .063-.01m.434-3.492a3 3 0 1 1 4.243 4.242l-1.27 1.27c-.262.262-.745.068-.826-.294a.44.44 0 0 1 .111-.405l1.278-1.278a2 2 0 1 0-2.829-2.828l-2 2a2 2 0 0 0 0 2.828l.029.026c.093.089.186.183.223.306a.88.88 0 0 1-.218.874.05.05 0 0 1-.062.009 3 3 0 0 1-.679-4.75z"></path>
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
                      "fill": "var(--ad-brand-strong, rgb(226, 76, 12))"
                    }} width="16" height="16" fill="none" viewBox="0 0 16 16">
                      <path d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
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
                          "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
                          "boxSizing": "content-box",
                          "display": "flex",
                          "justifyContent": "space-between",
                          "border": "1px solid var(--ad-surface-subtle, rgb(245, 245, 245))",
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
                              "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
                              "boxSizing": "content-box",
                              "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                        "backgroundColor": "var(--ad-divider-strong, rgb(217, 217, 217))",
                        "boxSizing": "border-box",
                        "color": "var(--ad-surface, rgb(255, 255, 255))",
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
                      "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
                      "display": "flex",
                      "height": "28px",
                      "marginTop": "4px",
                      "paddingBottom": "6px",
                      "paddingTop": "6px"
                    }}>
                      <h2 style={{
                        "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
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
                      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                            "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                          }} fillRule="evenodd" d="M12.465 17.738c-.233.23-.389.262-.465.262s-.232-.032-.465-.262c-.238-.234-.498-.623-.737-1.182-.434-1.013-.738-2.433-.79-4.056h3.984c-.052 1.623-.356 3.044-.79 4.056-.24.56-.5.948-.737 1.182m1.527-6.238h-3.984c.052-1.623.356-3.044.79-4.056.24-.56.5-.948.737-1.182.233-.23.389-.262.465-.262s.232.032.465.262c.238.234.498.623.737 1.182.434 1.012.738 2.433.79 4.056m1 1c-.065 2.176-.558 4.078-1.282 5.253a6.005 6.005 0 0 0 4.27-5.253zm2.988-1a6.005 6.005 0 0 0-4.27-5.253c.724 1.175 1.217 3.077 1.282 5.253zm-8.972 0c.065-2.176.558-4.078 1.282-5.253A6.005 6.005 0 0 0 6.02 11.5zm-2.987 1a6.005 6.005 0 0 0 4.27 5.253c-.725-1.175-1.218-3.077-1.283-5.253zM19 12a7 7 0 1 0-14 0 7 7 0 0 0 14 0" clipRule="evenodd"></path>
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
                          "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                                "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                              }} d="M10.647 9.147a.5.5 0 0 1 .707 0l2.5 2.5a.5.5 0 0 1 0 .707l-2.5 2.5a.5.5 0 0 1-.707-.707L12.793 12l-2.146-2.146a.5.5 0 0 1 0-.707"></path>
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
                          "color": "var(--ad-surface, rgb(255, 255, 255))",
                          "display": "block",
                          "flexBasis": "24px",
                          "flexShrink": "0",
                          "height": "24px",
                          "overflowX": "clip",
                          "overflowY": "clip",
                          "width": "24px",
                          "borderRadius": "100%"
                        }} alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23e6e6e6'/%3E%3C/svg%3E"></img>
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
                              "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                              }}>Your Name</span>
        </b>
         
        <span style={{
                              "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
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
        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
        "boxShadow": "var(--ad-border-strong, rgba(0, 0, 0, 0.15)) 0px 2px 5px 0px, rgba(0, 0, 0, 0.18) 0px 10px 24px 0px, rgba(0, 0, 0, 0.08) 0px 0px 0.5px 0px",
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
                      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                          "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                        }} fillRule="evenodd" d="M7 7h10a1 1 0 0 1 1 1v2H6V8a1 1 0 0 1 1-1m-1 4v5a1 1 0 0 0 1 1h2v-6zm4 6h7a1 1 0 0 0 1-1v-5h-8zM5 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
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
                          "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                        }} d="M10.647 9.147a.5.5 0 0 1 .707 0l2.5 2.5a.5.5 0 0 1 0 .707l-2.5 2.5a.5.5 0 0 1-.707-.707L12.793 12l-2.146-2.146a.5.5 0 0 1 0-.707"></path>
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
                      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                          "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                        }} fillRule="evenodd" d="M6 5.903C6 4.43 7.604 3.517 8.87 4.269l10.15 6.028c1.307.776 1.305 2.669-.003 3.442l-10.15 5.995c-1.228.724-2.768-.11-2.863-1.5L6 18.098zm1 12.195a.9.9 0 0 0 1.357.774l10.152-5.995a1 1 0 0 0 .002-1.72L8.359 5.129A.9.9 0 0 0 7 5.903z" clipRule="evenodd"></path>
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
                      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                          "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                        }} fillRule="evenodd" d="M16.5 7h-9a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5m-9-1A1.5 1.5 0 0 0 6 7.5v9A1.5 1.5 0 0 0 7.5 18h9a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 16.5 6zm3.354 4.146a.5.5 0 0 1 0 .708L9.707 12l1.147 1.146a.5.5 0 0 1-.708.708l-1.5-1.5a.5.5 0 0 1 0-.708l1.5-1.5a.5.5 0 0 1 .708 0m2.292.708a.5.5 0 0 1 .708-.708l1.5 1.5a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708-.708L14.293 12z" clipRule="evenodd"></path>
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
                          "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                        }} d="M10.647 9.147a.5.5 0 0 1 .707 0l2.5 2.5a.5.5 0 0 1 0 .707l-2.5 2.5a.5.5 0 0 1-.707-.707L12.793 12l-2.146-2.146a.5.5 0 0 1 0-.707"></path>
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
                      "backgroundColor": "var(--ad-brand-subtle, rgb(255, 223, 204))",
                      "bottom": "0px",
                      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                          "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                        }} d="M11.725 11.082a.5.5 0 0 1 .629.064l2.5 2.5a.5.5 0 0 1-.707.707L12.5 12.708V18.5a.5.5 0 0 1-1 0v-5.793l-1.646 1.646a.5.5 0 1 1-.707-.707l2.5-2.5zM10.379 6a2 2 0 0 1 1.414.586l1.411 1.411.007.003h3.29a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-2a.5.5 0 1 1 0-1h2a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-3.704l-.007-.003-1.704-1.704A1 1 0 0 0 10.379 7H7.5a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1h2a.5.5 0 0 1 0 1h-2a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"></path>
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
                        "backgroundColor": "var(--ad-brand-subtle, rgb(255, 223, 204))",
                        "color": "var(--ad-brand-strong, rgb(226, 76, 12))",
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
  </section>;
}
