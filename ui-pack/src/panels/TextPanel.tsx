import type { AirDesignProps } from "../types.ts";

export function TextPanel({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return (<div style={{
  "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
  "borderRightColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
  "borderRightStyle": "solid",
  "borderRightWidth": "1px",
  "boxSizing": "content-box",
  "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
  "direction": "ltr",
  "display": "flex",
  "flexDirection": "column",
  "fontFamily": "Inter, sans-serif",
  "fontFeatureSettings": "\"calt\", \"liga\"",
  "fontSize": "11px",
  "fontStyle": "normal",
  "fontWeight": "400",
  "letterSpacing": "normal",
  "lineHeight": "16px",
  "overflowWrap": "normal",
  "overflowX": "hidden",
  "overflowY": "auto",
  "scrollbarWidth": "none",
  "textAlign": "start",
  "textTransform": "none",
  "wordBreak": "normal",
  "WebkitFontSmoothing": "antialiased",
  "whiteSpace": "normal",
  position: "relative",
  flexShrink: 0,
  width: 307,
  ...style
}} className={className} {...rest}>
  <div style={{
    "borderBottomColor": "var(--ad-divider, rgb(230, 230, 230))",
    "borderBottomStyle": "solid",
    "borderBottomWidth": "1px",
    "boxSizing": "content-box",
    "paddingBottom": "8px",
    "paddingLeft": "16px",
    "paddingRight": "16px"
  }}>
    <div style={{
      "alignItems": "center",
      "boxSizing": "content-box",
      "columnGap": "8px",
      "display": "flex",
      "justifyContent": "space-between",
      "marginTop": "8px",
      "paddingBottom": "4px",
      "paddingTop": "4px",
      "rowGap": "8px"
    }}>
      <div style={{
        "display": "contents",
        "minWidth": "0px",
        "minHeight": "0px"
      }}>
        <div style={{
          "alignItems": "center",
          "columnGap": "4px",
          "display": "flex",
          "flexBasis": "0%",
          "flexGrow": "1",
          "marginLeft": "-4px",
          "marginRight": "-4px",
          "rowGap": "4px"
        }}>
          <div style={{
            "alignItems": "center",
            "display": "flex",
            "minWidth": "0px"
          }}>
            <span style={{
              "boxSizing": "content-box",
              "display": "flex",
              "paddingLeft": "4px",
              "paddingRight": "4px",
              "position": "relative",
              "minWidth": "0px",
              "border": "1px solid rgba(0, 0, 0, 0)"
            }}>
              <button style={{
                "alignItems": "center",
                "appearance": "auto",
                "backgroundColor": "rgba(0, 0, 0, 0)",
                "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                "display": "block",
                "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                "fontSize": "13px",
                "fontWeight": "550",
                "justifyItems": "center",
                "letterSpacing": "-0.032px",
                "lineHeight": "22px",
                "overflowX": "hidden",
                "overflowY": "hidden",
                "textAlign": "start",
                "textOverflow": "ellipsis",
                "verticalAlign": "top",
                "whiteSpace": "nowrap",
                "padding": "0px"
              }} aria-label="Untitled, file name" type="button">
                <span style={{
                  "whiteSpace": "nowrap"
                }}>Untitled</span>
              </button>
              <label style={{
                "clip": "rect(0px, 0px, 0px, 0px)",
                "clipPath": "inset(50%)",
                "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                "display": "block",
                "fontFamily": "Inter, sans-serif",
                "fontSize": "11px",
                "fontWeight": "400",
                "height": "1px",
                "lineHeight": "16px",
                "overflowX": "hidden",
                "overflowY": "hidden",
                "position": "absolute",
                "width": "1px",
                "minWidth": "0px",
                "minHeight": "0px",
                "whiteSpace": "nowrap"
              }}>
                <span style={{
                  "whiteSpace": "nowrap"
                }}>File name</span>
              </label>
            </span>
          </div>
          <div>
            <div style={{
              "borderBottomRightRadius": "5px",
              "borderLeftColor": "rgba(0, 0, 0, 0)",
              "borderLeftStyle": "solid",
              "borderLeftWidth": "1px",
              "borderTopRightRadius": "5px",
              "boxSizing": "content-box",
              "marginLeft": "-4px"
            }}>
              <div style={{
                "display": "contents"
              }} role="presentation">
                <span>
                  <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgba(0, 0, 0, 0)",
                    "borderBottomRightRadius": "5px",
                    "borderTopRightRadius": "5px",
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
                    "padding": "0px"
                  }} aria-haspopup="menu" aria-expanded="false" aria-label="Edit file menu" type="button">
  <span style={{
                      "alignItems": "center",
                      "borderBottomRightRadius": "5px",
                      "borderTopRightRadius": "5px",
                      "display": "flex",
                      "height": "24px",
                      "justifyContent": "center",
                      "minWidth": "24px",
                      "width": "24px"
                    }} aria-hidden="true">
    <svg style={{
                        "display": "block",
                        "height": "16px",
                        "overflowX": "hidden",
                        "overflowY": "hidden",
                        "width": "16px"
                      }} width="16" height="16" fill="none" viewBox="0 0 16 16">
      <path style={{
                          "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                        }} d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
    </svg>
  </span>
</button>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
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
      }} aria-label="Slide view" type="button">
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
            }} d="M19.5 19a.5.5 0 0 1 0 1h-15a.5.5 0 0 1 0-1zM19 8a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM5 15h14V9H5zM19.5 4a.5.5 0 0 1 0 1h-15a.5.5 0 0 1 0-1z"></path>
          </svg>
        </span>
      </button>
    </div>
    <div style={{
      "alignItems": "center",
      "columnGap": "4px",
      "display": "flex",
      "flexBasis": "0%",
      "flexGrow": "1",
      "marginLeft": "-4px",
      "marginRight": "-4px",
      "rowGap": "4px"
    }}>
      <span style={{
        "alignItems": "center",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden"
      }}>
        <a style={{
          "boxSizing": "content-box",
          "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
          "display": "block",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontSize": "11px",
          "fontWeight": "450",
          "letterSpacing": "0.05504px",
          "lineHeight": "16px",
          "outlineColor": "rgba(0, 0, 0, 0)",
          "outlineStyle": "solid",
          "outlineWidth": "2px",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "paddingLeft": "4px",
          "paddingRight": "4px",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap",
          "borderRadius": "5px"
        }} aria-label="Drafts" href="#" rel="noopener" target="_blank">
          <span style={{
            "whiteSpace": "nowrap"
          }}>Drafts</span>
        </a>
      </span>
    </div>
  </div>
  <div style={{
    "alignItems": "center",
    "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
    "boxSizing": "content-box",
    "display": "flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "13px",
    "fontWeight": "550",
    "justifyContent": "space-between",
    "letterSpacing": "-0.032px",
    "lineHeight": "22px",
    "position": "relative",
    "zIndex": "100",
    "padding": "12px 12px 12px 8px"
  }}>
    <div style={{
      "alignItems": "center",
      "columnGap": "4px",
      "display": "flex",
      "minHeight": "24px",
      "rowGap": "4px",
      "minWidth": "0px"
    }}>
      <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "display": "grid",
        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
        "fontSize": "13px",
        "fontWeight": "550",
        "gridTemplateColumns": "24px",
        "gridTemplateRows": "24px",
        "height": "24px",
        "justifyItems": "center",
        "lineHeight": "22px",
        "minWidth": "24px",
        "outlineColor": "rgba(0, 0, 0, 0)",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "textAlign": "start",
        "width": "24px",
        "borderRadius": "5px",
        "padding": "0px"
      }} aria-label="Back" type="button">
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
            }} fillRule="evenodd" d="M13.854 7.146a.5.5 0 0 1 0 .708L9.707 12l4.147 4.146a.5.5 0 0 1-.708.708l-4.5-4.5a.5.5 0 0 1 0-.708l4.5-4.5a.5.5 0 0 1 .708 0" clipRule="evenodd"></path>
          </svg>
        </span>
      </button>
      <div style={{
        "display": "flex",
        "flexDirection": "column",
        "minWidth": "0px"
      }}>
        <h2 style={{
          "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontSize": "13px",
          "fontWeight": "550",
          "lineHeight": "22px",
          "marginBottom": "0px",
          "marginTop": "0px",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "minWidth": "0px",
          "whiteSpace": "nowrap"
        }}>
          <span style={{
            "whiteSpace": "nowrap"
          }}>Text</span>
        </h2>
      </div>
    </div>
    <div style={{
      "alignItems": "center",
      "columnGap": "4px",
      "display": "flex",
      "flexShrink": "0",
      "marginLeft": "8px",
      "rowGap": "4px",
      "minWidth": "0px"
    }}></div>
  </div>
  <div style={{
    "alignItems": "center",
    "borderBottomColor": "var(--ad-divider, rgb(230, 230, 230))",
    "borderBottomStyle": "solid",
    "borderBottomWidth": "1px",
    "boxSizing": "content-box",
    "columnGap": "4px",
    "display": "flex",
    "rowGap": "4px",
    "minWidth": "0px"
  }}>
    <div style={{
      "boxSizing": "content-box",
      "display": "flex",
      "width": "274px",
      "padding": "4px 16px 16px 16px"
    }}>
      <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
        "display": "flex",
        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
        "fontSize": "11px",
        "fontWeight": "450",
        "height": "24px",
        "justifyItems": "center",
        "letterSpacing": "0.05504px",
        "lineHeight": "16px",
        "maxWidth": "100%",
        "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "position": "relative",
        "textAlign": "center",
        "width": "274px",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
        <span style={{
          "display": "flex",
          "height": "24px",
          "maxWidth": "100%",
          "width": "274px"
        }}>
          <span style={{
            "alignItems": "center",
            "boxSizing": "border-box",
            "display": "flex",
            "justifyContent": "center",
            "maxWidth": "100%",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "paddingLeft": "8px",
            "paddingRight": "8px",
            "width": "274px"
          }}>
            <span style={{
              "display": "block",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "textOverflow": "ellipsis",
              "whiteSpace": "nowrap"
            }}>
              <span style={{
                "alignItems": "center",
                "display": "flex",
                "justifyContent": "center"
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
                  }} fillRule="evenodd" d="M6 6.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5V9a.5.5 0 0 1-1 0V7h-4.5v10h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2V7H7v2a.5.5 0 0 1-1 0z" clipRule="evenodd"></path>
                </svg>
                <span style={{
                  "whiteSpace": "nowrap"
                }}>Add text box</span>
              </span>
            </span>
          </span>
        </span>
      </button>
    </div>
  </div>
  <div style={{
    "display": "flex",
    "flexDirection": "column",
    "minHeight": "0px"
  }}>
    <div style={{
      "position": "relative",
      "minWidth": "0px",
      "minHeight": "0px"
    }} role="none">
      <div style={{
        "height": "473px",
        "overflowX": "hidden",
        "overflowY": "auto",
        "position": "relative",
        "scrollbarWidth": "none",
        "width": "306px"
      }} role="none">
        <div role="none">
          <div style={{
            "boxSizing": "content-box",
            "paddingLeft": "16px",
            "paddingRight": "16px"
          }}>
            <div>
              <div style={{
                "alignItems": "center",
                "display": "inline-flex",
                "flexShrink": "0",
                "height": "40px",
                "justifyItems": "center",
                "width": "274px"
              }}>
                <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                  "display": "flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "height": "40px",
                  "justifyItems": "center",
                  "lineHeight": "16px",
                  "textAlign": "start",
                  "width": "274px",
                  "padding": "0px"
                }} aria-expanded="true" type="button">
                  <span style={{
                    "alignItems": "center",
                    "display": "flex",
                    "flexShrink": "0",
                    "justifyItems": "center"
                  }}>
  <svg style={{
                      "display": "block",
                      "height": "16px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "16px"
                    }} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
    <path style={{
                        "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                      }} d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
  </svg>
</span>
                  <span style={{
                    "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                    "display": "block",
                    "flexBasis": "0%",
                    "flexGrow": "1",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontWeight": "550",
                    "letterSpacing": "0.05504px",
                    "minWidth": "0px"
                  }}>
  Text
</span>
                </button>
              </div>
              <div>
                <div style={{
                  "boxSizing": "border-box",
                  "columnGap": "8px",
                  "display": "flex",
                  "flexDirection": "column",
                  "paddingTop": "8px",
                  "rowGap": "8px",
                  "width": "274px"
                }}>
                  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
                    "boxSizing": "content-box",
                    "display": "flex",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "boxSizing": "border-box",
                      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "46px",
                      "justifyItems": "center",
                      "lineHeight": "16px",
                      "textAlign": "start",
                      "width": "272px",
                      "borderRadius": "5px",
                      "padding": "12px"
                    }} aria-label="" type="button">
    <span style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 32,
                        fontWeight: 550,
                        color: "var(--ad-ink, #222222)"
                      }}>Title</span>
  </button>
</div>
                  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
                    "boxSizing": "content-box",
                    "display": "flex",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "boxSizing": "border-box",
                      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "41px",
                      "justifyItems": "center",
                      "lineHeight": "16px",
                      "textAlign": "start",
                      "width": "272px",
                      "borderRadius": "5px",
                      "padding": "12px"
                    }} aria-label="" type="button">
    <span style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 24,
                        fontWeight: 550,
                        color: "var(--ad-ink, #222222)"
                      }}>Header 1</span>
  </button>
</div>
                  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
                    "boxSizing": "content-box",
                    "display": "flex",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "boxSizing": "border-box",
                      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "40px",
                      "justifyItems": "center",
                      "lineHeight": "16px",
                      "textAlign": "start",
                      "width": "272px",
                      "borderRadius": "5px",
                      "padding": "12px"
                    }} aria-label="" type="button">
    <span style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 20,
                        fontWeight: 550,
                        color: "var(--ad-ink, #222222)"
                      }}>Header 2</span>
  </button>
</div>
                  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
                    "boxSizing": "content-box",
                    "display": "flex",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "boxSizing": "border-box",
                      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "38px",
                      "justifyItems": "center",
                      "lineHeight": "16px",
                      "textAlign": "start",
                      "width": "272px",
                      "borderRadius": "5px",
                      "padding": "12px"
                    }} aria-label="" type="button">
    <span style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 16,
                        fontWeight: 550,
                        color: "var(--ad-ink, #222222)"
                      }}>Header 3</span>
  </button>
</div>
                  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
                    "boxSizing": "content-box",
                    "display": "flex",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "boxSizing": "border-box",
                      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "38px",
                      "justifyItems": "center",
                      "lineHeight": "16px",
                      "textAlign": "start",
                      "width": "272px",
                      "borderRadius": "5px",
                      "padding": "12px"
                    }} aria-label="" type="button">
    <span style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 14,
                        fontWeight: 400,
                        color: "var(--ad-ink, #222222)"
                      }}>Body 1</span>
  </button>
</div>
                  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
                    "boxSizing": "content-box",
                    "display": "flex",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "boxSizing": "border-box",
                      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "37px",
                      "justifyItems": "center",
                      "lineHeight": "16px",
                      "textAlign": "start",
                      "width": "272px",
                      "borderRadius": "5px",
                      "padding": "12px"
                    }} aria-label="" type="button">
    <span style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 12,
                        fontWeight: 400,
                        color: "var(--ad-ink, #222222)"
                      }}>Body 2</span>
  </button>
</div>
                  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
                    "boxSizing": "content-box",
                    "display": "flex",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "boxSizing": "border-box",
                      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "37px",
                      "justifyItems": "center",
                      "lineHeight": "16px",
                      "textAlign": "start",
                      "width": "272px",
                      "borderRadius": "5px",
                      "padding": "12px"
                    }} aria-label="" type="button">
    <span style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 11,
                        fontWeight: 400,
                        color: "var(--ad-ink, #222222)"
                      }}>Body 3</span>
  </button>
</div>
                  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
                    "boxSizing": "content-box",
                    "display": "flex",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "boxSizing": "border-box",
                      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "36px",
                      "justifyItems": "center",
                      "lineHeight": "16px",
                      "textAlign": "start",
                      "width": "272px",
                      "borderRadius": "5px",
                      "padding": "12px"
                    }} aria-label="" type="button">
    <span style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 11,
                        fontWeight: 400,
                        color: "var(--ad-ink, #222222)"
                      }}>Note</span>
  </button>
</div>
                </div>
              </div>
            </div>
            <div>
              <div style={{
                "alignItems": "center",
                "display": "inline-flex",
                "flexShrink": "0",
                "height": "40px",
                "justifyItems": "center",
                "width": "274px"
              }}>
                <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                  "display": "flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "height": "40px",
                  "justifyItems": "center",
                  "lineHeight": "16px",
                  "textAlign": "start",
                  "width": "274px",
                  "padding": "0px"
                }} aria-expanded="false" type="button">
                  <span style={{
                    "alignItems": "center",
                    "display": "flex",
                    "flexShrink": "0",
                    "justifyItems": "center"
                  }}>
  <svg style={{
                      "display": "block",
                      "height": "16px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "16px"
                    }} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
    <path style={{
                        "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                      }} d="M6.768 5.525a.5.5 0 0 1 .707 0l2.121 2.121a.5.5 0 0 1 0 .707l-2.121 2.122a.5.5 0 0 1-.707-.708L8.535 8 6.768 6.232a.5.5 0 0 1 0-.707"></path>
  </svg>
</span>
                  <span style={{
                    "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
                    "display": "block",
                    "flexBasis": "0%",
                    "flexGrow": "1",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontWeight": "550",
                    "letterSpacing": "0.05504px",
                    "minWidth": "0px"
                  }}>
  Font combinations
</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>);
}
