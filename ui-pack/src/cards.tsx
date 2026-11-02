import type { CSSProperties } from "react";
export interface AirDesignComponentProps {
  style?: CSSProperties;
  className?: string;
}
export function PresentationFileCard({
  style,
  className
}: AirDesignComponentProps) {
  return <div role="listitem" style={{
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 366,
    ...style
  }} className={className}>
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
          "color": "rgb(0, 0, 0)",
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
          "border": "1px solid rgb(230, 230, 230)",
          "borderRadius": "13px"
        }}>
        <div style={{
            "position": "relative"
          }}>
          <div style={{
              "backgroundColor": "rgb(245, 245, 245)",
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
                }} alt="" src="https://s3-alpha.figma.com/thumbnails/41596dfb-8a47-449d-949f-efbe9cc62906?X-Amz-Algorithm=AWS4-HMAC-SHA256&amp;X-Amz-Credential=AKIAQ4GOSFWCTQAAMWLW%2F20261101%2Fus-west-2%2Fs3%2Faws4_request&amp;X-Amz-Date=20261101T120000Z&amp;X-Amz-Expires=604800&amp;X-Amz-SignedHeaders=host&amp;X-Amz-Signature=3a9572f31452f0d1732629f4380ec3d297745732e6b3e2d9935c97120e330511"></img>
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
                        "backgroundColor": "rgb(255, 255, 255)",
                        "color": "rgb(0, 0, 0)",
                        "display": "flex",
                        "fontFamily": "Inter, sans-serif",
                        "fontSize": "11px",
                        "fontWeight": "400",
                        "height": "24px",
                        "justifyContent": "center",
                        "justifyItems": "center",
                        "lineHeight": "16px",
                        "outlineColor": "rgb(230, 230, 230)",
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
                              "fill": "rgba(0, 0, 0, 0.5)"
                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M8.952 2.695a1 1 0 0 0-1.904 0l-.9 2.805H3.244a1 1 0 0 0-.58 1.815l2.33 1.655-.938 2.701a1 1 0 0 0 1.516 1.148L8 11.13l2.428 1.691a1 1 0 0 0 1.516-1.148l-.937-2.701 2.328-1.656a1 1 0 0 0-.58-1.815H9.852zM4.97 6.5h1.907l.598-1.863L8 3l.525 1.637.597 1.863h3.633l-1.406 1-1.533 1.09.626 1.802L11 12l-1.396-.973L8 9.91l-1.604 1.117L5 12l.558-1.608.625-1.802L4.651 7.5l-1.407-1z" clipRule="evenodd"></path>
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
            "backgroundColor": "rgb(255, 255, 255)",
            "borderTopColor": "rgb(230, 230, 230)",
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
                    "fill": "rgb(255, 92, 22)"
                  }} fill="var(--color-bg-brand)" d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2z"></path>
                <path style={{
                    "fill": "rgb(255, 255, 255)"
                  }} fill="var(--color-icon-onbrand)" d="M12 3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-.434l.412 1.354a.5.5 0 0 1-.957.292l-.5-1.646H5.479l-.5 1.646a.5.5 0 0 1-.958-.292L4.434 12H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM4 4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zm1 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2m0-3a1 1 0 1 1 0 2 1 1 0 0 1 0-2"></path>
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
                      "color": "rgba(0, 0, 0, 0.898)",
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
                  "color": "rgba(0, 0, 0, 0.5)",
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
                        "color": "rgb(255, 255, 255)",
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
                      }} aria-haspopup="dialog" aria-expanded="false" aria-label="Quan Vu (Richard)" type="button">
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
                          }} src="https://s3-alpha.figma.com/profile/2352a4b9-1db3-49d6-bb4d-651586207271" alt=""></img>
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
                            "border": "1px solid rgba(0, 0, 0, 0.1)",
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
export function EmptyPresentationFileCard({
  style,
  className
}: AirDesignComponentProps) {
  return <div role="listitem" style={{
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 366,
    ...style
  }} className={className}>
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
          "color": "rgb(0, 0, 0)",
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
          "border": "1px solid rgb(230, 230, 230)",
          "borderRadius": "13px"
        }}>
        <div style={{
            "position": "relative"
          }}>
          <div style={{
              "backgroundColor": "rgb(245, 245, 245)",
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
                }} alt="" src="https://s3-alpha.figma.com/thumbnails/0aae0ac5-15fa-427a-b54c-5266783c8d7d?X-Amz-Algorithm=AWS4-HMAC-SHA256&amp;X-Amz-Credential=AKIAQ4GOSFWCTQAAMWLW%2F20261101%2Fus-west-2%2Fs3%2Faws4_request&amp;X-Amz-Date=20261101T120000Z&amp;X-Amz-Expires=604800&amp;X-Amz-SignedHeaders=host&amp;X-Amz-Signature=1ab67327ccd6eb77c3c9c0d94a28320974b8d1f0b6084b196881cc18db09e95a"></img>
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
                        "backgroundColor": "rgb(255, 255, 255)",
                        "color": "rgb(0, 0, 0)",
                        "display": "flex",
                        "fontFamily": "Inter, sans-serif",
                        "fontSize": "11px",
                        "fontWeight": "400",
                        "height": "24px",
                        "justifyContent": "center",
                        "justifyItems": "center",
                        "lineHeight": "16px",
                        "outlineColor": "rgb(230, 230, 230)",
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
                              "fill": "rgba(0, 0, 0, 0.5)"
                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M8.952 2.695a1 1 0 0 0-1.904 0l-.9 2.805H3.244a1 1 0 0 0-.58 1.815l2.33 1.655-.938 2.701a1 1 0 0 0 1.516 1.148L8 11.13l2.428 1.691a1 1 0 0 0 1.516-1.148l-.937-2.701 2.328-1.656a1 1 0 0 0-.58-1.815H9.852zM4.97 6.5h1.907l.598-1.863L8 3l.525 1.637.597 1.863h3.633l-1.406 1-1.533 1.09.626 1.802L11 12l-1.396-.973L8 9.91l-1.604 1.117L5 12l.558-1.608.625-1.802L4.651 7.5l-1.407-1z" clipRule="evenodd"></path>
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
            "backgroundColor": "rgb(255, 255, 255)",
            "borderTopColor": "rgb(230, 230, 230)",
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
                    "fill": "rgb(255, 92, 22)"
                  }} fill="var(--color-bg-brand)" d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2z"></path>
                <path style={{
                    "fill": "rgb(255, 255, 255)"
                  }} fill="var(--color-icon-onbrand)" d="M12 3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-.434l.412 1.354a.5.5 0 0 1-.957.292l-.5-1.646H5.479l-.5 1.646a.5.5 0 0 1-.958-.292L4.434 12H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM4 4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zm1 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2m0-3a1 1 0 1 1 0 2 1 1 0 0 1 0-2"></path>
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
                      "color": "rgba(0, 0, 0, 0.898)",
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
                  "color": "rgba(0, 0, 0, 0.5)",
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
                    "width": "291.664px"
                  }}>
                  <span style={{
                      "display": "contents",
                      "minWidth": "0px",
                      "minHeight": "0px"
                    }}>
                    <span style={{
                        "whiteSpace": "nowrap"
                      }}>Edited 6 months ago</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div style={{
              "position": "relative"
            }}></div>
        </div>
      </div>
    </div>
  </div>
</div>;
}
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
export function CreatePresentationOptions({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "boxSizing": "border-box",
    "columnGap": "24px",
    "display": "flex",
    "justifyContent": "center",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "rowGap": "24px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    flexShrink: 0,
    width: 644,
    ...style
  }} className={className}>
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
                    </div>;
}
export function StartFromScratchCard({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "aspectRatio": "1.25 / 1",
    "backgroundColor": "rgb(255, 255, 255)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
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
    "textAlign": "start",
    "border": "1px solid rgb(230, 230, 230)",
    "borderRadius": "13px",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    width: 310,
    ...style
  }} aria-label="Start from scratch" type="button" className={className}>
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
                      </button>;
}
export function UseTemplateCard({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "aspectRatio": "1.25 / 1",
    "backgroundColor": "rgb(255, 255, 255)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
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
    "textAlign": "start",
    "border": "1px solid rgb(230, 230, 230)",
    "borderRadius": "13px",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    width: 310,
    ...style
  }} aria-label="Use a template" type="button" className={className}>
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
                      </button>;
}
export function AgentSuggestions({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "columnGap": "8px",
    "display": "flex",
    "flexDirection": "column",
    "flexShrink": "0",
    "rowGap": "8px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    width: 274,
    ...style
  }} className={className}>
                        <div style={{
      "boxSizing": "border-box",
      "display": "flex",
      "flexDirection": "column",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "274px",
      "border": "1px solid rgb(230, 230, 230)",
      "borderRadius": "13px"
    }} role="group">
                          <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "boxSizing": "border-box",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "lineHeight": "16px",
        "textAlign": "left",
        "width": "272px",
        "borderRadius": "13px",
        "padding": "8px"
      }} type="button" aria-expanded="false">
                            <span style={{
          "alignItems": "center",
          "display": "flex",
          "flexShrink": "0",
          "height": "24px",
          "justifyContent": "center",
          "width": "24px"
        }} aria-hidden="true">
                              <svg style={{
            "display": "block",
            "height": "24px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "24px"
          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
              "fill": "rgba(0, 0, 0, 0.5)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M7.312 6.803a7 7 0 0 1 9.639.248l.28.298a7 7 0 0 1 1.76 4.998l-.029.38C18.807 14.222 17.446 15 16.242 15H13.5l-.101.01a.5.5 0 0 0-.4.49v.5c0 .82-.338 1.603-.92 2.127-.6.542-1.468.8-2.37.488a7 7 0 0 1-2.362-1.385l-.297-.28a7 7 0 0 1 0-9.9zm8.93.955a6 6 0 0 0-8.485 0l-.212.225a6 6 0 0 0 2.492 9.689c.978.337 1.848-.457 1.953-1.467L12 16v-.499a1.5 1.5 0 0 1 1.5-1.5h2.743l.158-.006c.733-.057 1.391-.513 1.543-1.216l.024-.155a6 6 0 0 0-1.484-4.611zM8.5 12.001a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7-2a1 1 0 1 1-.001 2 1 1 0 0 1 0-2m-6-1.5a1 1 0 1 1 0 2.001 1 1 0 0 1 0-2m3.5-1a1 1 0 1 1 0 2 1 1 0 0 1 0-2"></path>
</svg>
                            </span>
                            <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
          "display": "block",
          "flexGrow": "1",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontSize": "13px",
          "fontWeight": "450",
          "letterSpacing": "-0.032px",
          "lineHeight": "22px",
          "marginLeft": "8px"
        }}>
                              Improve the deck
                            </span>
                            <span style={{
          "alignItems": "center",
          "display": "flex",
          "flexShrink": "0",
          "height": "24px",
          "justifyContent": "center",
          "marginLeft": "4px",
          "width": "24px"
        }} aria-hidden="true">
                              <svg style={{
            "display": "block",
            "height": "24px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "24px"
          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
              "fill": "rgba(0, 0, 0, 0.3)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M15.647 10.147a.5.5 0 1 1 .707.707l-4 4a.5.5 0 0 1-.707 0l-4-4a.5.5 0 1 1 .707-.707L12 13.793z"></path>
</svg>
                            </span>
                          </button>
                        </div>
                        <div style={{
      "boxSizing": "border-box",
      "display": "flex",
      "flexDirection": "column",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "274px",
      "border": "1px solid rgb(230, 230, 230)",
      "borderRadius": "13px"
    }} role="group">
                          <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "boxSizing": "border-box",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "lineHeight": "16px",
        "textAlign": "left",
        "width": "272px",
        "borderRadius": "13px",
        "padding": "8px"
      }} type="button" aria-expanded="false">
                            <span style={{
          "alignItems": "center",
          "display": "flex",
          "flexShrink": "0",
          "height": "24px",
          "justifyContent": "center",
          "width": "24px"
        }} aria-hidden="true">
                              <svg style={{
            "display": "block",
            "height": "24px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "24px"
          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
              "fill": "rgba(0, 0, 0, 0.5)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0m1 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-6.5-2.5a.5.5 0 0 0-1 0v2h-2a.5.5 0 0 0 0 1h2v2a.5.5 0 0 0 1 0v-2h2a.5.5 0 0 0 0-1h-2z" clipRule="evenodd"></path>
</svg>
                            </span>
                            <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
          "display": "block",
          "flexGrow": "1",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontSize": "13px",
          "fontWeight": "450",
          "letterSpacing": "-0.032px",
          "lineHeight": "22px",
          "marginLeft": "8px"
        }}>
  Add to the deck
</span>
                            <span style={{
          "alignItems": "center",
          "display": "flex",
          "flexShrink": "0",
          "height": "24px",
          "justifyContent": "center",
          "marginLeft": "4px",
          "width": "24px"
        }} aria-hidden="true">
  <svg style={{
            "display": "block",
            "height": "24px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "24px"
          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
              "fill": "rgba(0, 0, 0, 0.3)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M15.647 10.147a.5.5 0 1 1 .707.707l-4 4a.5.5 0 0 1-.707 0l-4-4a.5.5 0 1 1 .707-.707L12 13.793z"></path>
  </svg>
</span>
                          </button>
                        </div>
                        <div style={{
      "boxSizing": "border-box",
      "display": "flex",
      "flexDirection": "column",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "274px",
      "border": "1px solid rgb(230, 230, 230)",
      "borderRadius": "13px"
    }} role="group">
                          <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "boxSizing": "border-box",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "lineHeight": "16px",
        "textAlign": "left",
        "width": "272px",
        "borderRadius": "13px",
        "padding": "8px"
      }} type="button" aria-expanded="false">
                            <span style={{
          "alignItems": "center",
          "display": "flex",
          "flexShrink": "0",
          "height": "24px",
          "justifyContent": "center",
          "width": "24px"
        }} aria-hidden="true">
  <svg style={{
            "display": "block",
            "height": "24px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "24px"
          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
              "fill": "rgba(0, 0, 0, 0.5)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.5 7.001a.5.5 0 0 1 0 1H7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-4.5a.5.5 0 1 1 1 0v4.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm-1 6a.5.5 0 1 1 0 1h-5a.5.5 0 0 1 0-1zm2-3a.5.5 0 1 1 0 1h-7a.5.5 0 0 1 0-1zm2.515-4.56c.126-.505.844-.505.97 0l.315 1.26 1.26.315c.505.126.505.844 0 .97l-1.26.315-.315 1.26c-.126.505-.844.505-.97 0L17.7 8.3l-1.26-.315c-.505-.126-.505-.844 0-.97L17.7 6.7z"></path>
  </svg>
</span>
                            <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
          "display": "block",
          "flexGrow": "1",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontSize": "13px",
          "fontWeight": "450",
          "letterSpacing": "-0.032px",
          "lineHeight": "22px",
          "marginLeft": "8px"
        }}>
  Prepare to present
</span>
                            <span style={{
          "alignItems": "center",
          "display": "flex",
          "flexShrink": "0",
          "height": "24px",
          "justifyContent": "center",
          "marginLeft": "4px",
          "width": "24px"
        }} aria-hidden="true">
  <svg style={{
            "display": "block",
            "height": "24px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "24px"
          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
              "fill": "rgba(0, 0, 0, 0.3)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M15.647 10.147a.5.5 0 1 1 .707.707l-4 4a.5.5 0 0 1-.707 0l-4-4a.5.5 0 1 1 .707-.707L12 13.793z"></path>
  </svg>
</span>
                          </button>
                        </div>
                        <div style={{
      "boxSizing": "border-box",
      "display": "flex",
      "flexDirection": "column",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "274px",
      "border": "1px solid rgb(230, 230, 230)",
      "borderRadius": "13px"
    }} role="group">
                          <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "boxSizing": "border-box",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "lineHeight": "16px",
        "textAlign": "left",
        "width": "272px",
        "borderRadius": "13px",
        "padding": "8px"
      }} type="button" aria-expanded="false">
                            <span style={{
          "alignItems": "center",
          "display": "flex",
          "flexShrink": "0",
          "height": "24px",
          "justifyContent": "center",
          "width": "24px"
        }} aria-hidden="true">
  <svg style={{
            "display": "block",
            "height": "24px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "24px"
          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
              "fill": "rgba(0, 0, 0, 0.5)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M6.057 14.763c.184-.35.7-.35.884 0l.034.08.295.886.886.294c.458.153.458.8 0 .953l-.886.294-.295.886a.502.502 0 0 1-.952 0l-.295-.886-.886-.294a.502.502 0 0 1 0-.953l.885-.296.296-.884zM18.5 16a.5.5 0 1 1 0 1h-8a.5.5 0 0 1 0-1zM6.057 9.763c.184-.35.7-.35.884 0l.034.08.295.886.886.294c.458.153.457.8 0 .953l-.886.294-.295.886a.502.502 0 0 1-.952 0l-.295-.886-.886-.294a.502.502 0 0 1 0-.953l.885-.296.296-.884zM18.5 11a.5.5 0 1 1 0 1h-8a.5.5 0 0 1 0-1zM6.058 4.763c.185-.35.7-.35.884 0l.034.08.295.886.886.294c.457.153.457.8 0 .953l-.886.295-.295.885a.502.502 0 0 1-.952 0l-.295-.885-.886-.295a.502.502 0 0 1 0-.953l.885-.295.296-.885zM18.5 6a.5.5 0 0 1 0 1h-8a.5.5 0 0 1 0-1z" clipRule="evenodd"></path>
  </svg>
</span>
                            <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
          "display": "block",
          "flexGrow": "1",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontSize": "13px",
          "fontWeight": "450",
          "letterSpacing": "-0.032px",
          "lineHeight": "22px",
          "marginLeft": "8px"
        }}>
  Understand the deck
</span>
                            <span style={{
          "alignItems": "center",
          "display": "flex",
          "flexShrink": "0",
          "height": "24px",
          "justifyContent": "center",
          "marginLeft": "4px",
          "width": "24px"
        }} aria-hidden="true">
  <svg style={{
            "display": "block",
            "height": "24px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "24px"
          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
              "fill": "rgba(0, 0, 0, 0.3)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M15.647 10.147a.5.5 0 1 1 .707.707l-4 4a.5.5 0 0 1-.707 0l-4-4a.5.5 0 1 1 .707-.707L12 13.793z"></path>
  </svg>
</span>
                          </button>
                        </div>
                      </div>;
}
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
export function SlideThumbnail({
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
    width: 240,
    ...style
  }} className={className}>
          <div style={{
      "alignItems": "center",
      "aspectRatio": "16 / 9",
      "backgroundColor": "rgb(242, 249, 255)",
      "display": "flex",
      "justifyContent": "center",
      "outlineColor": "rgba(0, 0, 0, 0.1)",
      "outlineStyle": "solid",
      "outlineWidth": "1px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "188px",
      "borderRadius": "5px"
    }}>
            <div style={{
        "alignItems": "flex-end",
        "boxSizing": "border-box",
        "columnGap": "4px",
        "display": "flex",
        "flexDirection": "column",
        "height": "105.75px",
        "left": "0px",
        "position": "absolute",
        "rowGap": "4px",
        "top": "0px",
        "width": "188px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "padding": "4px"
      }}></div>
            <img style={{
        "aspectRatio": "16 / 9",
        "display": "block",
        "height": "105.75px",
        "objectFit": "cover",
        "overflowX": "clip",
        "overflowY": "clip",
        "width": "188px"
      }} alt="" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWgAAADKCAYAAACIRtqEAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAOdEVYdFNvZnR3YXJlAEZpZ21hnrGWYwAACLRJREFUeAHt3Ytx2zoWBmB5dwtJJ0kqSTqJU0oqidNJUonXx3NPBovLp23p/pn9vhmN9aAIgB79AkEKvHt8cgEgyt2Tf10AiCSgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUL953JDDw8Plx8/fvzPc1++fFldpl/7+PHj8/P39/d/W3729evX57/v37+/fPjw4fIava7ZXh3e0kvas7Sd11RbavnaxuX79++75bzlNgY2PN7I0wf5sYpbuj0F7+/l6n4/3/pxrWPP0jpfaq2+XZenMHu8tpe0Z9yGe7d5+W5T/a3n6za38y23MbCs8vkmPejqcVUvrXWvq5+rnvFWb6x6ddUjrGVSVN3rdqTHmW7cI+i21Pau/0upv3rKcHs3GYPuD3qpL4YKtb61teGEUuFQIbIUEh2UR81fFkdU/avefRvb00MDrymrltlq/1m1rdbqOz7/15f07/e81dDNS7YxsODxBi7TLvWod6N7d3lriGPcpa7d7su0uz4+N+9+Lw2x7O2iby031nOu19GyloYi5qGTpfeP6z8yzLC0TbdeXxsi2arTmXYD+24W0OMHt+5vfWiPBvRlZ2x1LdDq/vx4zV7I7NVrDqy1Op0Jw/FL6MiY/No23Xr9JQF9tN3AMZXPNxniGHed+2yMu7u759tLdu3H99Swx+Nfu+tLQyDj7vY4tNK7/W+xK97rGuvV5Yz1Gsvscsf67w35jGdb1PvG5d9S/b/GYZEe4llztN3AOTc5SNghVB/k+cNaj+t25mDbGKpjSNX9Cv21ZevA19LpZ1Wvtxh/Hds2llXt6nrMp8CNba77vY75gGh/sfVy1wrnl1hr96jq70AjnHPT86DHA1Hds+3gqscvCegzy16rJ7e03rWy9s4DX/ui+FMOum21W0DDOVcP6LHHOJ5K12HdPd5bBNBaeLzk9L29s07WwqjKGkP6JT3LPuvjlj+YOWKv3cBJj1e2d1Drcln/0cS8zNKZHuMZD0tncWwdIFv6EcZS3eaDXPMZJG08OLZV1toZIEtlzttuLPfoD2XOHiQ8W8e1dvePXYDzKp+v3oMee1R9kGvp4NGZXuTYG6v1jT+o2Ft2HmIpe+Pf4/jx3NMfx4L7Z9NbZdV2Hw/CjXUe1z33OLt+VV4fKDwzLHTWWH7Xa63HvtfuvYOMwIrHG1g6Z/kynZbVjp5mt3Sa2tr5wVvlHznNbu221IPdOn1urbe/Vae9tl/jPOi19nf9j/4/trYTsK3y+eZncZS59zj2zKrntnSmR7/Wqic59kz714bjRD5j+f1z8bHsvcl+tg4qrvUmq5wed98qa9wm3TNfWm6r7UctbdMjr4/1O1KnI+0GjrvrpAYgx90T80EDhBLQAKEENEAoAQ0QSkADhBLQAKEENEAoAQ0QSkADhLp6QPfUmH2bJxx62Ljo69YUpK+5yOrDwQvNnp0C9UidjpZ9rffvrXvr8d57j/5fgWOuHtA9R0apv/MVN7bmEN6aw+HIXMhzYPbjtat+zI4sc7ZOW+094hoT34/bZXSmnDP/V+CYm15Rpc09q3GSo35celL6cYrSfq0m+u/JfPr9PRl+rb8n7xkn65l7eK2W6ak758l95smXev39ZTOb69tljY/HZbquXU4/buNyPa3nWMexrPFiAOP9Lr/XvbbOub31/qW6zo/nbTq3ad4+wDH/SEDPM8+VDpGtK28c+XCPYTj34sZyx/tjr3TuoY5fFuN6OvzWXu+rxdSMbkvt/TDsWcxltf7yGduz1oMeA3Wsz7j3smRc59L757rW82vXQ1xq01j2a4al4P9RzEHCvgRWT0a/9NqRD3iHx9nxzwq4KmPpYq3juroutdzDcD3F1xp7n2Odxl7wkq7PfBmtPeP1Ic/ovY2yNoXp0p7KuIcAHPPv+/srXUl1wbt3737/ne///Pnz8u3bt+fQ6Nf69Xq+AqjCoV/rK4T32Gfv9ncQfP78+flvrXdcX62r19PP17Jdxvh8qed+/fr1uyfbPe56T916aKWWGetXf6sHPZc13x+fqzrU3+4h9+v1/KdPn/72vn6t29/16frOZcxl1XJdVm+nedvP7+/l6/3zHkqtr+oy1rX+R+M2mssAlj19br7+kfNB98Tw//R4ZtejvLYua2PQiZaOF6zpbfQntAuS1HzQJuwHCGTCfoBgAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJ6AtAJgENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4T6L8RAeLiOZHZCAAAAAElFTkSuQmCC"></img>
          </div>
        </div>;
}
export function MediaImageGrid({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "columnGap": "8px",
    "display": "flex",
    "flexDirection": "column",
    "rowGap": "8px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 274,
    height: 480,
    overflowY: "auto",
    ...style
  }} className={className}>
              <div style={{
      "aspectRatio": "0.666667 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "rgba(0, 0, 0, 0.1)",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
                  <img style={{
          "display": "block",
          "height": "199.5px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A woman in a white patterned dress standing against a stone wall covered in ivy" src="https://images.unsplash.com/photo-1793291275774-23ae799f2ac8?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyfHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "rgb(255, 255, 255)",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
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
        }} aria-label="More details for A woman in a white patterned dress standing against a stone wall covered in ivy" type="button">
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
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
                </div>
              </div>
              <div style={{
      "aspectRatio": "0.665344 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "rgba(0, 0, 0, 0.1)",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
                  <img style={{
          "display": "block",
          "height": "200.164px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="Neuschwanstein Castle nestled in a forested mountain landscape with snow-capped peaks in the distance" src="https://images.unsplash.com/photo-1793463986813-7e1b6370ca4a?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw0fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "rgb(255, 255, 255)",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
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
        }} aria-label="More details for Neuschwanstein Castle nestled in a forested mountain landscape with snow-capped peaks in the distance" type="button">
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
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
                </div>
              </div>
              <div style={{
      "aspectRatio": "1.77753 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "rgba(0, 0, 0, 0.1)",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
                  <img style={{
          "display": "block",
          "height": "75.1406px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A short-eared owl in flight over a field of dry golden grass" src="https://images.unsplash.com/photo-1793449162784-fa77abd22ef2?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw3fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "rgb(255, 255, 255)",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
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
        }} aria-label="More details for A short-eared owl in flight over a field of dry golden grass" type="button">
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
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
                </div>
              </div>
              <div style={{
      "aspectRatio": "0.670279 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "rgba(0, 0, 0, 0.1)",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
                  <img style={{
          "display": "block",
          "height": "198.164px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A sharp triangular patch of sunlight on a tiled floor and textured wall" src="https://images.unsplash.com/photo-1793531110179-6af052479cc5?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw5fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "rgb(255, 255, 255)",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
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
        }} aria-label="More details for A sharp triangular patch of sunlight on a tiled floor and textured wall" type="button">
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
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
                </div>
              </div>
              <div style={{
      "aspectRatio": "0.666667 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "rgba(0, 0, 0, 0.1)",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
                  <img style={{
          "display": "block",
          "height": "199.5px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="An ornate stone colonnade under a clear blue sky, framed by green leaves in golden light" src="https://images.unsplash.com/photo-1793559141324-6e65850719b0?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxMXx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "rgb(255, 255, 255)",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
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
        }} aria-label="More details for An ornate stone colonnade under a clear blue sky, framed by green leaves in golden light" type="button">
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
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
      "aspectRatio": "1.49978 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "rgba(0, 0, 0, 0.1)",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
  <img style={{
          "display": "block",
          "height": "88.4375px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A bright kitchen with cream cabinets, a stainless steel range, and a marble countertop" src="https://images.unsplash.com/photo-1792980205896-4bc34b91b040?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxM3x8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "rgb(255, 255, 255)",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
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
        }} aria-label="More details for A bright kitchen with cream cabinets, a stainless steel range, and a marble countertop" type="button">
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
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
      "aspectRatio": "0.666667 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "rgba(0, 0, 0, 0.1)",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
  <img style={{
          "display": "block",
          "height": "199.5px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A smooth white stone on a textured rock beside a dropper bottle and dried lavender" src="https://images.unsplash.com/photo-1793100123531-4924ea242f5f?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxNnx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "rgb(255, 255, 255)",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
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
        }} aria-label="More details for A smooth white stone on a textured rock beside a dropper bottle and dried lavender" type="button">
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
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
      "aspectRatio": "1.49978 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "rgba(0, 0, 0, 0.1)",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
  <img style={{
          "display": "block",
          "height": "88.4375px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A wooden dining table with chairs and a bowl of apples in a sunlit room" src="https://images.unsplash.com/photo-1793143765092-dd507da9bffe?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxOHx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "rgb(255, 255, 255)",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
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
        }} aria-label="More details for A wooden dining table with chairs and a bowl of apples in a sunlit room" type="button">
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
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
      "aspectRatio": "0.6668 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "rgba(0, 0, 0, 0.1)",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
  <img style={{
          "display": "block",
          "height": "199.5px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A person petting a happy corgi with its mouth open in front of white flowers" src="https://images.unsplash.com/photo-1793243894460-cc1ad3446e33?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyMHx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "rgb(255, 255, 255)",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
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
        }} aria-label="More details for A person petting a happy corgi with its mouth open in front of white flowers" type="button">
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
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
      "aspectRatio": "1.49978 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "rgba(0, 0, 0, 0.1)",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
  <img style={{
          "display": "block",
          "height": "88.4375px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A sunlit living room with a grey sofa, a television on a tripod, and large windows" src="https://images.unsplash.com/photo-1793362584700-57e1bb2d8bbe?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyM3x8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "rgb(255, 255, 255)",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
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
        }} aria-label="More details for A sunlit living room with a grey sofa, a television on a tripod, and large windows" type="button">
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
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
      "aspectRatio": "1.5 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "rgba(0, 0, 0, 0.1)",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
  <img style={{
          "display": "block",
          "height": "88.4375px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="Coniferous forest with yellowing autumn trees below a rocky mountain peak shrouded in thick fog" src="https://images.unsplash.com/photo-1793296268316-4279a8f9bbc9?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyNHx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "rgb(255, 255, 255)",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
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
        }} aria-label="More details for Coniferous forest with yellowing autumn trees below a rocky mountain peak shrouded in thick fog" type="button">
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
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
      "aspectRatio": "0.75 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "rgba(0, 0, 0, 0.1)",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
  <img style={{
          "display": "block",
          "height": "177.555px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A stack of dark ribbed steel rebar rods viewed from the end" src="https://images.unsplash.com/photo-1793280251985-79ebf452b285?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyNnx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "rgb(255, 255, 255)",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
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
        }} aria-label="More details for A stack of dark ribbed steel rebar rods viewed from the end" type="button">
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
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
      "aspectRatio": "1.33221 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "rgb(0, 0, 0)",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "rgba(0, 0, 0, 0.1)",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
  <img style={{
          "display": "block",
          "height": "99.75px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A large ocean wave breaking with sea spray in the warm golden hour light" src="https://images.unsplash.com/photo-1793296640109-4f7e6e99fa58?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyOXx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "rgb(255, 255, 255)",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
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
        }} aria-label="More details for A large ocean wave breaking with sea spray in the warm golden hour light" type="button">
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
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
            </div>;
}
