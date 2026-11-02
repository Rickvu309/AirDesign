import type { AirDesignProps } from "../types.ts";

export function CreateFileButtons({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return <div style={{
    "columnGap": "8px",
    "display": "flex",
    "flexShrink": "0",
    "rowGap": "8px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    width: 466,
    ...style
  }} className={className} {...rest}>
          <div style={{
      "display": "contents",
      "minWidth": "0px",
      "minHeight": "0px"
    }}>
            <div style={{
        "display": "contents"
      }}>
              <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
          "boxShadow": "var(--ad-divider, rgb(230, 230, 230)) 0px 0px 0px 1px inset",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
          "padding": "0px"
        }} aria-label="New Design file" type="button">
                <div style={{
            "display": "grid",
            "gridTemplateColumns": "92.4375px",
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
                  "backgroundColor": "var(--ad-selection, rgb(13, 153, 255))",
                  "borderRadius": "2px"
                }}>
                        <svg style={{
                    "display": "block",
                    "height": "16px",
                    "overflowX": "hidden",
                    "overflowY": "hidden",
                    "width": "16px"
                  }} width="16" height="16" fill="none" viewBox="0 0 64 64"><path d="M13 57l19-50 19 50" fill="none" stroke="var(--ad-ink, #1A1A1A)" strokeWidth={3.063} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /><path d="M6 44l52-14" fill="none" stroke="var(--ad-pink, #FF58AE)" strokeWidth={2.188} strokeLinecap="round" vectorEffect="non-scaling-stroke" /></svg>
                      </div>
                      <span style={{
                  "alignItems": "center",
                  "columnGap": "4px",
                  "display": "flex",
                  "rowGap": "4px"
                }}>
                        <span style={{
                    "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                    "display": "block",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontWeight": "450",
                    "letterSpacing": "0.05504px"
                  }}>
                          Design
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
                "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))"
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
              </button>
            </div>
            <div style={{
        "display": "contents"
      }}>
              <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
          "boxShadow": "var(--ad-divider, rgb(230, 230, 230)) 0px 0px 0px 1px inset",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
          "padding": "0px"
        }} aria-label="New Slides file" type="button">
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
                  "backgroundColor": "var(--ad-brand, rgb(255, 92, 22))",
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
                      "fill": "var(--ad-surface, rgb(255, 255, 255))"
                    }} fillRule="evenodd" d="M4 4h8a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m.434 8H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-.434l.412 1.354a.5.5 0 1 1-.956.292L10.52 12H5.479l-.5 1.646a.5.5 0 1 1-.957-.292zM5 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2m0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2" clipRule="evenodd"></path>
</svg>
                      </div>
                      <span style={{
                  "alignItems": "center",
                  "columnGap": "4px",
                  "display": "flex",
                  "rowGap": "4px"
                }}>
                        <span style={{
                    "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))"
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
              </button>
            </div>
            <div style={{
        "display": "contents"
      }} role="presentation">
              <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
          "boxShadow": "var(--ad-divider, rgb(230, 230, 230)) 0px 0px 0px 1px inset",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
          "padding": "0px"
        }} aria-haspopup="menu" aria-expanded="false" aria-label="More" type="button">
                <div style={{
            "display": "grid",
            "gridTemplateColumns": "75.0391px",
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
                "display": "flex",
                "padding": "8px 16px"
              }}>
                      <span style={{
                  "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                  "display": "block",
                  "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                  "fontWeight": "450",
                  "letterSpacing": "0.05504px"
                }}>
                        More
                      </span>
                      <svg style={{
                  "display": "block",
                  "height": "16px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "16px"
                }} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
                        <path style={{
                    "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                  }} d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
                      </svg>
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
                "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))"
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
              </button>
            </div>
          </div>
        </div>;
}
