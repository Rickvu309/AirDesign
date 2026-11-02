import type { CSSProperties } from "react";
export interface AirDesignComponentProps {
  style?: CSSProperties;
  className?: string;
}
export function AccountMenuButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "32px",
    "justifyItems": "center",
    "lineHeight": "0px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "textAlign": "start",
    "borderRadius": "4px",
    "padding": "0px 4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="Account dropdown for Quan Vu (Richard)" type="button" className={className}>
    <div style={{
      "alignItems": "center",
      "columnGap": "8px",
      "display": "flex",
      "rowGap": "8px",
      "minWidth": "0px"
    }}>
      <div style={{
        "display": "flex",
        "position": "relative"
      }}>
        <span style={{
          "display": "block"
        }} aria-hidden="true">
          <div style={{
            "alignItems": "center",
            "color": "rgb(255, 255, 255)",
            "display": "flex",
            "flexShrink": "0",
            "height": "24px",
            "justifyContent": "center",
            "minWidth": "24px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "position": "relative",
            "width": "24px",
            "borderRadius": "9999px"
          }} aria-label="Quan Vu (Richard)" role="img">
            <span style={{
              "display": "block",
              "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
              "fontSize": "13px",
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
              "boxShadow": "rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset",
              "display": "block",
              "height": "24px",
              "left": "0px",
              "position": "absolute",
              "right": "0px",
              "top": "0px",
              "width": "24px",
              "minWidth": "0px",
              "minHeight": "0px",
              "borderRadius": "9999px"
            }}></span>
          </div>
        </span>
      </div>
      <span style={{
        "color": "rgba(0, 0, 0, 0.898)",
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "500",
        "letterSpacing": "-0.003px",
        "lineHeight": "24px",
        "maxWidth": "100%",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textOverflow": "ellipsis",
        "whiteSpace": "nowrap"
      }}>
        <span style={{
          "whiteSpace": "nowrap"
        }}>Quan Vu (Richard)</span>
      </span>
    </div>
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
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
    </svg>
  </button>;
}
export function HomeProfileAvatar({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "alignItems": "center",
    "color": "rgb(255, 255, 255)",
    "display": "flex",
    "flexShrink": "0",
    "height": "24px",
    "justifyContent": "center",
    "minWidth": "24px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "width": "24px",
    "borderRadius": "9999px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    ...style
  }} aria-label="Quan Vu (Richard)" role="img" className={className}>
            <span style={{
      "display": "block",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "13px",
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
      "boxShadow": "rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset",
      "display": "block",
      "height": "24px",
      "left": "0px",
      "position": "absolute",
      "right": "0px",
      "top": "0px",
      "width": "24px",
      "minWidth": "0px",
      "minHeight": "0px",
      "borderRadius": "9999px"
    }}></span>
          </div>;
}
export function NotificationsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "grid",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "gridTemplateColumns": "32px",
    "gridTemplateRows": "32px",
    "height": "32px",
    "justifyItems": "center",
    "lineHeight": "0px",
    "outlineColor": "rgba(0, 0, 0, 0)",
    "outlineOffset": "-1px",
    "outlineStyle": "solid",
    "outlineWidth": "1px",
    "textAlign": "start",
    "width": "32px",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-haspopup="menu" aria-label="Notifications, new notification received" aria-expanded="false" type="button" className={className}>
      <div style={{
      "alignItems": "center",
      "display": "flex",
      "height": "32px",
      "justifyContent": "center",
      "position": "relative",
      "width": "32px",
      "borderRadius": "5px"
    }}>
        <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
          <circle style={{
          "fill": "rgb(220, 52, 18)"
        }} cx="16.5" cy="7.5" r="2.5" fill="var(--color-icon-danger)"></circle>
          <path style={{
          "fill": "rgba(0, 0, 0, 0.898)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12 5a1 1 0 0 1 .991 1.124q.131.035.258.077a3.5 3.5 0 0 0-.233.979A3 3 0 0 0 9 10v1.172l-.009.338A6.83 6.83 0 0 1 7 16h10a6.83 6.83 0 0 1-1.991-4.49L15 11.172v-.509c.31.148.647.25 1 .3v.209c0 1.546.614 3.028 1.707 4.121A1 1 0 0 1 17 17h-3a2 2 0 1 1-4 0H7a1 1 0 0 1-.707-1.707A5.83 5.83 0 0 0 8 11.172V10a4 4 0 0 1 3.008-3.876A1 1 0 0 1 12 5m-1 12a1 1 0 1 0 2 0z"></path>
        </svg>
      </div>
    </button>;
}
export function SearchInput({
  style,
  className
}: AirDesignComponentProps) {
  return <input style={{
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgba(0, 0, 0, 0.898)",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "lineHeight": "16px",
    "marginRight": "10px",
    "overflowX": "clip",
    "overflowY": "clip",
    "textOverflow": "ellipsis",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 200,
    ...style
  }} aria-description="Search results; results will update as you type" aria-label="Search" placeholder="Search" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-haspopup="listbox" type="text" value="" className={className}></input>;
}
export function RecentsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
              <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "height": "28px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "4px",
      "paddingRight": "4px",
      "width": "224px",
      "borderRadius": "5px",
      "margin": "2px 8px"
    }}>
                <div></div>
                <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "rowGap": "8px",
        "width": "216px"
      }}>
                  <div style={{
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
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14m6-7a6 6 0 1 1-12 0 6 6 0 0 1 12 0m-5.5-3.5a.5.5 0 0 0-1 0V12a.5.5 0 0 0 .146.354l2 2a.5.5 0 0 0 .708-.708L12.5 11.793z" clipRule="evenodd"></path>
  </svg>
</div>
                  <span style={{
          "display": "block",
          "maxWidth": "100%",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
  <span style={{
            "whiteSpace": "nowrap"
          }}>Recents</span>
</span>
                </div>
              </div>
            </button>;
}
export function PlanButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "32px",
    "justifyItems": "center",
    "lineHeight": "16px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "textAlign": "start",
    "borderRadius": "4px",
    "padding": "0px 0px 0px 4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="Plan: Quan Vu" type="button" className={className}>
                <div style={{
      "alignItems": "center",
      "display": "flex",
      "overflowX": "hidden",
      "overflowY": "hidden"
    }}>
                  <div style={{
        "alignItems": "center",
        "display": "flex",
        "flexShrink": "0",
        "height": "24px",
        "justifyContent": "center",
        "width": "24px"
      }}>
  <div style={{
          "position": "relative"
        }}>
    <span aria-hidden="true">
      <div style={{
              "alignItems": "center",
              "backgroundColor": "rgb(242, 72, 34)",
              "color": "rgb(255, 255, 255)",
              "display": "flex",
              "flexShrink": "0",
              "height": "16px",
              "justifyContent": "center",
              "minWidth": "16px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "position": "relative",
              "width": "16px",
              "borderRadius": "9999px"
            }} aria-label="Quan Vu" role="img">
        <span style={{
                "display": "block",
                "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                "fontSize": "10px",
                "fontWeight": "500",
                "textAlign": "center"
              }}>
          Q
        </span>
      </div>
    </span>
    <div style={{
            "boxShadow": "rgba(255, 255, 255, 0.4) 0px 0px 0px 1px inset",
            "height": "16px",
            "position": "absolute",
            "top": "0px",
            "width": "16px",
            "borderRadius": "100%"
          }}></div>
  </div>
</div>
                  <div style={{
        "display": "flex",
        "marginLeft": "8px",
        "overflowX": "hidden",
        "overflowY": "hidden"
      }}>
  <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
          "display": "block",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontSize": "13px",
          "fontWeight": "550",
          "letterSpacing": "-0.032px",
          "lineHeight": "22px",
          "maxWidth": "100%",
          "overflowWrap": "break-word",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
    <span style={{
            "whiteSpace": "nowrap"
          }}>Quan Vu</span>
  </span>
</div>
                </div>
                <svg style={{
      "display": "block",
      "flexShrink": "0",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
                </svg>
              </button>;
}
export function HomeProfileAvatar2({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "alignItems": "center",
    "backgroundColor": "rgb(242, 72, 34)",
    "color": "rgb(255, 255, 255)",
    "display": "flex",
    "flexShrink": "0",
    "height": "16px",
    "justifyContent": "center",
    "minWidth": "16px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "width": "16px",
    "borderRadius": "9999px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    ...style
  }} aria-label="Quan Vu" role="img" className={className}>
        <span style={{
      "display": "block",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "10px",
      "fontWeight": "500",
      "textAlign": "center"
    }}>
          Q
        </span>
      </div>;
}
export function ChangePlanButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "color": "rgb(0, 0, 0)",
    "display": "block",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "lineHeight": "16px",
    "textAlign": "center",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Change plan. Quan Vu is currently on the Professional plan" aria-expanded="false" className={className}>
                  <span style={{
      "backgroundColor": "rgb(242, 249, 255)",
      "boxSizing": "border-box",
      "color": "rgb(0, 123, 229)",
      "display": "flex",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontWeight": "500",
      "letterSpacing": "0.005px",
      "paddingLeft": "6px",
      "paddingRight": "6px",
      "whiteSpace": "nowrap",
      "borderRadius": "4px"
    }}>
  <span style={{
        "whiteSpace": "nowrap"
      }}>Professional</span>
</span>
                </button>;
}
export function AllFoldersButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
              <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "height": "28px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "4px",
      "paddingRight": "4px",
      "width": "224px",
      "borderRadius": "5px",
      "margin": "2px 8px"
    }}>
                <div></div>
                <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "rowGap": "8px",
        "width": "216px"
      }}>
                  <div style={{
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
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.653 13.008A1.5 1.5 0 0 1 11 14.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L9.5 18h-2a1.5 1.5 0 0 1-1.492-1.347L6 16.5v-2A1.5 1.5 0 0 1 7.5 13h2zm7 0A1.5 1.5 0 0 1 18 14.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L16.5 18h-2a1.5 1.5 0 0 1-1.492-1.347L13 16.5v-2a1.5 1.5 0 0 1 1.5-1.5h2zM7.5 14a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zm7 0a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zM9.653 6.008A1.5 1.5 0 0 1 11 7.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L9.5 11h-2a1.5 1.5 0 0 1-1.492-1.347L6 9.5v-2A1.5 1.5 0 0 1 7.5 6h2zm7 0A1.5 1.5 0 0 1 18 7.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L16.5 11h-2a1.5 1.5 0 0 1-1.492-1.347L13 9.5v-2A1.5 1.5 0 0 1 14.5 6h2zM7.5 7a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zm7 0a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5z"></path>
  </svg>
</div>
                  <span style={{
          "display": "block",
          "maxWidth": "100%",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
  <span style={{
            "whiteSpace": "nowrap"
          }}>All folders</span>
</span>
                </div>
              </div>
            </button>;
}
export function ResourcesButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
              <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "height": "28px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "4px",
      "paddingRight": "4px",
      "width": "224px",
      "borderRadius": "5px",
      "margin": "2px 8px"
    }}>
                <div></div>
                <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "rowGap": "8px",
        "width": "216px"
      }}>
                  <div style={{
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
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7 7h10a1 1 0 0 1 1 1v2H6V8a1 1 0 0 1 1-1m-1 4v5a1 1 0 0 0 1 1h2v-6zm4 6h7a1 1 0 0 0 1-1v-5h-8zM5 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
  </svg>
</div>
                  <span style={{
          "display": "block",
          "maxWidth": "100%",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
  <span style={{
            "whiteSpace": "nowrap"
          }}>Resources</span>
</span>
                </div>
              </div>
            </button>;
}
export function TrashButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
              <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "height": "28px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "4px",
      "paddingRight": "4px",
      "width": "224px",
      "borderRadius": "5px",
      "margin": "2px 8px"
    }}>
                <div></div>
                <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "rowGap": "8px",
        "width": "216px"
      }}>
                  <div style={{
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
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M16.355 9a.5.5 0 0 1 .498.52l-.273 6.563-.018.198a2 2 0 0 1-1.782 1.71l-.198.009H9.418a2 2 0 0 1-1.998-1.917l-.273-6.562a.5.5 0 1 1 1-.042l.272 6.563a1 1 0 0 0 .999.958h5.164a1 1 0 0 0 1-.958l.272-6.563a.5.5 0 0 1 .5-.479M11 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 1 .5-.5m2 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 1 .5-.5m0-5a1 1 0 0 1 1 1v1h3.5a.5.5 0 0 1 0 1h-11a.5.5 0 0 1 0-1H10V6a1 1 0 0 1 1-1zm-2 2h2V6h-2z"></path>
  </svg>
</div>
                  <span style={{
          "display": "block",
          "maxWidth": "100%",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
  <span style={{
            "whiteSpace": "nowrap"
          }}>Trash</span>
</span>
                </div>
              </div>
            </button>;
}
export function AdminButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
              <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "height": "28px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "4px",
      "paddingRight": "4px",
      "width": "224px",
      "borderRadius": "5px",
      "margin": "2px 8px"
    }}>
                <div></div>
                <div style={{
        "alignItems": "center",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "216px"
      }}>
                  <span style={{
          "alignItems": "center",
          "columnGap": "8px",
          "display": "flex",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "rowGap": "8px",
          "width": "201.242px"
        }}>
  <div style={{
            "alignItems": "center",
            "display": "flex",
            "flexShrink": "0",
            "height": "24px",
            "justifyContent": "center",
            "width": "24px"
          }} aria-hidden="true">
    <div style={{
              "height": "24px",
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
                }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M15.755 7.234a1 1 0 0 1-1.505-.87c.002-.52-.342-1.138-1.038-1.26a7 7 0 0 0-2.424 0c-.696.122-1.04.74-1.038 1.26a1 1 0 0 1-1.505.87c-.45-.262-1.155-.273-1.608.267A7 7 0 0 0 5.42 9.603c-.241.664.122 1.27.574 1.527a1 1 0 0 1 0 1.74c-.452.258-.815.863-.574 1.527a7 7 0 0 0 1.216 2.102c.453.54 1.158.529 1.608.267a1 1 0 0 1 1.505.87c-.002.52.342 1.138 1.038 1.26a7 7 0 0 0 2.424 0c.696-.122 1.04-.74 1.038-1.26a1 1 0 0 1 1.505-.87c.45.262 1.155.273 1.608-.267a7 7 0 0 0 1.216-2.102c.241-.664-.122-1.27-.574-1.528a1 1 0 0 1 0-1.739c.452-.258.815-.864.573-1.527a7 7 0 0 0-1.215-2.102c-.453-.54-1.158-.529-1.608-.267m-1.505.869a2 2 0 0 0 2.008-.005c.112-.064.256-.052.34.046.444.53.8 1.139 1.041 1.802.044.12-.018.252-.13.316a2 2 0 0 0 0 3.476c.112.064.174.195.13.316a6 6 0 0 1-1.042 1.802c-.082.098-.227.11-.339.046a2 2 0 0 0-3.008 1.737c0 .13-.083.249-.21.271a6 6 0 0 1-2.08 0c-.127-.022-.21-.142-.21-.27a2 2 0 0 0-3.007-1.74c-.112.065-.257.053-.34-.045a6 6 0 0 1-1.041-1.802c-.044-.12.018-.252.13-.316a2 2 0 0 0 0-3.476c-.112-.064-.174-.195-.13-.316a6 6 0 0 1 1.042-1.802c.082-.098.227-.11.339-.046A2 2 0 0 0 10.75 6.36c0-.13.083-.249.21-.271a6 6 0 0 1 2.08 0c.127.022.21.141.21.27a2 2 0 0 0 1 1.743M10.5 12a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5" clipRule="evenodd"></path>
      </svg>
    </div>
  </div>
  <span style={{
            "display": "block",
            "maxWidth": "100%",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "textOverflow": "ellipsis",
            "whiteSpace": "nowrap"
          }}>
    <span style={{
              "whiteSpace": "nowrap"
            }}>Admin</span>
  </span>
</span>
                  <div style={{
          "alignItems": "center",
          "display": "flex",
          "flexShrink": "0"
        }}>
  <div>
    <strong style={{
              "alignItems": "center",
              "backgroundColor": "rgb(230, 230, 230)",
              "boxSizing": "content-box",
              "color": "rgba(0, 0, 0, 0.898)",
              "display": "inline-flex",
              "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
              "fontSize": "11px",
              "fontWeight": "450",
              "height": "16px",
              "letterSpacing": "0.05504px",
              "lineHeight": "16px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "paddingLeft": "4px",
              "paddingRight": "4px",
              "position": "relative",
              "borderRadius": "5px"
            }} aria-label="2 admin notifications">
      <span style={{
                "display": "block",
                "flexGrow": "1",
                "overflowX": "hidden",
                "overflowY": "hidden",
                "textOverflow": "ellipsis",
                "whiteSpace": "nowrap"
              }}>
        <span style={{
                  "whiteSpace": "nowrap"
                }}>2</span>
      </span>
    </strong>
  </div>
</div>
                </div>
              </div>
            </button>;
}
export function AdminNotificationsBadge({
  style,
  className
}: AirDesignComponentProps) {
  return <strong style={{
    "alignItems": "center",
    "backgroundColor": "rgb(230, 230, 230)",
    "boxSizing": "content-box",
    "color": "rgba(0, 0, 0, 0.898)",
    "display": "inline-flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "height": "16px",
    "letterSpacing": "0.05504px",
    "lineHeight": "16px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "borderRadius": "5px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="2 admin notifications" className={className}>
      <span style={{
      "display": "block",
      "flexGrow": "1",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "textOverflow": "ellipsis",
      "whiteSpace": "nowrap"
    }}>
        <span style={{
        "whiteSpace": "nowrap"
      }}>2</span>
      </span>
    </strong>;
}
export function StarredButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "32px",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "minWidth": "0px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-expanded="true" type="button" className={className}>
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
          "fill": "rgba(0, 0, 0, 0.3)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
    </svg>
  </span>
  <span style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "display": "block",
      "flexBasis": "0%",
      "flexGrow": "1",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontWeight": "550",
      "letterSpacing": "0.05504px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "textOverflow": "ellipsis",
      "minWidth": "0px",
      "whiteSpace": "nowrap"
    }}>
    <span style={{
        "display": "contents"
      }}>
      <span style={{
          "whiteSpace": "nowrap"
        }}>Starred</span>
    </span>
  </span>
</button>;
}
export function PersonalProjectButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-description="Folder" type="button" className={className}>
    <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "height": "28px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "4px",
      "paddingRight": "4px",
      "width": "224px",
      "borderRadius": "5px",
      "margin": "2px 8px"
    }}>
      <div></div>
      <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "rowGap": "8px",
        "width": "216px"
      }}>
        <div style={{
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
              "fill": "rgb(175, 188, 207)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
          </svg>
        </div>
        <span style={{
          "display": "block",
          "maxWidth": "100%",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
          <span style={{
            "whiteSpace": "nowrap"
          }}>[Quan] 01. Personal Project</span>
        </span>
      </div>
      <div style={{
        "alignItems": "center",
        "display": "flex",
        "flexShrink": "0"
      }}></div>
    </div>
  </button>;
}
export function WorkProjectButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-description="Folder" type="button" className={className}>
    <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "height": "28px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "4px",
      "paddingRight": "4px",
      "width": "224px",
      "borderRadius": "5px",
      "margin": "2px 8px"
    }}>
      <div></div>
      <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "rowGap": "8px",
        "width": "216px"
      }}>
        <div style={{
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
              "fill": "rgb(175, 188, 207)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
          </svg>
        </div>
        <span style={{
          "display": "block",
          "maxWidth": "100%",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
          <span style={{
            "whiteSpace": "nowrap"
          }}>[Quan] 02. Work Project</span>
        </span>
      </div>
      <div style={{
        "alignItems": "center",
        "display": "flex",
        "flexShrink": "0"
      }}></div>
    </div>
  </button>;
}
export function CollabProjectButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-description="Folder" type="button" className={className}>
    <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "height": "28px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "4px",
      "paddingRight": "4px",
      "width": "224px",
      "borderRadius": "5px",
      "margin": "2px 8px"
    }}>
      <div></div>
      <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "rowGap": "8px",
        "width": "216px"
      }}>
        <div style={{
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
              "fill": "rgb(175, 188, 207)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
          </svg>
        </div>
        <span style={{
          "display": "block",
          "maxWidth": "100%",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
          <span style={{
            "whiteSpace": "nowrap"
          }}>[Quan] 03. Collab</span>
        </span>
      </div>
      <div style={{
        "alignItems": "center",
        "display": "flex",
        "flexShrink": "0"
      }}></div>
    </div>
  </button>;
}
export function ArchiveProjectButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-description="Folder" type="button" className={className}>
    <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "height": "28px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "4px",
      "paddingRight": "4px",
      "width": "224px",
      "borderRadius": "5px",
      "margin": "2px 8px"
    }}>
      <div></div>
      <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "rowGap": "8px",
        "width": "216px"
      }}>
        <div style={{
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
              "fill": "rgb(175, 188, 207)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
          </svg>
        </div>
        <span style={{
          "display": "block",
          "maxWidth": "100%",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
          <span style={{
            "whiteSpace": "nowrap"
          }}>[Quan] 99. Archive</span>
        </span>
      </div>
      <div style={{
        "alignItems": "center",
        "display": "flex",
        "flexShrink": "0"
      }}></div>
    </div>
  </button>;
}
export function RecentFileButtonNovaMembership({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-description="Folder" type="button" className={className}>
      <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "height": "28px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "4px",
      "paddingRight": "4px",
      "width": "224px",
      "borderRadius": "5px",
      "margin": "2px 8px"
    }}>
        <div></div>
        <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "rowGap": "8px",
        "width": "216px"
      }}>
          <div style={{
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
              "fill": "rgb(175, 188, 207)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
            </svg>
          </div>
          <span style={{
          "display": "block",
          "maxWidth": "100%",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
            <span style={{
            "whiteSpace": "nowrap"
          }}>Nova Membership</span>
          </span>
        </div>
        <div style={{
        "alignItems": "center",
        "display": "flex",
        "flexShrink": "0"
      }}></div>
      </div>
    </button>;
}
export function RecentFileButtonProjectConsulting({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-description="Folder" type="button" className={className}>
      <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "height": "28px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "4px",
      "paddingRight": "4px",
      "width": "224px",
      "borderRadius": "5px",
      "margin": "2px 8px"
    }}>
        <div></div>
        <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "rowGap": "8px",
        "width": "216px"
      }}>
          <div style={{
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
              "fill": "rgb(175, 188, 207)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
            </svg>
          </div>
          <span style={{
          "display": "block",
          "maxWidth": "100%",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
            <span style={{
            "whiteSpace": "nowrap"
          }}>Project Consulting</span>
          </span>
        </div>
        <div style={{
        "alignItems": "center",
        "display": "flex",
        "flexShrink": "0"
      }}></div>
      </div>
    </button>;
}
export function RecentFileButtonProfessionalTemplate({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-description="Folder" type="button" className={className}>
      <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "height": "28px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "4px",
      "paddingRight": "4px",
      "width": "224px",
      "borderRadius": "5px",
      "margin": "2px 8px"
    }}>
        <div></div>
        <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "rowGap": "8px",
        "width": "216px"
      }}>
          <div style={{
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
              "fill": "rgb(175, 188, 207)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
            </svg>
          </div>
          <span style={{
          "display": "block",
          "maxWidth": "100%",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
            <span style={{
            "whiteSpace": "nowrap"
          }}>Professional Template</span>
          </span>
        </div>
        <div style={{
        "alignItems": "center",
        "display": "flex",
        "flexShrink": "0"
      }}></div>
      </div>
    </button>;
}
export function RecentFileButtonVietjetProject({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-description="Folder" type="button" className={className}>
      <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "height": "28px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "4px",
      "paddingRight": "4px",
      "width": "224px",
      "borderRadius": "5px",
      "margin": "2px 8px"
    }}>
        <div></div>
        <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "rowGap": "8px",
        "width": "216px"
      }}>
          <div style={{
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
              "fill": "rgb(175, 188, 207)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
            </svg>
          </div>
          <span style={{
          "display": "block",
          "maxWidth": "100%",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
            <span style={{
            "whiteSpace": "nowrap"
          }}>Vietjet Project</span>
          </span>
        </div>
        <div style={{
        "alignItems": "center",
        "display": "flex",
        "flexShrink": "0"
      }}></div>
      </div>
    </button>;
}
export function RecentFileButtonGrokBotSlide({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-description="Folder" type="button" className={className}>
      <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "height": "28px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "4px",
      "paddingRight": "4px",
      "width": "224px",
      "borderRadius": "5px",
      "margin": "2px 8px"
    }}>
        <div></div>
        <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "rowGap": "8px",
        "width": "216px"
      }}>
          <div style={{
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
              "fill": "rgb(175, 188, 207)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
            </svg>
          </div>
          <span style={{
          "display": "block",
          "maxWidth": "100%",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
            <span style={{
            "whiteSpace": "nowrap"
          }}>Grok Bot Slide</span>
          </span>
        </div>
        <div style={{
        "alignItems": "center",
        "display": "flex",
        "flexShrink": "0"
      }}></div>
      </div>
    </button>;
}
export function NewDesignFileButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(245, 245, 245)",
    "boxShadow": "rgb(230, 230, 230) 0px 0px 0px 1px inset",
    "color": "rgb(0, 0, 0)",
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    ...style
  }} aria-label="New Design file" type="button" className={className}>
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
            "backgroundColor": "rgb(13, 153, 255)",
            "borderRadius": "2px"
          }}>
                        <svg style={{
              "display": "block",
              "height": "16px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "16px"
            }} width="16" height="16" fill="none" viewBox="0 0 64 64"><path d="M13 57l19-50 19 50" fill="none" stroke="#1A1A1A" strokeWidth={3.063} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /><path d="M6 44l52-14" fill="none" stroke="#FF58AE" strokeWidth={2.188} strokeLinecap="round" vectorEffect="non-scaling-stroke" /></svg>
                      </div>
                      <span style={{
            "alignItems": "center",
            "columnGap": "4px",
            "display": "flex",
            "rowGap": "4px"
          }}>
                        <span style={{
              "color": "rgba(0, 0, 0, 0.898)",
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
          "backgroundColor": "rgb(255, 255, 255)"
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
              </button>;
}
export function NewSlidesFileButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(245, 245, 245)",
    "boxShadow": "rgb(230, 230, 230) 0px 0px 0px 1px inset",
    "color": "rgb(0, 0, 0)",
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    ...style
  }} aria-label="New Slides file" type="button" className={className}>
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
            "backgroundColor": "rgb(255, 92, 22)",
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
                "fill": "rgb(255, 255, 255)"
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M4 4h8a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m.434 8H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-.434l.412 1.354a.5.5 0 1 1-.956.292L10.52 12H5.479l-.5 1.646a.5.5 0 1 1-.957-.292zM5 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2m0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2" clipRule="evenodd"></path>
</svg>
                      </div>
                      <span style={{
            "alignItems": "center",
            "columnGap": "4px",
            "display": "flex",
            "rowGap": "4px"
          }}>
                        <span style={{
              "color": "rgba(0, 0, 0, 0.898)",
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
          "backgroundColor": "rgb(255, 255, 255)"
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
              </button>;
}
export function MoreButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(245, 245, 245)",
    "boxShadow": "rgb(230, 230, 230) 0px 0px 0px 1px inset",
    "color": "rgb(0, 0, 0)",
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="More" type="button" className={className}>
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
            "color": "rgba(0, 0, 0, 0.898)",
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
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
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
          "backgroundColor": "rgb(255, 255, 255)"
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
              </button>;
}
export function AccountButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "textAlign": "start",
    "width": "24px",
    "borderRadius": "9999px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-haspopup="dialog" aria-expanded="false" aria-label="Quan Vu (Richard)" type="button" className={className}>
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
                    </button>;
}
export function HomeHelpButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "boxShadow": "rgba(0, 0, 0, 0.18) 0px 0px 0.5px 0px, rgba(0, 0, 0, 0.1) 0px 3px 8px 0px, rgba(0, 0, 0, 0.1) 0px 1px 3px 0px",
    "boxSizing": "border-box",
    "color": "rgb(255, 255, 255)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "32px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "32px",
    "border": "1px solid rgba(0, 0, 0, 0)",
    "borderRadius": "100%",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="Help" type="button" className={className}>
      <svg style={{
      "display": "block",
      "height": "32px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "30px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M11.69 16.572q.357 0 .61.254a.83.83 0 0 1 .26.616q0 .236-.12.435a.9.9 0 0 1-.315.32.84.84 0 0 1-.435.114.85.85 0 0 1-.615-.253.85.85 0 0 1-.254-.616.84.84 0 0 1 .254-.616.85.85 0 0 1 .615-.254m.332-10.884q1.002 0 1.763.416.76.41 1.19 1.13.428.712.428 1.635 0 .61-.193 1.111a2.9 2.9 0 0 1-.58.924 4.8 4.8 0 0 1-.954.797 4.6 4.6 0 0 0-.863.718 2.1 2.1 0 0 0-.459.815q-.138.453-.15 1.117c0 .18-.146.326-.326.326h-.44a.326.326 0 0 1-.327-.326q.006-.954.21-1.551.207-.598.604-1.009a5.5 5.5 0 0 1 1.003-.797q.447-.29.748-.61.308-.325.465-.711a2.2 2.2 0 0 0 .163-.852q0-.651-.307-1.14a2.04 2.04 0 0 0-.822-.755 2.45 2.45 0 0 0-1.153-.272q-.603 0-1.129.266a2.15 2.15 0 0 0-1.138 1.483c-.067.3-.312.545-.619.545-.323 0-.588-.269-.53-.587a3.12 3.12 0 0 1 1.678-2.268 3.7 3.7 0 0 1 1.738-.405" clipRule="evenodd"></path>
      </svg>
    </button>;
}
export function GettingStartedMoveButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 92, 22)",
    "boxSizing": "border-box",
    "color": "rgb(255, 255, 255)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Move" aria-pressed="true" type="button" className={className}>
  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
        "fill": "rgb(255, 255, 255)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
  </svg>
</button>;
}
export function GettingStartedMoveToolsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "16px",
    "borderRadius": "5px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Move tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" className={className}>
  <span style={{
      "display": "block"
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
    </svg>
  </span>
</button>;
}
export function GettingStartedTextButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Text" aria-pressed="false" type="button" className={className}>
                  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z"></path>
                  </svg>
                </button>;
}
export function GettingStartedImageVideoButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Image/video…" aria-pressed="false" type="button" className={className}>
                  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M18 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM6 5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm2.725 5.582a.5.5 0 0 1 .629.064l6.5 6.5a.5.5 0 1 1-.707.707L9 11.708l-2.146 2.146a.5.5 0 1 1-.708-.707l2.5-2.5zM14.5 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5m0 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"></path>
                  </svg>
                </button>;
}
export function GettingStartedShapesButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Shapes" aria-pressed="false" type="button" className={className}>
                  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M3 9c0 1.521.566 2.91 1.5 3.968a6 6 0 0 0 4 2.011.47.47 0 0 0 .5-.479.536.536 0 0 0-.49-.524H8.5a5 5 0 0 1-3.218-1.632A5 5 0 1 1 13.975 8.5l.001.008.013.073A.536.536 0 0 0 14.5 9a.47.47 0 0 0 .48-.5 6 6 0 0 0-2.012-4A6 6 0 0 0 3 9m9 2h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
                  </svg>
                </button>;
}
export function GettingStartedCommentButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Comment" aria-pressed="false" type="button" className={className}>
                  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.5 3a8.5 8.5 0 0 1 0 17H7.09c-.89 0-1.39 0-1.767-.121l-.154-.06a2 2 0 0 1-.906-.828l-.082-.16c-.136-.297-.17-.657-.178-1.248L4 16.909V11.5A8.5 8.5 0 0 1 12.5 3m0 1A7.5 7.5 0 0 0 5 11.5v5.41c0 .523 0 .861.02 1.12.018.247.05.34.07.385a1 1 0 0 0 .495.494c.045.02.138.053.386.072.258.019.596.019 1.12.019H12.5a7.5 7.5 0 0 0 0-15"></path>
</svg>
                </button>;
}
export function GettingStartedActionsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Actions" aria-pressed="false" type="button" className={className}>
                  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"></path>
</svg>
                </button>;
}
export function GettingStartedMoveButton2({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(13, 153, 255)",
    "boxSizing": "border-box",
    "color": "rgb(255, 255, 255)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Move" aria-pressed="true" type="button" aria-disabled="true" className={className}>
    <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
        "fill": "rgb(255, 255, 255)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
    </svg>
  </button>;
}
export function GettingStartedMoveToolsButton2({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "16px",
    "borderRadius": "5px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Move tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true" className={className}>
    <span style={{
      "display": "block"
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>;
}
export function GettingStartedFrameButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.3)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Frame" aria-pressed="false" type="button" aria-disabled="true" className={className}>
                  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
        "fill": "rgba(0, 0, 0, 0.3)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 4a.5.5 0 0 0-.5.5V7H4.5a.5.5 0 0 0 0 1H7v8H4.5a.5.5 0 0 0 0 1H7v2.5a.5.5 0 0 0 1 0V17h8v2.5a.5.5 0 0 0 1 0V17h2.5a.5.5 0 0 0 0-1H17V8h2.5a.5.5 0 0 0 0-1H17V4.5a.5.5 0 0 0-1 0V7H8V4.5a.5.5 0 0 0-.5-.5M16 8H8v8h8z" clipRule="evenodd"></path>
</svg>
                </button>;
}
export function GettingStartedRectangleButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.3)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Rectangle" aria-pressed="false" type="button" aria-disabled="true" className={className}>
    <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
        "fill": "rgba(0, 0, 0, 0.3)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1M6 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" clipRule="evenodd"></path>
    </svg>
  </button>;
}
export function GettingStartedShapeToolsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "16px",
    "borderRadius": "5px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Shape tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true" className={className}>
    <span style={{
      "display": "block"
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>;
}
export function GettingStartedPenButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.3)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Pen" aria-pressed="false" type="button" aria-disabled="true" className={className}>
    <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
        "fill": "rgba(0, 0, 0, 0.3)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.886 3.21a1 1 0 0 1 .812-.19l7.698 1.56.338.076a7.67 7.67 0 0 1 5.806 7.266v.346l-.008.329 1.197 1.197a1 1 0 0 1 0 1.414l-5.523 5.522a1 1 0 0 1-1.413 0l-1.198-1.197-.328.008a7.67 7.67 0 0 1-7.612-5.806l-.077-.338L3.02 5.7a1 1 0 0 1 .274-.906l1.5-1.5zm.674 9.99a6.666 6.666 0 0 0 6.383 5.342h.3l.756-.018 1.5 1.5 5.523-5.522-1.5-1.5.018-.756a6.67 6.67 0 0 0-5.048-6.619l-.295-.066L5.5 4l-.396.397 5.16 5.16A3 3 0 0 1 12 9.001 3.001 3.001 0 0 1 12 15a3 3 0 0 1-2.444-4.737l-5.16-5.16L4 5.5zM12 10.001a2 2 0 0 0-2 2l.01.204a2 2 0 0 0 1.786 1.785L12 14a2 2 0 0 0 1.989-1.795l.01-.204a2 2 0 0 0-1.795-1.99z"></path>
    </svg>
  </button>;
}
export function GettingStartedCreationToolsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "16px",
    "borderRadius": "5px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Creation tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true" className={className}>
    <span style={{
      "display": "block"
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>;
}
export function GettingStartedTextButton2({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.3)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Text" aria-pressed="false" type="button" aria-disabled="true" className={className}>
    <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
        "fill": "rgba(0, 0, 0, 0.3)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z"></path>
    </svg>
  </button>;
}
export function GettingStartedTypeToolsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "16px",
    "borderRadius": "5px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Type tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true" className={className}>
    <span style={{
      "display": "block"
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>;
}
export function GettingStartedCommentButton2({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.3)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Comment" aria-pressed="false" type="button" aria-disabled="true" className={className}>
                  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
        "fill": "rgba(0, 0, 0, 0.3)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.5 3a8.5 8.5 0 0 1 0 17H7.09c-.89 0-1.39 0-1.767-.121l-.154-.06a2 2 0 0 1-.906-.828l-.082-.16c-.136-.297-.17-.657-.178-1.248L4 16.909V11.5A8.5 8.5 0 0 1 12.5 3m0 1A7.5 7.5 0 0 0 5 11.5v5.41c0 .523 0 .861.02 1.12.018.247.05.34.07.385a1 1 0 0 0 .495.494c.045.02.138.053.386.072.258.019.596.019 1.12.019H12.5a7.5 7.5 0 0 0 0-15"></path>
</svg>
                </button>;
}
export function GettingStartedActionsButton2({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.3)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Actions" aria-pressed="false" type="button" aria-disabled="true" className={className}>
                  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
        "fill": "rgba(0, 0, 0, 0.3)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"></path>
</svg>
                </button>;
}
export function GettingStartedAssetsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "inline-flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "9999px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Assets" type="button" aria-disabled="true" className={className}>
  <div style={{
      "color": "rgba(0, 0, 0, 0.3)",
      "borderRadius": "9999px"
    }}>
    <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
          "fill": "rgba(0, 0, 0, 0.3)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd"></path>
    </svg>
  </div>
</button>;
}
export function GettingStartedMainMenuButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    "flexShrink": 0,
    position: "relative",
    ...style
  }} aria-label="Main menu" aria-haspopup="menu" aria-expanded="false" type="button" className={className}>
    <svg style={{
      "display": "block",
      "width": 24,
      "height": 24,
      "flexShrink": 0
    }} viewBox="0 0 64 64" preserveAspectRatio="none" aria-hidden="true" width={24} height={24}>
      <path d="M13 57l19-50 19 50" fill="none" stroke="#1A1A1A" strokeWidth={3.063} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"></path>
      <path d="M6 44l52-14" fill="none" stroke="#FF58AE" strokeWidth={2.188} strokeLinecap="round" vectorEffect="non-scaling-stroke"></path>
    </svg>
  </button>;
}
export function GettingStartedFileButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "2px",
    "display": "flex",
    "flexDirection": "column",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "rowGap": "2px",
    "textAlign": "start",
    "width": "56px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-expanded="true" aria-label="File" type="button" className={className}>
    <div style={{
      "alignItems": "center",
      "backgroundColor": "rgb(255, 223, 204)",
      "display": "flex",
      "height": "32px",
      "justifyContent": "center",
      "width": "32px",
      "borderRadius": "5px"
    }}>
      <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
          "fill": "rgb(226, 76, 12)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.598 5.01a.5.5 0 0 1 .255.136l4 4A.5.5 0 0 1 16.5 10h-4a.5.5 0 0 1-.5-.5V6H8.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 1 1 0v6a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 17.5v-11A1.5 1.5 0 0 1 8.5 5h4zM13 9h2.293L13 6.707z"></path>
      </svg>
    </div>
    <span style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "display": "block",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "9px",
      "fontWeight": "450",
      "height": "14px",
      "letterSpacing": "0.04496px",
      "lineHeight": "14px",
      "marginLeft": "8px",
      "marginRight": "8px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "position": "relative",
      "textAlign": "center",
      "width": "40px",
      "whiteSpace": "nowrap"
    }}>
      <span style={{
        "whiteSpace": "nowrap"
      }}>File</span>
    </span>
  </button>;
}
export function GettingStartedAgentsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "2px",
    "display": "flex",
    "flexDirection": "column",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "rowGap": "2px",
    "textAlign": "start",
    "width": "56px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-expanded="false" aria-label="Agents" type="button" className={className}>
    <div style={{
      "alignItems": "center",
      "display": "flex",
      "height": "32px",
      "justifyContent": "center",
      "width": "32px",
      "borderRadius": "5px"
    }}>
      <span style={{
        "display": "flex"
      }}>
        <div style={{
          "height": "fit-content",
          "position": "relative",
          "width": "fit-content"
        }}>
          <svg style={{
            "display": "block",
            "height": "24px",
            "maskComposite": "exclude",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "24px"
          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path style={{
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M10.39 6.057c.599-1.407 2.624-1.407 3.222 0l.056.146L14.7 9.302l3.1 1.034c1.6.534 1.6 2.799 0 3.333L14.7 14.7l-1.032 3.1-.055.145c-.618 1.454-2.76 1.406-3.278-.145l-1.034-3.1-3.099-1.032c-1.551-.517-1.6-2.66-.145-3.279l.145-.054 3.099-1.034 1.034-3.1zm2.3.387c-.256-.59-1.123-.59-1.378 0l-.034.087-1.029 3.087-.158.474-.474.158-3.098 1.034c-.69.23-.69 1.206 0 1.435l3.098 1.033.474.158.158.475 1.034 3.1.052.12c.298.566 1.168.526 1.384-.12l1.032-3.1.158-.475.475-.158 3.1-1.033.12-.05c.566-.298.526-1.17-.12-1.385l-3.1-1.034-.475-.158-.158-.475-1.032-3.099h-.001z" clipRule="evenodd"></path>
          </svg>
        </div>
      </span>
    </div>
    <span style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "display": "block",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "9px",
      "fontWeight": "450",
      "height": "14px",
      "letterSpacing": "0.04496px",
      "lineHeight": "14px",
      "marginLeft": "8px",
      "marginRight": "8px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "position": "relative",
      "textAlign": "center",
      "width": "40px",
      "whiteSpace": "nowrap"
    }}>
      <span style={{
        "whiteSpace": "nowrap"
      }}>Agents</span>
    </span>
  </button>;
}
export function GettingStartedInsertsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "2px",
    "display": "flex",
    "flexDirection": "column",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "rowGap": "2px",
    "textAlign": "start",
    "width": "56px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-expanded="false" aria-label="Inserts" type="button" className={className}>
    <div style={{
      "alignItems": "center",
      "display": "flex",
      "height": "32px",
      "justifyContent": "center",
      "width": "32px",
      "borderRadius": "5px"
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0m1 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-6.5-2.5a.5.5 0 0 0-1 0v2h-2a.5.5 0 0 0 0 1h2v2a.5.5 0 0 0 1 0v-2h2a.5.5 0 0 0 0-1h-2z" clipRule="evenodd"></path>
      </svg>
    </div>
    <span style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "display": "block",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "9px",
      "fontWeight": "450",
      "height": "14px",
      "letterSpacing": "0.04496px",
      "lineHeight": "14px",
      "marginLeft": "8px",
      "marginRight": "8px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "position": "relative",
      "textAlign": "center",
      "width": "40px",
      "whiteSpace": "nowrap"
    }}>
      <span style={{
        "whiteSpace": "nowrap"
      }}>Inserts</span>
    </span>
  </button>;
}
export function FileNameButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgba(0, 0, 0, 0.898)",
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Untitled, file name" type="button" className={className}>
                        <span style={{
      "whiteSpace": "nowrap"
    }}>Untitled</span>
                      </button>;
}
export function GettingStartedEditFileMenuButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "borderBottomRightRadius": "5px",
    "borderTopRightRadius": "5px",
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="Edit file menu" type="button" className={className}>
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
          "fill": "rgba(0, 0, 0, 0.898)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
</svg>
                            </span>
                          </button>;
}
export function GettingStartedGridViewButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Grid view" type="button" className={className}>
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M5 6h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1M3 7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm12-1h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2zm6 7h-4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1m-4-1a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2zM5 14h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
                  </svg>
                </span>
              </button>;
}
export function GettingStartedNewSlideButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "borderBottomColor": "rgb(230, 230, 230)",
    "borderBottomLeftRadius": "6px",
    "borderBottomStyle": "solid",
    "borderBottomWidth": "1px",
    "borderLeftColor": "rgb(230, 230, 230)",
    "borderLeftStyle": "solid",
    "borderLeftWidth": "1px",
    "borderTopColor": "rgb(230, 230, 230)",
    "borderTopLeftRadius": "6px",
    "borderTopStyle": "solid",
    "borderTopWidth": "1px",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "padding": "0px 0px 0px 24px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="New slide" aria-description="Add slide from template" aria-haspopup="dialog" aria-expanded="false" type="button" className={className}>
                <p style={{
      "color": "rgb(0, 0, 0)",
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
      }}>New slide</span>
                </p>
                <svg style={{
      "display": "block",
      "height": "16px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "16px"
    }} width="16" height="16" fill="none" viewBox="0 0 16 16">
                  <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
                </svg>
              </button>;
}
export function GettingStartedAddBlankSlideButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "borderBottomRightRadius": "6px",
    "borderTopRightRadius": "6px",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "border": "1px solid rgb(230, 230, 230)",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="Add blank slide" type="button" className={className}>
                <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd"></path>
                </svg>
              </button>;
}
export function GettingStartedCloseButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Close" type="button" className={className}>
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
          </button>;
}
export function GettingStartedAddContextButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px 4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="Add context" aria-haspopup="menu" aria-expanded="false" type="button" className={className}>
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
</button>;
}
export function GettingStartedSelectDeckTemplateButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "4px 8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="Select deck template" type="button" className={className}>
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
                          </button>;
}
export function SendPromptButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Send prompt" type="submit" aria-disabled="true" disabled={true} className={className}>
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
</button>;
}
export function MultiplayerToolsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "center",
    "lineHeight": "16px",
    "outlineColor": "rgba(0, 0, 0, 0)",
    "outlineStyle": "solid",
    "outlineWidth": "2px",
    "textAlign": "center",
    "borderRadius": "50px",
    "padding": "0px 2px 0px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-expanded="false" aria-label="Multiplayer tools" aria-haspopup="dialog" className={className}>
                            <div style={{
      "alignItems": "center",
      "display": "flex"
    }} role="none">
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
                                  <span style={{
            "display": "block"
          }}>
  <span style={{
              "display": "block",
              "position": "relative"
            }}>
    <div style={{
                "alignItems": "center",
                "display": "flex",
                "flexBasis": "30px",
                "flexShrink": "0",
                "height": "40px",
                "justifyContent": "center",
                "position": "relative",
                "width": "24px"
              }}>
      <div style={{
                  "display": "flex"
                }}>
        <svg style={{
                    "bottom": "-20px",
                    "display": "block",
                    "height": "40px",
                    "left": "12px",
                    "overflowX": "hidden",
                    "overflowY": "hidden",
                    "position": "absolute",
                    "right": "-18px",
                    "top": "20px",
                    "transform": "matrix(1, 0, 0, 1, -15, -20)",
                    "transformOrigin": "15px 20px",
                    "width": "30px",
                    "minWidth": "0px",
                    "minHeight": "0px"
                  }} viewBox="0 0 30 40" aria-hidden="true">
          <circle style={{
                      "stroke": "rgb(255, 92, 22)",
                      "strokeWidth": "2px",
                      "strokeDasharray": "400px",
                      "strokeDashoffset": "400px"
                    }} cx="15" cy="20" r="13" fill="none" stroke="var(--color-bg-brand)" strokeWidth="2"></circle>
        </svg>
        <div>
          <div style={{
                      "alignItems": "center",
                      "display": "inline-flex",
                      "flexShrink": "0",
                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                      "fontSize": "12px",
                      "justifyContent": "center",
                      "lineHeight": "24px",
                      "position": "relative",
                      "verticalAlign": "top",
                      "borderRadius": "100%"
                    }} aria-hidden="true">
            <div style={{
                        "alignItems": "center",
                        "color": "rgb(255, 255, 255)",
                        "display": "flex",
                        "flexShrink": "0",
                        "height": "24px",
                        "justifyContent": "center",
                        "minWidth": "24px",
                        "overflowX": "hidden",
                        "overflowY": "hidden",
                        "position": "relative",
                        "verticalAlign": "top",
                        "width": "24px",
                        "borderRadius": "9999px"
                      }} aria-label="Quan Vu (Richard)" role="img">
              <span style={{
                          "display": "block",
                          "fontSize": "13px",
                          "fontWeight": "450",
                          "verticalAlign": "top"
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
                          "verticalAlign": "top",
                          "width": "24px",
                          "minWidth": "0px",
                          "minHeight": "0px"
                        }} src="https://s3-alpha.figma.com/profile/2352a4b9-1db3-49d6-bb4d-651586207271" alt=""></img>
              <span style={{
                          "bottom": "0px",
                          "boxShadow": "rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset",
                          "display": "block",
                          "height": "24px",
                          "left": "0px",
                          "position": "absolute",
                          "right": "0px",
                          "top": "0px",
                          "width": "24px",
                          "minWidth": "0px",
                          "minHeight": "0px",
                          "borderRadius": "9999px"
                        }}></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </span>
</span>
                                </span>
                              </span>
                              <span style={{
        "display": "flex",
        "flexShrink": "0",
        "marginLeft": "-3px",
        "position": "relative"
      }}>
                                <span style={{
          "boxSizing": "content-box",
          "display": "flex",
          "maskImage": "radial-gradient(14px at -3px 50%, rgba(0, 0, 0, 0) 99%, rgb(255, 255, 255) 100%)",
          "padding": "6px",
          "margin": "-6px"
        }}>
                                  <span style={{
            "alignItems": "center",
            "display": "flex"
          }}>
  <div style={{
              "alignItems": "center",
              "backgroundColor": "rgb(245, 245, 245)",
              "boxSizing": "content-box",
              "color": "rgba(0, 0, 0, 0.5)",
              "display": "flex",
              "height": "24px",
              "justifyContent": "center",
              "width": "24px",
              "border": "2px solid rgb(255, 255, 255)",
              "borderRadius": "9999px"
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
                }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
    </svg>
  </div>
</span>
                                </span>
                              </span>
                            </div>
                          </button>;
}
export function GettingStartedProfileAvatar({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "alignItems": "center",
    "color": "rgb(255, 255, 255)",
    "display": "flex",
    "flexShrink": "0",
    "height": "24px",
    "justifyContent": "center",
    "minWidth": "24px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "verticalAlign": "top",
    "width": "24px",
    "borderRadius": "9999px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    ...style
  }} aria-label="Quan Vu (Richard)" role="img" className={className}>
              <span style={{
      "display": "block",
      "fontSize": "13px",
      "fontWeight": "450",
      "verticalAlign": "top"
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
      "verticalAlign": "top",
      "width": "24px",
      "minWidth": "0px",
      "minHeight": "0px"
    }} src="https://s3-alpha.figma.com/profile/2352a4b9-1db3-49d6-bb4d-651586207271" alt=""></img>
              <span style={{
      "bottom": "0px",
      "boxShadow": "rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset",
      "display": "block",
      "height": "24px",
      "left": "0px",
      "position": "absolute",
      "right": "0px",
      "top": "0px",
      "width": "24px",
      "minWidth": "0px",
      "minHeight": "0px",
      "borderRadius": "9999px"
    }}></span>
            </div>;
}
export function PresentButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "32px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "32px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Present" aria-haspopup="dialog" aria-expanded="false" type="button" className={className}>
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
                    </button>;
}
export function ShareButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 92, 22)",
    "color": "rgb(255, 255, 255)",
    "display": "flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "height": "32px",
    "justifyItems": "center",
    "letterSpacing": "0.05504px",
    "lineHeight": "16px",
    "maxWidth": "100%",
    "textAlign": "center",
    "borderRadius": "5px",
    "padding": "0px 12px",
    "width": "64px",
    "minWidth": "64px",
    "flexShrink": "0",
    "boxSizing": "border-box",
    "justifyContent": "center",
    position: "relative",
    ...style
  }} type="button" className={className}>
                        <span style={{
      "display": "flex",
      "height": "32px",
      "width": "auto",
      "flexShrink": "0",
      "alignItems": "center",
      "justifyContent": "center"
    }}>
                          <span style={{
        "alignItems": "center",
        "display": "flex",
        "justifyContent": "center",
        "marginLeft": "0px",
        "marginRight": "0px",
        "overflowX": "visible",
        "overflowY": "visible"
      }}>
                            <span style={{
          "display": "block",
          "overflowX": "visible",
          "overflowY": "visible",
          "textOverflow": "clip",
          "whiteSpace": "nowrap"
        }}>
                              <span style={{
            "display": "contents"
          }}>
                                <span style={{
              "whiteSpace": "nowrap"
            }}>Share</span>
                              </span>
                            </span>
                          </span>
                        </span>
                      </button>;
}
export function DesignTabButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(245, 245, 245)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.898)",
    "display": "grid",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "550",
    "gridTemplateColumns": "37.0156px",
    "gridTemplateRows": "24px",
    "height": "24px",
    "justifyContent": "center",
    "letterSpacing": "0.05504px",
    "lineHeight": "16px",
    "textAlign": "center",
    "whiteSpace": "nowrap",
    "borderRadius": "5px",
    "padding": "0px 8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" role="tab" aria-selected="true" className={className}>
                  <span style={{
      "display": "block",
      "gridColumnStart": "1",
      "gridRowStart": "1",
      "opacity": "0"
    }} aria-hidden="true">
                    <span style={{
        "whiteSpace": "nowrap"
      }}>Design</span>
                  </span>
                  <span style={{
      "display": "block",
      "gridColumnStart": "1",
      "gridRowStart": "1"
    }}>
                    <span style={{
        "whiteSpace": "nowrap"
      }}>Design</span>
                  </span>
                </button>;
}
export function AnimateTabButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.5)",
    "display": "grid",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "gridTemplateColumns": "44.3125px",
    "gridTemplateRows": "24px",
    "height": "24px",
    "justifyContent": "center",
    "letterSpacing": "0.05504px",
    "lineHeight": "16px",
    "textAlign": "center",
    "whiteSpace": "nowrap",
    "borderRadius": "5px",
    "padding": "0px 8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" role="tab" aria-selected="false" className={className}>
                  <span style={{
      "display": "block",
      "fontWeight": "550",
      "gridColumnStart": "1",
      "gridRowStart": "1",
      "opacity": "0"
    }} aria-hidden="true">
                    <span style={{
        "whiteSpace": "nowrap"
      }}>Animate</span>
                  </span>
                  <span style={{
      "display": "block",
      "gridColumnStart": "1",
      "gridRowStart": "1"
    }}>
                    <span style={{
        "whiteSpace": "nowrap"
      }}>Animate</span>
                  </span>
                </button>;
}
export function ZoomAndViewOptionsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontVariant": "tabular-nums",
    "fontVariantNumeric": "tabular-nums",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "marginLeft": "1px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px 4px 4px 12px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="100%, zoom and view options" aria-haspopup="menu" aria-expanded="false" type="button" className={className}>
                  100%
                  <svg style={{
      "display": "block",
      "fontVariant": "tabular-nums",
      "height": "16px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "16px"
    }} width="16" height="16" fill="none" viewBox="0 0 16 16">
                    <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
                  </svg>
                </button>;
}
export function GettingStartedHelpButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "boxShadow": "rgba(0, 0, 0, 0.18) 0px 0px 0.5px 0px, rgba(0, 0, 0, 0.1) 0px 3px 8px 0px, rgba(0, 0, 0, 0.1) 0px 1px 3px 0px",
    "boxSizing": "border-box",
    "color": "rgb(255, 255, 255)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "32px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "32px",
    "border": "1px solid rgba(0, 0, 0, 0)",
    "borderRadius": "100%",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="Help" type="button" className={className}>
    <svg style={{
      "display": "block",
      "height": "32px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "30px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M11.69 16.572q.357 0 .61.254a.83.83 0 0 1 .26.616q0 .236-.12.435a.9.9 0 0 1-.315.32.84.84 0 0 1-.435.114.85.85 0 0 1-.615-.253.85.85 0 0 1-.254-.616.84.84 0 0 1 .254-.616.85.85 0 0 1 .615-.254m.332-10.884q1.002 0 1.763.416.76.41 1.19 1.13.428.712.428 1.635 0 .61-.193 1.111a2.9 2.9 0 0 1-.58.924 4.8 4.8 0 0 1-.954.797 4.6 4.6 0 0 0-.863.718 2.1 2.1 0 0 0-.459.815q-.138.453-.15 1.117c0 .18-.146.326-.326.326h-.44a.326.326 0 0 1-.327-.326q.006-.954.21-1.551.207-.598.604-1.009a5.5 5.5 0 0 1 1.003-.797q.447-.29.748-.61.308-.325.465-.711a2.2 2.2 0 0 0 .163-.852q0-.651-.307-1.14a2.04 2.04 0 0 0-.822-.755 2.45 2.45 0 0 0-1.153-.272q-.603 0-1.129.266a2.15 2.15 0 0 0-1.138 1.483c-.067.3-.312.545-.619.545-.323 0-.588-.269-.53-.587a3.12 3.12 0 0 1 1.678-2.268 3.7 3.7 0 0 1 1.738-.405" clipRule="evenodd"></path>
    </svg>
  </button>;
}
export function AgentsMainMenuButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    "flexShrink": 0,
    position: "relative",
    ...style
  }} aria-label="Main menu" aria-haspopup="menu" aria-expanded="false" type="button" className={className}>
        <svg style={{
      "display": "block",
      "width": 24,
      "height": 24,
      "flexShrink": 0
    }} viewBox="0 0 64 64" preserveAspectRatio="none" aria-hidden="true" width={24} height={24}>
          <path d="M13 57l19-50 19 50" fill="none" stroke="#1A1A1A" strokeWidth={3.063} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"></path>
          <path d="M6 44l52-14" fill="none" stroke="#FF58AE" strokeWidth={2.188} strokeLinecap="round" vectorEffect="non-scaling-stroke"></path>
        </svg>
      </button>;
}
export function AgentsFileButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "2px",
    "display": "flex",
    "flexDirection": "column",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "rowGap": "2px",
    "textAlign": "start",
    "width": "56px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-expanded="false" aria-label="File" type="button" className={className}>
        <div style={{
      "alignItems": "center",
      "display": "flex",
      "height": "32px",
      "justifyContent": "center",
      "width": "32px",
      "borderRadius": "5px"
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.598 5.01a.5.5 0 0 1 .255.136l4 4A.5.5 0 0 1 16.5 10h-4a.5.5 0 0 1-.5-.5V6H8.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 1 1 0v6a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 17.5v-11A1.5 1.5 0 0 1 8.5 5h4zM13 9h2.293L13 6.707z"></path>
          </svg>
        </div>
        <span style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "display": "block",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "9px",
      "fontWeight": "450",
      "height": "14px",
      "letterSpacing": "0.04496px",
      "lineHeight": "14px",
      "marginLeft": "8px",
      "marginRight": "8px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "position": "relative",
      "textAlign": "center",
      "width": "40px",
      "whiteSpace": "nowrap"
    }}>
          <span style={{
        "whiteSpace": "nowrap"
      }}>File</span>
        </span>
      </button>;
}
export function AgentsAgentsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "2px",
    "display": "flex",
    "flexDirection": "column",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "rowGap": "2px",
    "textAlign": "start",
    "width": "56px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-expanded="true" aria-label="Agents" type="button" className={className}>
        <div style={{
      "alignItems": "center",
      "backgroundColor": "rgb(255, 223, 204)",
      "display": "flex",
      "height": "32px",
      "justifyContent": "center",
      "width": "32px",
      "borderRadius": "5px"
    }}>
          <span style={{
        "display": "flex"
      }}>
            <div style={{
          "height": "fit-content",
          "position": "relative",
          "width": "fit-content"
        }}>
              <svg style={{
            "display": "block",
            "height": "24px",
            "maskComposite": "exclude",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "24px"
          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path style={{
              "fill": "rgb(226, 76, 12)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M10.39 6.057c.599-1.407 2.624-1.407 3.222 0l.056.146L14.7 9.302l3.1 1.034c1.6.534 1.6 2.799 0 3.333L14.7 14.7l-1.032 3.1-.055.145c-.618 1.454-2.76 1.406-3.278-.145l-1.034-3.1-3.099-1.032c-1.551-.517-1.6-2.66-.145-3.279l.145-.054 3.099-1.034 1.034-3.1zm2.3.387c-.256-.59-1.123-.59-1.378 0l-.034.087-1.029 3.087-.158.474-.474.158-3.098 1.034c-.69.23-.69 1.206 0 1.435l3.098 1.033.474.158.158.475 1.034 3.1.052.12c.298.566 1.168.526 1.384-.12l1.032-3.1.158-.475.475-.158 3.1-1.033.12-.05c.566-.298.526-1.17-.12-1.385l-3.1-1.034-.475-.158-.158-.475-1.032-3.099h-.001z" clipRule="evenodd"></path>
              </svg>
            </div>
          </span>
        </div>
        <span style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "display": "block",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "9px",
      "fontWeight": "450",
      "height": "14px",
      "letterSpacing": "0.04496px",
      "lineHeight": "14px",
      "marginLeft": "8px",
      "marginRight": "8px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "position": "relative",
      "textAlign": "center",
      "width": "40px",
      "whiteSpace": "nowrap"
    }}>
          <span style={{
        "whiteSpace": "nowrap"
      }}>Agents</span>
        </span>
      </button>;
}
export function AgentsInsertsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "2px",
    "display": "flex",
    "flexDirection": "column",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "rowGap": "2px",
    "textAlign": "start",
    "width": "56px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-expanded="false" aria-label="Inserts" type="button" className={className}>
        <div style={{
      "alignItems": "center",
      "display": "flex",
      "height": "32px",
      "justifyContent": "center",
      "width": "32px",
      "borderRadius": "5px"
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0m1 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-6.5-2.5a.5.5 0 0 0-1 0v2h-2a.5.5 0 0 0 0 1h2v2a.5.5 0 0 0 1 0v-2h2a.5.5 0 0 0 0-1h-2z" clipRule="evenodd"></path>
          </svg>
        </div>
        <span style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "display": "block",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "9px",
      "fontWeight": "450",
      "height": "14px",
      "letterSpacing": "0.04496px",
      "lineHeight": "14px",
      "marginLeft": "8px",
      "marginRight": "8px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "position": "relative",
      "textAlign": "center",
      "width": "40px",
      "whiteSpace": "nowrap"
    }}>
          <span style={{
        "whiteSpace": "nowrap"
      }}>Inserts</span>
        </span>
      </button>;
}
export function AgentsUntitledFileNameButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgba(0, 0, 0, 0.898)",
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Untitled, file name" type="button" className={className}>
        <span style={{
      "whiteSpace": "nowrap"
    }}>Untitled</span>
      </button>;
}
export function AgentsEditFileMenuButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "borderBottomRightRadius": "5px",
    "borderTopRightRadius": "5px",
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="Edit file menu" type="button" className={className}>
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
          "fill": "rgba(0, 0, 0, 0.898)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
              </svg>
            </span>
          </button>;
}
export function AgentsGridViewButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Grid view" type="button" className={className}>
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M5 6h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1M3 7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm12-1h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2zm6 7h-4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1m-4-1a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2zM5 14h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
  </svg>
</span>
                </button>;
}
export function MoreOptionsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="More options" type="button" className={className}>
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
  </button>;
}
export function ImproveTheDeckButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" aria-expanded="false" className={className}>
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
                          </button>;
}
export function AddToTheDeckButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" aria-expanded="false" className={className}>
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
                          </button>;
}
export function PrepareToPresentButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" aria-expanded="false" className={className}>
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
                          </button>;
}
export function UnderstandTheDeckButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" aria-expanded="false" className={className}>
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
                          </button>;
}
export function AgentsAddContextButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Add context" aria-haspopup="menu" aria-expanded="false" type="button" className={className}>
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6"></path>
      </svg>
    </span>
  </button>;
}
export function AgentsSelectDeckTemplateButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-haspopup="dialog" aria-label="Select deck template" aria-expanded="false" type="button" className={className}>
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M7.312 6.803a7 7 0 0 1 9.639.248l.28.298a7 7 0 0 1 1.76 4.998l-.029.38C18.807 14.222 17.446 15 16.242 15H13.5l-.101.01a.5.5 0 0 0-.4.49v.5c0 .82-.338 1.603-.92 2.127-.6.542-1.468.8-2.37.488a7 7 0 0 1-2.362-1.385l-.297-.28a7 7 0 0 1 0-9.9zm8.93.955a6 6 0 0 0-8.485 0l-.212.225a6 6 0 0 0 2.492 9.689c.978.337 1.848-.457 1.953-1.467L12 16v-.499a1.5 1.5 0 0 1 1.5-1.5h2.743l.158-.006c.733-.057 1.391-.513 1.543-1.216l.024-.155a6 6 0 0 0-1.484-4.611zM8.5 12.001a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7-2a1 1 0 1 1-.001 2 1 1 0 0 1 0-2m-6-1.5a1 1 0 1 1 0 2.001 1 1 0 0 1 0-2m3.5-1a1 1 0 1 1 0 2 1 1 0 0 1 0-2"></path>
  </svg>
</span>
                          </button>;
}
export function DictateButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 223, 204)",
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
    "borderRadius": "9999px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Dictate" type="button" className={className}>
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
          "fill": "rgb(226, 76, 12)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M16.5 11.5a.5.5 0 0 1 .5.5 5 5 0 0 1-4.5 4.975V18h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2v-1.025A5 5 0 0 1 7 12a.5.5 0 0 1 1 0 4 4 0 0 0 8 0 .5.5 0 0 1 .5-.5M12 5a3 3 0 0 1 3 3v4l-.004.154a3 3 0 0 1-5.992 0L9 12V8a3 3 0 0 1 3-3m0 1a2 2 0 0 0-2 2v4a2 2 0 1 0 4 0V8a2 2 0 0 0-2-2"></path>
        </svg>
      </span>
    </button>;
}
export function SendButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(217, 217, 217)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "flexShrink": "0",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "start",
    "lineHeight": "16px",
    "textAlign": "center",
    "width": "24px",
    "borderRadius": "9999px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    ...style
  }} aria-disabled="true" type="button" aria-label="Send" className={className}>
      <div style={{
      "alignItems": "center",
      "display": "flex",
      "height": "24px",
      "justifyContent": "center",
      "position": "relative",
      "width": "24px"
    }}>
        <div style={{
        "position": "absolute",
        "minWidth": "0px",
        "minHeight": "0px"
      }}>
          <svg style={{
          "display": "block",
          "flexShrink": "0",
          "height": "24px",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "width": "24px"
        }} width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path style={{
            "fill": "rgb(255, 255, 255)"
          }} fill="var(--fpl-icon-color, var(--color-icon))" d="M11.725 5.582a.5.5 0 0 1 .629.064l4.5 4.5a.5.5 0 1 1-.707.707L12.5 7.208V18a.5.5 0 0 1-1 0V7.207l-3.646 3.647a.5.5 0 1 1-.708-.707l4.5-4.5z"></path>
          </svg>
        </div>
      </div>
    </button>;
}
export function NewChatButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "flex-start",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "14px",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "rowGap": "14px",
    "textAlign": "left",
    "width": "290px",
    "borderRadius": "5px",
    "padding": "8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
          <div style={{
      "flexShrink": "0",
      "height": "32px",
      "position": "relative",
      "width": "32px"
    }}>
            <div style={{
        "alignItems": "center",
        "backgroundColor": "rgb(245, 245, 245)",
        "boxSizing": "content-box",
        "display": "flex",
        "height": "32px",
        "justifyContent": "center",
        "width": "32px",
        "border": "1px solid rgba(0, 0, 0, 0.1)",
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
          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M10.39 6.057c.599-1.407 2.624-1.407 3.222 0l.056.146L14.7 9.302l3.1 1.034c1.6.534 1.6 2.799 0 3.333L14.7 14.7l-1.032 3.1-.055.145c-.618 1.454-2.76 1.406-3.278-.145l-1.034-3.1-3.099-1.032c-1.551-.517-1.6-2.66-.145-3.279l.145-.054 3.099-1.034 1.034-3.1zm2.3.387c-.256-.59-1.123-.59-1.378 0l-.034.087-1.029 3.087-.158.474-.474.158-3.098 1.034c-.69.23-.69 1.206 0 1.435l3.098 1.033.474.158.158.475 1.034 3.1.052.12c.298.566 1.168.526 1.384-.12l1.032-3.1.158-.475.475-.158 3.1-1.033.12-.05c.566-.298.526-1.17-.12-1.385l-3.1-1.034-.475-.158-.158-.475-1.032-3.099h-.001z" clipRule="evenodd"></path>
              </svg>
            </div>
          </div>
          <div style={{
      "columnGap": "2px",
      "display": "flex",
      "flexDirection": "column",
      "flexGrow": "1",
      "rowGap": "2px",
      "minWidth": "0px"
    }}>
            <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "rowGap": "8px",
        "minWidth": "0px"
      }}>
              <div style={{
          "alignItems": "center",
          "columnGap": "4px",
          "display": "flex",
          "flexGrow": "1",
          "rowGap": "4px",
          "minWidth": "0px"
        }}>
                <div style={{
            "color": "rgba(0, 0, 0, 0.898)",
            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
            "fontWeight": "550",
            "letterSpacing": "0.05504px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "textOverflow": "ellipsis",
            "minWidth": "0px",
            "whiteSpace": "nowrap"
          }}>
                  <span style={{
              "whiteSpace": "nowrap"
            }}>New chat</span>
                </div>
              </div>
              <div style={{
          "alignItems": "center",
          "columnGap": "8px",
          "display": "flex",
          "flexShrink": "0",
          "justifyContent": "flex-end",
          "rowGap": "8px"
        }}>
                <div style={{
            "color": "rgba(0, 0, 0, 0.5)",
            "flexShrink": "0",
            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
            "fontWeight": "450",
            "letterSpacing": "0.05504px",
            "maxWidth": "80px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "textOverflow": "ellipsis",
            "whiteSpace": "nowrap"
          }}>
                  <span style={{
              "whiteSpace": "nowrap"
            }}>Just now</span>
                </div>
              </div>
            </div>
            <div style={{
        "color": "rgba(0, 0, 0, 0.5)",
        "display": "-webkit-box",
        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
        "fontWeight": "450",
        "letterSpacing": "0.05504px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textOverflow": "ellipsis",
        "WebkitBoxOrient": "vertical",
        "WebkitLineClamp": "2"
      }}>
              Not started
            </div>
          </div>
        </button>;
}
export function AgentsNewSlideButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "28px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "48px",
    "border": "1px solid rgba(0, 0, 0, 0.1)",
    "borderRadius": "2px",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="New slide" type="button" className={className}>
  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd"></path>
  </svg>
</button>;
}
export function AgentsSlideButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "appearance": "auto",
    "backgroundColor": "rgb(245, 245, 245)",
    "color": "rgb(0, 0, 0)",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "28px",
    "lineHeight": "16px",
    "outlineColor": "rgb(0, 123, 229)",
    "outlineStyle": "solid",
    "outlineWidth": "2px",
    "textAlign": "center",
    "width": "48px",
    "borderRadius": "2px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Slide 1" aria-pressed="true" aria-selected="true" className={className}>
        <div style={{
      "alignItems": "center",
      "display": "inline-flex",
      "height": "28px",
      "justifyContent": "center",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "48px",
      "borderRadius": "2px"
    }}>
          <div style={{
        "display": "flex",
        "height": "28px",
        "position": "relative",
        "width": "48px"
      }}>
            <div style={{
          "alignItems": "center",
          "backgroundColor": "rgb(242, 249, 255)",
          "display": "flex",
          "height": "28px",
          "justifyContent": "center",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "width": "48px"
        }}>
              <div style={{
            "alignItems": "flex-end",
            "boxSizing": "border-box",
            "columnGap": "4px",
            "display": "flex",
            "flexDirection": "column",
            "height": "28px",
            "left": "0px",
            "position": "absolute",
            "rowGap": "4px",
            "top": "0px",
            "width": "48px",
            "zIndex": "1",
            "minWidth": "0px",
            "minHeight": "0px",
            "padding": "4px"
          }}></div>
              <img style={{
            "aspectRatio": "16 / 9",
            "display": "block",
            "height": "28px",
            "objectFit": "cover",
            "overflowX": "clip",
            "overflowY": "clip",
            "width": "48px"
          }} alt="" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWgAAADKCAYAAACIRtqEAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAOdEVYdFNvZnR3YXJlAEZpZ21hnrGWYwAACLRJREFUeAHt3Ytx2zoWBmB5dwtJJ0kqSTqJU0oqidNJUonXx3NPBovLp23p/pn9vhmN9aAIgB79AkEKvHt8cgEgyt2Tf10AiCSgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUL953JDDw8Plx8/fvzPc1++fFldpl/7+PHj8/P39/d/W3729evX57/v37+/fPjw4fIava7ZXh3e0kvas7Sd11RbavnaxuX79++75bzlNgY2PN7I0wf5sYpbuj0F7+/l6n4/3/pxrWPP0jpfaq2+XZenMHu8tpe0Z9yGe7d5+W5T/a3n6za38y23MbCs8vkmPejqcVUvrXWvq5+rnvFWb6x6ddUjrGVSVN3rdqTHmW7cI+i21Pau/0upv3rKcHs3GYPuD3qpL4YKtb61teGEUuFQIbIUEh2UR81fFkdU/avefRvb00MDrymrltlq/1m1rdbqOz7/15f07/e81dDNS7YxsODxBi7TLvWod6N7d3lriGPcpa7d7su0uz4+N+9+Lw2x7O2iby031nOu19GyloYi5qGTpfeP6z8yzLC0TbdeXxsi2arTmXYD+24W0OMHt+5vfWiPBvRlZ2x1LdDq/vx4zV7I7NVrDqy1Op0Jw/FL6MiY/No23Xr9JQF9tN3AMZXPNxniGHed+2yMu7u759tLdu3H99Swx+Nfu+tLQyDj7vY4tNK7/W+xK97rGuvV5Yz1Gsvscsf67w35jGdb1PvG5d9S/b/GYZEe4llztN3AOTc5SNghVB/k+cNaj+t25mDbGKpjSNX9Cv21ZevA19LpZ1Wvtxh/Hds2llXt6nrMp8CNba77vY75gGh/sfVy1wrnl1hr96jq70AjnHPT86DHA1Hds+3gqscvCegzy16rJ7e03rWy9s4DX/ui+FMOum21W0DDOVcP6LHHOJ5K12HdPd5bBNBaeLzk9L29s07WwqjKGkP6JT3LPuvjlj+YOWKv3cBJj1e2d1Drcln/0cS8zNKZHuMZD0tncWwdIFv6EcZS3eaDXPMZJG08OLZV1toZIEtlzttuLPfoD2XOHiQ8W8e1dvePXYDzKp+v3oMee1R9kGvp4NGZXuTYG6v1jT+o2Ft2HmIpe+Pf4/jx3NMfx4L7Z9NbZdV2Hw/CjXUe1z33OLt+VV4fKDwzLHTWWH7Xa63HvtfuvYOMwIrHG1g6Z/kynZbVjp5mt3Sa2tr5wVvlHznNbu221IPdOn1urbe/Vae9tl/jPOi19nf9j/4/trYTsK3y+eZncZS59zj2zKrntnSmR7/Wqic59kz714bjRD5j+f1z8bHsvcl+tg4qrvUmq5wed98qa9wm3TNfWm6r7UctbdMjr4/1O1KnI+0GjrvrpAYgx90T80EDhBLQAKEENEAoAQ0QSkADhBLQAKEENEAoAQ0QSkADhLp6QPfUmH2bJxx62Ljo69YUpK+5yOrDwQvNnp0C9UidjpZ9rffvrXvr8d57j/5fgWOuHtA9R0apv/MVN7bmEN6aw+HIXMhzYPbjtat+zI4sc7ZOW+094hoT34/bZXSmnDP/V+CYm15Rpc09q3GSo35celL6cYrSfq0m+u/JfPr9PRl+rb8n7xkn65l7eK2W6ak758l95smXev39ZTOb69tljY/HZbquXU4/buNyPa3nWMexrPFiAOP9Lr/XvbbOub31/qW6zo/nbTq3ad4+wDH/SEDPM8+VDpGtK28c+XCPYTj34sZyx/tjr3TuoY5fFuN6OvzWXu+rxdSMbkvt/TDsWcxltf7yGduz1oMeA3Wsz7j3smRc59L757rW82vXQ1xq01j2a4al4P9RzEHCvgRWT0a/9NqRD3iHx9nxzwq4KmPpYq3juroutdzDcD3F1xp7n2Odxl7wkq7PfBmtPeP1Ic/ovY2yNoXp0p7KuIcAHPPv+/srXUl1wbt3737/ne///Pnz8u3bt+fQ6Nf69Xq+AqjCoV/rK4T32Gfv9ncQfP78+flvrXdcX62r19PP17Jdxvh8qed+/fr1uyfbPe56T916aKWWGetXf6sHPZc13x+fqzrU3+4h9+v1/KdPn/72vn6t29/16frOZcxl1XJdVm+nedvP7+/l6/3zHkqtr+oy1rX+R+M2mssAlj19br7+kfNB98Tw//R4ZtejvLYua2PQiZaOF6zpbfQntAuS1HzQJuwHCGTCfoBgAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJ6AtAJgENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4T6L8RAeLiOZHZCAAAAAElFTkSuQmCC"></img>
            </div>
          </div>
        </div>
      </button>;
}
export function EditorTextButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Text" aria-pressed="false" type="button" className={className}>
                    <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z"></path>
                    </svg>
                  </button>;
}
export function EditorImageVideoButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Image/video…" aria-pressed="false" type="button" className={className}>
                    <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M18 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM6 5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm2.725 5.582a.5.5 0 0 1 .629.064l6.5 6.5a.5.5 0 1 1-.707.707L9 11.708l-2.146 2.146a.5.5 0 1 1-.708-.707l2.5-2.5zM14.5 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5m0 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"></path>
                    </svg>
                  </button>;
}
export function EditorShapesButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Shapes" aria-pressed="false" type="button" className={className}>
                    <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M3 9c0 1.521.566 2.91 1.5 3.968a6 6 0 0 0 4 2.011.47.47 0 0 0 .5-.479.536.536 0 0 0-.49-.524H8.5a5 5 0 0 1-3.218-1.632A5 5 0 1 1 13.975 8.5l.001.008.013.073A.536.536 0 0 0 14.5 9a.47.47 0 0 0 .48-.5 6 6 0 0 0-2.012-4A6 6 0 0 0 3 9m9 2h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
                    </svg>
                  </button>;
}
export function EditorCommentButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Comment" aria-pressed="false" type="button" className={className}>
                    <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.5 3a8.5 8.5 0 0 1 0 17H7.09c-.89 0-1.39 0-1.767-.121l-.154-.06a2 2 0 0 1-.906-.828l-.082-.16c-.136-.297-.17-.657-.178-1.248L4 16.909V11.5A8.5 8.5 0 0 1 12.5 3m0 1A7.5 7.5 0 0 0 5 11.5v5.41c0 .523 0 .861.02 1.12.018.247.05.34.07.385a1 1 0 0 0 .495.494c.045.02.138.053.386.072.258.019.596.019 1.12.019H12.5a7.5 7.5 0 0 0 0-15"></path>
</svg>
                  </button>;
}
export function EditorActionsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Actions" aria-pressed="false" type="button" className={className}>
                    <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"></path>
</svg>
                  </button>;
}
export function EditorFrameButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.3)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Frame" aria-pressed="false" type="button" aria-disabled="true" className={className}>
                    <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
        "fill": "rgba(0, 0, 0, 0.3)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 4a.5.5 0 0 0-.5.5V7H4.5a.5.5 0 0 0 0 1H7v8H4.5a.5.5 0 0 0 0 1H7v2.5a.5.5 0 0 0 1 0V17h8v2.5a.5.5 0 0 0 1 0V17h2.5a.5.5 0 0 0 0-1H17V8h2.5a.5.5 0 0 0 0-1H17V4.5a.5.5 0 0 0-1 0V7H8V4.5a.5.5 0 0 0-.5-.5M16 8H8v8h8z" clipRule="evenodd"></path>
</svg>
                  </button>;
}
export function EditorCommentButton2({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.3)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Comment" aria-pressed="false" type="button" aria-disabled="true" className={className}>
                    <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
        "fill": "rgba(0, 0, 0, 0.3)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.5 3a8.5 8.5 0 0 1 0 17H7.09c-.89 0-1.39 0-1.767-.121l-.154-.06a2 2 0 0 1-.906-.828l-.082-.16c-.136-.297-.17-.657-.178-1.248L4 16.909V11.5A8.5 8.5 0 0 1 12.5 3m0 1A7.5 7.5 0 0 0 5 11.5v5.41c0 .523 0 .861.02 1.12.018.247.05.34.07.385a1 1 0 0 0 .495.494c.045.02.138.053.386.072.258.019.596.019 1.12.019H12.5a7.5 7.5 0 0 0 0-15"></path>
</svg>
                  </button>;
}
export function EditorActionsButton2({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.3)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Actions" aria-pressed="false" type="button" aria-disabled="true" className={className}>
                    <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
        "fill": "rgba(0, 0, 0, 0.3)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"></path>
</svg>
                  </button>;
}
export function FileFileButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "2px",
    "display": "flex",
    "flexDirection": "column",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "rowGap": "2px",
    "textAlign": "start",
    "width": "56px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-expanded="true" aria-label="File" type="button" className={className}>
        <div style={{
      "alignItems": "center",
      "backgroundColor": "rgb(255, 223, 204)",
      "display": "flex",
      "height": "32px",
      "justifyContent": "center",
      "width": "32px",
      "borderRadius": "5px"
    }}>
          <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path style={{
          "fill": "rgb(226, 76, 12)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.598 5.01a.5.5 0 0 1 .255.136l4 4A.5.5 0 0 1 16.5 10h-4a.5.5 0 0 1-.5-.5V6H8.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 1 1 0v6a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 17.5v-11A1.5 1.5 0 0 1 8.5 5h4zM13 9h2.293L13 6.707z"></path>
          </svg>
        </div>
        <span style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "display": "block",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "9px",
      "fontWeight": "450",
      "height": "14px",
      "letterSpacing": "0.04496px",
      "lineHeight": "14px",
      "marginLeft": "8px",
      "marginRight": "8px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "position": "relative",
      "textAlign": "center",
      "width": "40px",
      "whiteSpace": "nowrap"
    }}>
          <span style={{
        "whiteSpace": "nowrap"
      }}>File</span>
        </span>
      </button>;
}
export function FileAgentsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "2px",
    "display": "flex",
    "flexDirection": "column",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "rowGap": "2px",
    "textAlign": "start",
    "width": "56px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-expanded="false" aria-label="Agents" type="button" className={className}>
        <div style={{
      "alignItems": "center",
      "display": "flex",
      "height": "32px",
      "justifyContent": "center",
      "width": "32px",
      "borderRadius": "5px"
    }}>
          <span style={{
        "display": "flex"
      }}>
            <div style={{
          "height": "fit-content",
          "position": "relative",
          "width": "fit-content"
        }}>
              <svg style={{
            "display": "block",
            "height": "24px",
            "maskComposite": "exclude",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "24px"
          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path style={{
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M10.39 6.057c.599-1.407 2.624-1.407 3.222 0l.056.146L14.7 9.302l3.1 1.034c1.6.534 1.6 2.799 0 3.333L14.7 14.7l-1.032 3.1-.055.145c-.618 1.454-2.76 1.406-3.278-.145l-1.034-3.1-3.099-1.032c-1.551-.517-1.6-2.66-.145-3.279l.145-.054 3.099-1.034 1.034-3.1zm2.3.387c-.256-.59-1.123-.59-1.378 0l-.034.087-1.029 3.087-.158.474-.474.158-3.098 1.034c-.69.23-.69 1.206 0 1.435l3.098 1.033.474.158.158.475 1.034 3.1.052.12c.298.566 1.168.526 1.384-.12l1.032-3.1.158-.475.475-.158 3.1-1.033.12-.05c.566-.298.526-1.17-.12-1.385l-3.1-1.034-.475-.158-.158-.475-1.032-3.099h-.001z" clipRule="evenodd"></path>
              </svg>
            </div>
          </span>
        </div>
        <span style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "display": "block",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "9px",
      "fontWeight": "450",
      "height": "14px",
      "letterSpacing": "0.04496px",
      "lineHeight": "14px",
      "marginLeft": "8px",
      "marginRight": "8px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "position": "relative",
      "textAlign": "center",
      "width": "40px",
      "whiteSpace": "nowrap"
    }}>
          <span style={{
        "whiteSpace": "nowrap"
      }}>Agents</span>
        </span>
      </button>;
}
export function FileGridViewButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Grid view" type="button" className={className}>
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M5 6h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1M3 7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm12-1h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2zm6 7h-4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1m-4-1a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2zM5 14h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
  </svg>
</span>
                  </button>;
}
export function FileNewSlideButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "borderBottomColor": "rgb(230, 230, 230)",
    "borderBottomLeftRadius": "6px",
    "borderBottomStyle": "solid",
    "borderBottomWidth": "1px",
    "borderLeftColor": "rgb(230, 230, 230)",
    "borderLeftStyle": "solid",
    "borderLeftWidth": "1px",
    "borderTopColor": "rgb(230, 230, 230)",
    "borderTopLeftRadius": "6px",
    "borderTopStyle": "solid",
    "borderTopWidth": "1px",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "padding": "0px 0px 0px 24px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="New slide" aria-description="Add slide from template" aria-haspopup="dialog" aria-expanded="false" type="button" className={className}>
                    <p style={{
      "color": "rgb(0, 0, 0)",
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
      }}>New slide</span>
</p>
                    <svg style={{
      "display": "block",
      "height": "16px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "16px"
    }} width="16" height="16" fill="none" viewBox="0 0 16 16">
  <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
</svg>
                  </button>;
}
export function FileAddBlankSlideButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "borderBottomRightRadius": "6px",
    "borderTopRightRadius": "6px",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "border": "1px solid rgb(230, 230, 230)",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="Add blank slide" type="button" className={className}>
                    <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd"></path>
</svg>
                  </button>;
}
export function FileSlideButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "appearance": "auto",
    "backgroundColor": "rgb(217, 217, 217)",
    "color": "rgb(0, 0, 0)",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "lineHeight": "16px",
    "textAlign": "center",
    "width": "224px",
    "borderRadius": "9px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Slide 1" aria-pressed="true" aria-selected="true" className={className}>
      <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "inline-flex",
      "justifyContent": "center",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "224px",
      "borderRadius": "5px",
      "padding": "8px"
    }}>
        <div style={{
        "alignItems": "center",
        "alignSelf": "flex-start",
        "display": "flex",
        "flexDirection": "column",
        "flexShrink": "0",
        "marginRight": "8px",
        "width": "12px"
      }}>
          <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
          "display": "block",
          "fontSize": "13px"
        }}>
            1
          </span>
        </div>
        <div style={{
        "display": "flex",
        "position": "relative",
        "width": "188px"
      }}>
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
        </div>
      </div>
    </button>;
}
export function InsertInsertsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "2px",
    "display": "flex",
    "flexDirection": "column",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "rowGap": "2px",
    "textAlign": "start",
    "width": "56px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-expanded="true" aria-label="Inserts" type="button" className={className}>
        <div style={{
      "alignItems": "center",
      "backgroundColor": "rgb(255, 223, 204)",
      "display": "flex",
      "height": "32px",
      "justifyContent": "center",
      "width": "32px",
      "borderRadius": "5px"
    }}>
          <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path style={{
          "fill": "rgb(226, 76, 12)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0m1 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-6.5-2.5a.5.5 0 0 0-1 0v2h-2a.5.5 0 0 0 0 1h2v2a.5.5 0 0 0 1 0v-2h2a.5.5 0 0 0 0-1h-2z" clipRule="evenodd"></path>
          </svg>
        </div>
        <span style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "display": "block",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "9px",
      "fontWeight": "450",
      "height": "14px",
      "letterSpacing": "0.04496px",
      "lineHeight": "14px",
      "marginLeft": "8px",
      "marginRight": "8px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "position": "relative",
      "textAlign": "center",
      "width": "40px",
      "whiteSpace": "nowrap"
    }}>
          <span style={{
        "whiteSpace": "nowrap"
      }}>Inserts</span>
        </span>
      </button>;
}
export function TableButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "border": "1px solid rgba(0, 0, 0, 0)",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
                  <span style={{
      "alignItems": "center",
      "boxSizing": "content-box",
      "columnGap": "4px",
      "display": "flex",
      "maxWidth": "100%",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "rowGap": "4px",
      "padding": "8px"
    }}>
  <span style={{
        "alignItems": "center",
        "display": "flex"
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
          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M4 14v-4h5v4zm-1 1V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm1-6h5V5H5a1 1 0 0 0-1 1zm6-4v4h10V6a1 1 0 0 0-1-1zm10 5H10v4h10zm0 5H10v4h9a1 1 0 0 0 1-1zM9 19H5a1 1 0 0 1-1-1v-3h5z" clipRule="evenodd"></path>
    </svg>
  </span>
  <span style={{
        "display": "block",
        "flexGrow": "1",
        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
        "fontSize": "13px",
        "fontWeight": "450",
        "letterSpacing": "-0.032px",
        "lineHeight": "22px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textOverflow": "ellipsis",
        "whiteSpace": "nowrap"
      }}>
    <span style={{
          "whiteSpace": "nowrap"
        }}>Table</span>
  </span>
</span>
                </button>;
}
export function CodeBlockButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "border": "1px solid rgba(0, 0, 0, 0)",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <span style={{
      "alignItems": "center",
      "boxSizing": "content-box",
      "columnGap": "4px",
      "display": "flex",
      "maxWidth": "100%",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "rowGap": "4px",
      "padding": "8px"
    }}>
    <span style={{
        "alignItems": "center",
        "display": "flex"
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
          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.354 4.146a.5.5 0 0 1 0 .708L5.207 7l2.147 2.146a.5.5 0 1 1-.708.708l-2.5-2.5a.5.5 0 0 1 0-.708l2.5-2.5a.5.5 0 0 1 .708 0M14 4.5a.5.5 0 0 1 .5-.5H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6.5a.5.5 0 0 1 1 0V18a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3.5a.5.5 0 0 1-.5-.5m-4.354.354a.5.5 0 1 1 .708-.708l2.5 2.5a.5.5 0 0 1 0 .708l-2.5 2.5a.5.5 0 0 1-.708-.708L11.793 7z" clipRule="evenodd"></path>
      </svg>
    </span>
    <span style={{
        "display": "block",
        "flexGrow": "1",
        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
        "fontSize": "13px",
        "fontWeight": "450",
        "letterSpacing": "-0.032px",
        "lineHeight": "22px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textOverflow": "ellipsis",
        "whiteSpace": "nowrap"
      }}>
      <span style={{
          "whiteSpace": "nowrap"
        }}>Code block</span>
    </span>
  </span>
</button>;
}
export function SlideNumberButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "border": "1px solid rgba(0, 0, 0, 0)",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <span style={{
      "alignItems": "center",
      "boxSizing": "content-box",
      "columnGap": "4px",
      "display": "flex",
      "maxWidth": "100%",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "rowGap": "4px",
      "padding": "8px"
    }}>
    <span style={{
        "alignItems": "center",
        "display": "flex"
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
          }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18m0 1a8 8 0 1 0 0 16 8 8 0 0 0 0-16m3.056 3.003a.5.5 0 0 1 .441.553L15.336 9H16.5a.5.5 0 0 1 0 1h-1.274l-.445 4H16.5a.5.5 0 0 1 0 1h-1.83l-.173 1.556a.5.5 0 0 1-.994-.112L13.664 15H9.67l-.173 1.556a.5.5 0 0 1-.994-.112L8.664 15H7.5a.5.5 0 0 1 0-1h1.274l.445-4H7.5a.5.5 0 0 1 0-1h1.83l.173-1.556a.5.5 0 0 1 .994.112L10.336 9h3.994l.173-1.556a.5.5 0 0 1 .553-.441M9.78 14h3.993l.445-4h-3.993z"></path>
      </svg>
    </span>
    <span style={{
        "display": "block",
        "flexGrow": "1",
        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
        "fontSize": "13px",
        "fontWeight": "450",
        "letterSpacing": "-0.032px",
        "lineHeight": "22px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textOverflow": "ellipsis",
        "whiteSpace": "nowrap"
      }}>
      <span style={{
          "whiteSpace": "nowrap"
        }}>Slide number</span>
    </span>
  </span>
</button>;
}
export function InsertTextButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "8px",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "lineHeight": "16px",
    "rowGap": "8px",
    "textAlign": "start",
    "width": "290px",
    "borderRadius": "5px",
    "padding": "8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <div style={{
      "alignItems": "center",
      "backgroundColor": "rgb(189, 227, 255)",
      "display": "flex",
      "flexShrink": "0",
      "height": "56px",
      "justifyContent": "center",
      "width": "56px",
      "borderRadius": "5px"
    }}>
    <img style={{
        "display": "block",
        "height": "48px",
        "overflowX": "clip",
        "overflowY": "clip",
        "width": "48px"
      }} alt="Text" src="https://static.figma.com/uploads/e614e423effbdc48395995943326a08f9627c698"></img>
  </div>
  <div style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontWeight": "450",
      "letterSpacing": "0.05504px"
    }}>
    Text
  </div>
</button>;
}
export function MediaButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "8px",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "lineHeight": "16px",
    "rowGap": "8px",
    "textAlign": "start",
    "width": "290px",
    "borderRadius": "5px",
    "padding": "8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <div style={{
      "alignItems": "center",
      "backgroundColor": "rgb(255, 189, 242)",
      "display": "flex",
      "flexShrink": "0",
      "height": "56px",
      "justifyContent": "center",
      "width": "56px",
      "borderRadius": "5px"
    }}>
    <img style={{
        "display": "block",
        "height": "48px",
        "overflowX": "clip",
        "overflowY": "clip",
        "width": "48px"
      }} alt="Media" src="https://static.figma.com/uploads/70d5d9b596cda9a5ad0a74fb2a86cf7eaa2c7d62"></img>
  </div>
  <div style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontWeight": "450",
      "letterSpacing": "0.05504px"
    }}>
    Media
  </div>
</button>;
}
export function InsertShapesButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "8px",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "lineHeight": "16px",
    "rowGap": "8px",
    "textAlign": "start",
    "width": "290px",
    "borderRadius": "5px",
    "padding": "8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <div style={{
      "alignItems": "center",
      "backgroundColor": "rgb(182, 236, 247)",
      "display": "flex",
      "flexShrink": "0",
      "height": "56px",
      "justifyContent": "center",
      "width": "56px",
      "borderRadius": "5px"
    }}>
    <img style={{
        "display": "block",
        "height": "48px",
        "overflowX": "clip",
        "overflowY": "clip",
        "width": "48px"
      }} alt="Shapes" src="https://static.figma.com/uploads/cd5738b523b4155c28b21b7b3af707b7c587b267"></img>
  </div>
  <div style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontWeight": "450",
      "letterSpacing": "0.05504px"
    }}>
    Shapes
  </div>
</button>;
}
export function PrototypesButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "8px",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "lineHeight": "16px",
    "rowGap": "8px",
    "textAlign": "start",
    "width": "290px",
    "borderRadius": "5px",
    "padding": "8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <div style={{
      "alignItems": "center",
      "backgroundColor": "rgb(180, 178, 255)",
      "display": "flex",
      "flexShrink": "0",
      "height": "56px",
      "justifyContent": "center",
      "width": "56px",
      "borderRadius": "5px"
    }}>
    <img style={{
        "display": "block",
        "height": "48px",
        "overflowX": "clip",
        "overflowY": "clip",
        "width": "48px"
      }} alt="Prototypes" src="https://static.figma.com/uploads/90daffd5edf313ad0d686805b52c6cb6617ec7b9"></img>
  </div>
  <div style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontWeight": "450",
      "letterSpacing": "0.05504px"
    }}>
    Prototypes
  </div>
</button>;
}
export function InteractiveButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "8px",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "lineHeight": "16px",
    "rowGap": "8px",
    "textAlign": "start",
    "width": "290px",
    "borderRadius": "5px",
    "padding": "8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <div style={{
      "alignItems": "center",
      "backgroundColor": "rgb(255, 217, 102)",
      "display": "flex",
      "flexShrink": "0",
      "height": "56px",
      "justifyContent": "center",
      "width": "56px",
      "borderRadius": "5px"
    }}>
    <img style={{
        "display": "block",
        "height": "48px",
        "overflowX": "clip",
        "overflowY": "clip",
        "width": "48px"
      }} alt="Interactive" src="https://static.figma.com/uploads/96f13404e92d659b4ce0645e976e0c8b0039fa05"></img>
  </div>
  <div style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontWeight": "450",
      "letterSpacing": "0.05504px"
    }}>
    Interactive
  </div>
</button>;
}
export function LibrariesButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "8px",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "lineHeight": "16px",
    "rowGap": "8px",
    "textAlign": "start",
    "width": "290px",
    "borderRadius": "5px",
    "padding": "8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <div style={{
      "alignItems": "center",
      "backgroundColor": "rgb(185, 235, 198)",
      "display": "flex",
      "flexShrink": "0",
      "height": "56px",
      "justifyContent": "center",
      "width": "56px",
      "borderRadius": "5px"
    }}>
    <img style={{
        "display": "block",
        "height": "48px",
        "overflowX": "clip",
        "overflowY": "clip",
        "width": "48px"
      }} alt="Libraries" src="https://static.figma.com/uploads/c51212a3c827a5555105b7dae8a2bf8861016a1b"></img>
  </div>
  <div style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontWeight": "450",
      "letterSpacing": "0.05504px"
    }}>
    Libraries
  </div>
</button>;
}
export function MediaUntitledFileNameButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgba(0, 0, 0, 0.898)",
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Untitled, file name" type="button" className={className}>
      <span style={{
      "whiteSpace": "nowrap"
    }}>Untitled</span>
    </button>;
}
export function MediaEditFileMenuButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "borderBottomRightRadius": "5px",
    "borderTopRightRadius": "5px",
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="Edit file menu" type="button" className={className}>
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
          "fill": "rgba(0, 0, 0, 0.898)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
            </svg>
          </span>
        </button>;
}
export function MediaSlideViewButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Slide view" type="button" className={className}>
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 19a.5.5 0 0 1 0 1h-15a.5.5 0 0 1 0-1zM19 8a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM5 15h14V9H5zM19.5 4a.5.5 0 0 1 0 1h-15a.5.5 0 0 1 0-1z"></path>
  </svg>
</span>
                </button>;
}
export function MediaBackButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Back" type="button" className={className}>
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M13.854 7.146a.5.5 0 0 1 0 .708L9.707 12l4.147 4.146a.5.5 0 0 1-.708.708l-4.5-4.5a.5.5 0 0 1 0-.708l4.5-4.5a.5.5 0 0 1 .708 0" clipRule="evenodd"></path>
  </svg>
</span>
                </button>;
}
export function MediaSearchFieldButton({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "alignItems": "center",
    "backgroundColor": "rgb(245, 245, 245)",
    "boxSizing": "border-box",
    "display": "flex",
    "height": "24px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "border": "1px solid rgba(0, 0, 0, 0)",
    "borderRadius": "5px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    flexShrink: 0,
    width: 274,
    ...style
  }} className={className}>
    <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
        "fill": "rgba(0, 0, 0, 0.5)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M11.5 6a5.5 5.5 0 0 1 4.226 9.019l2.127 2.127a.5.5 0 1 1-.707.707l-2.127-2.127A5.5 5.5 0 1 1 11.5 6m0 1a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9"></path>
    </svg>
    <input style={{
      "appearance": "auto",
      "backgroundColor": "rgb(245, 245, 245)",
      "color": "rgba(0, 0, 0, 0.898)",
      "display": "block",
      "flexGrow": "1",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "11px",
      "fontWeight": "450",
      "letterSpacing": "0.05504px",
      "lineHeight": "16px",
      "overflowX": "clip",
      "overflowY": "clip",
      "unicodeBidi": "isolate",
      "padding": "0px"
    }} aria-label="Search stock photos" placeholder="Search images" type="text" value=""></input>
  </div>;
}
export function SearchStockPhotosInput({
  style,
  className
}: AirDesignComponentProps) {
  return <input style={{
    "appearance": "auto",
    "backgroundColor": "rgb(245, 245, 245)",
    "color": "rgba(0, 0, 0, 0.898)",
    "display": "block",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "letterSpacing": "0.05504px",
    "lineHeight": "16px",
    "overflowX": "clip",
    "overflowY": "clip",
    "unicodeBidi": "isolate",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 200,
    ...style
  }} aria-label="Search stock photos" placeholder="Search images" type="text" value="" className={className}></input>;
}
export function MediaThumbnail01({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
                  <img style={{
      "display": "block",
      "height": "199.5px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A woman in a white patterned dress standing against a stone wall covered in ivy" src="https://images.unsplash.com/photo-1793291275774-23ae799f2ac8?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyfHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>;
}
export function MediaThumbnail02({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
                  <img style={{
      "display": "block",
      "height": "200.164px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="Neuschwanstein Castle nestled in a forested mountain landscape with snow-capped peaks in the distance" src="https://images.unsplash.com/photo-1793463986813-7e1b6370ca4a?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw0fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>;
}
export function MediaThumbnail03({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
                  <img style={{
      "display": "block",
      "height": "75.1406px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A short-eared owl in flight over a field of dry golden grass" src="https://images.unsplash.com/photo-1793449162784-fa77abd22ef2?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw3fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>;
}
export function MediaThumbnail04({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
                  <img style={{
      "display": "block",
      "height": "198.164px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A sharp triangular patch of sunlight on a tiled floor and textured wall" src="https://images.unsplash.com/photo-1793531110179-6af052479cc5?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw5fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>;
}
export function MediaThumbnail05({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
                  <img style={{
      "display": "block",
      "height": "199.5px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="An ornate stone colonnade under a clear blue sky, framed by green leaves in golden light" src="https://images.unsplash.com/photo-1793559141324-6e65850719b0?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxMXx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>;
}
export function MediaThumbnail06({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "88.4375px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A bright kitchen with cream cabinets, a stainless steel range, and a marble countertop" src="https://images.unsplash.com/photo-1792980205896-4bc34b91b040?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxM3x8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail07({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "199.5px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A smooth white stone on a textured rock beside a dropper bottle and dried lavender" src="https://images.unsplash.com/photo-1793100123531-4924ea242f5f?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxNnx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail08({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "88.4375px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A wooden dining table with chairs and a bowl of apples in a sunlit room" src="https://images.unsplash.com/photo-1793143765092-dd507da9bffe?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxOHx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail09({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "199.5px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A person petting a happy corgi with its mouth open in front of white flowers" src="https://images.unsplash.com/photo-1793243894460-cc1ad3446e33?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyMHx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail10({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "88.4375px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A sunlit living room with a grey sofa, a television on a tripod, and large windows" src="https://images.unsplash.com/photo-1793362584700-57e1bb2d8bbe?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyM3x8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail11({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "88.4375px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="Coniferous forest with yellowing autumn trees below a rocky mountain peak shrouded in thick fog" src="https://images.unsplash.com/photo-1793296268316-4279a8f9bbc9?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyNHx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail12({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "177.555px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A stack of dark ribbed steel rebar rods viewed from the end" src="https://images.unsplash.com/photo-1793280251985-79ebf452b285?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyNnx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail13({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "99.75px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A large ocean wave breaking with sea spray in the warm golden hour light" src="https://images.unsplash.com/photo-1793296640109-4f7e6e99fa58?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyOXx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail14({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "199.5px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="Evergreen trees against a steep rocky mountainside shrouded in thick grey mist" src="https://images.unsplash.com/photo-1793296225976-dd92eeb74bab?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwzfHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail15({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "199.5px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="Green palm fronds silhouetted against a bright sky with soft white clouds" src="https://images.unsplash.com/photo-1793457984081-2fa841fac172?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw1fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail16({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "199.5px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="Blurred clouds in shades of brown and grey with a hint of blue light" src="https://images.unsplash.com/photo-1793531381574-242097e252f7?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw2fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail17({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "88.4375px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="Low sun over a misty green field with distant trees under a pale sky" src="https://images.unsplash.com/photo-1793531376973-07525fe23962?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxMHx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail18({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "199.5px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A bluethroat bird with a bright blue throat patch singing among tall green reeds" src="https://images.unsplash.com/photo-1793451551758-dc59e0b817b7?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxMnx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail19({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "196.172px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A baby in a plastic seat resting feet on an adult lying on a sandy beach" src="https://images.unsplash.com/photo-1793004196263-c41e5e44fabc?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxNXx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail20({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "88.4375px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A woman in a white headscarf and t-shirt watching colorful koi fish in a pond" src="https://images.unsplash.com/photo-1793067321405-31bad6764f8d?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxN3x8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail21({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "199.5px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="Two people using smartphones in front of a blue and white tiled wall in Porto" src="https://images.unsplash.com/photo-1793363605725-f4dc80e33a34?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxOXx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail22({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "199.5px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A gold necklace, ring, and stud earrings with diamond accents on a white fabric background" src="https://images.unsplash.com/photo-1793054733110-b22c822e97b6?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyMnx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail23({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "177.555px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A 3D render of a modern bedroom with wooden wall panels and a grey bed" src="https://images.unsplash.com/photo-1793378854126-658c2399d99a?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyNXx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MediaThumbnail24({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "88.4375px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="An aerial view of a person in a conical hat walking among many large ceramic fermentation jars" src="https://images.unsplash.com/photo-1793311163171-a4c1632703d3?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyN3x8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
export function MakeAnImageButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgba(0, 0, 0, 0.898)",
    "display": "flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "height": "24px",
    "justifyItems": "center",
    "letterSpacing": "0.05504px",
    "lineHeight": "16px",
    "maxWidth": "100%",
    "outlineColor": "rgba(0, 0, 0, 0.1)",
    "outlineOffset": "-1px",
    "outlineStyle": "solid",
    "outlineWidth": "1px",
    "textAlign": "center",
    "width": "274px",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Make an image" type="button" className={className}>
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
          "alignItems": "center",
          "display": "flex",
          "height": "24px",
          "marginLeft": "-8px",
          "marginRight": "4px"
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
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M13.5 5.999a.5.5 0 0 1 0 1h-6a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 1 1 0v6a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5v-9a1.5 1.5 0 0 1 1.5-1.5zm-3.275 5.082a.5.5 0 0 1 .629.065l4 4a.5.5 0 0 1-.707.706L10.5 12.206l-1.646 1.646a.5.5 0 1 1-.708-.707l2-2zm6.79-6.642c.126-.505.844-.505.97 0L18.3 5.7l1.26.315c.505.126.505.844 0 .97L18.3 7.3l-.315 1.26c-.126.505-.844.505-.97 0L16.7 7.3l-1.26-.315c-.505-.126-.505-.844 0-.97L16.7 5.7z"></path>
          </svg>
        </span>
        <span style={{
          "display": "block",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
          <span style={{
            "display": "contents"
          }}>
            <span style={{
              "whiteSpace": "nowrap"
            }}>Make an image</span>
          </span>
        </span>
      </span>
    </span>
  </button>;
}
export function UploadImageOrVideoButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgba(0, 0, 0, 0.898)",
    "display": "flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "height": "24px",
    "justifyItems": "center",
    "letterSpacing": "0.05504px",
    "lineHeight": "16px",
    "maxWidth": "100%",
    "outlineColor": "rgba(0, 0, 0, 0.1)",
    "outlineOffset": "-1px",
    "outlineStyle": "solid",
    "outlineWidth": "1px",
    "textAlign": "center",
    "width": "274px",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Upload image or video" type="button" className={className}>
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
          "alignItems": "center",
          "display": "flex",
          "height": "24px",
          "marginLeft": "-8px",
          "marginRight": "4px"
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
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M17.5 13a.5.5 0 0 1 .5.5v3a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 16.5v-3a.5.5 0 0 1 1 0v3a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 1 .5-.5m-5.775-7.918a.5.5 0 0 1 .629.064l3.5 3.5a.5.5 0 0 1-.707.708L12.5 6.707V12.5a.5.5 0 0 1-1 0V6.707L8.854 9.354a.5.5 0 1 1-.708-.708l3.5-3.5z"></path>
          </svg>
        </span>
        <span style={{
          "display": "block",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
          <span style={{
            "whiteSpace": "nowrap"
          }}>Upload image or video</span>
        </span>
      </span>
    </span>
  </button>;
}
export function StartWithAnAIDraftButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.3)",
    "display": "flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "13px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "17px",
    "textAlign": "start",
    "border": "1px solid rgba(0, 0, 0, 0.1)",
    "borderRadius": "5px",
    "padding": "0px 36px 0px 4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="Start with an AI draft" type="button" className={className}>
                            <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                              <path style={{
        "fill": "rgba(0, 0, 0, 0.3)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.5 7.001a.5.5 0 0 1 0 1H7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-4.5a.5.5 0 1 1 1 0v4.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm-1 6a.5.5 0 1 1 0 1h-5a.5.5 0 0 1 0-1zm2-3a.5.5 0 1 1 0 1h-7a.5.5 0 0 1 0-1zm2.515-4.56c.126-.505.844-.505.97 0l.315 1.26 1.26.315c.505.126.505.844 0 .97l-1.26.315-.315 1.26c-.126.505-.844.505-.97 0L17.7 8.3l-1.26-.315c-.505-.126-.505-.844 0-.97L17.7 6.7z"></path>
                            </svg>
                            Start with a draft
                          </button>;
}
export function AdjustToneButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Adjust tone" aria-haspopup="dialog" aria-expanded="false" type="button" className={className}>
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18.5 14a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0V15h-1v3h.5a.5.5 0 0 1 0 1h-2a.5.5 0 1 1 0-1h.5v-3h-1v.5a.5.5 0 0 1-1 0v-1a.5.5 0 0 1 .5-.5zM9.62 5.906c.513-1.205 2.248-1.205 2.762 0l.047.125.884 2.656 2.658.886c1.372.458 1.372 2.399 0 2.857l-2.658.884-.884 2.658c-.458 1.372-2.4 1.372-2.857 0l-.885-2.658-2.657-.884c-1.372-.458-1.372-2.4 0-2.857l2.657-.886.885-2.656zm1.825.352.011.028c-.173-.379-.74-.379-.912 0l.012-.028-.937-.352.92.392.005-.012-.035.097.012-.035-.949-.317.937.352-.874 2.62-.158.475-.474.159-2.656.885a.505.505 0 0 0 0 .96l2.656.884.474.158.158.474.886 2.657a.505.505 0 0 0 .959.001L12.364 13l.159-.475.474-.158 2.657-.885a.505.505 0 0 0 0-.959l-3.131-1.044-1.04-3.12.01.025.936-.352-.95.317.004.01-.027-.072.006.012.92-.392z" clipRule="evenodd"></path>
  </svg>
</span>
                      </button>;
}
export function EditTemplateStyleButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "grid",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "550",
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Edit template style" type="button" className={className}>
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M8.5 18a.5.5 0 0 0 .5-.5v-1.55a2.5 2.5 0 0 0 0-4.9V6.5a.5.5 0 0 0-1 0v4.55a2.501 2.501 0 0 0 0 4.9v1.55a.5.5 0 0 0 .5.5m7 0a.5.5 0 0 0 .5-.5v-4.55a2.501 2.501 0 0 0 0-4.9V6.5a.5.5 0 0 0-1 0v1.55a2.5 2.5 0 0 0 0 4.9v4.55a.5.5 0 0 0 .5.5m0-6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m-7 3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3"></path>
  </svg>
</span>
                      </button>;
}
export function StyleOptionsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "48px",
    "lineHeight": "16px",
    "textAlign": "left",
    "width": "208px",
    "border": "1px solid rgb(230, 230, 230)",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" aria-disabled="true" aria-haspopup="listbox" aria-expanded="false" role="combobox" aria-label="Style: Light slides, Fonts: Inter" className={className}>
  <div style={{
      "isolation": "isolate",
      "position": "relative",
      "width": "206px"
    }}>
    <div style={{
        "alignItems": "center",
        "boxSizing": "border-box",
        "display": "flex",
        "height": "46px",
        "position": "relative",
        "width": "206px",
        "padding": "7px"
      }}>
      <div style={{
          "display": "flex",
          "flexShrink": "0",
          "height": "32px",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "width": "32px",
          "borderRadius": "2px"
        }}>
        <div style={{
            "height": "32px",
            "position": "relative",
            "width": "32px"
          }}>
          <div style={{
              "boxSizing": "border-box",
              "height": "32px",
              "left": "0px",
              "position": "absolute",
              "top": "0px",
              "width": "32px",
              "border": "1px solid rgba(0, 0, 0, 0.1)",
              "borderRadius": "2px"
            }}></div>
          <div style={{
              "display": "flex",
              "height": "32px",
              "width": "32px"
            }}>
            <div style={{
                "backgroundColor": "rgb(207, 207, 207)",
                "flexGrow": "1",
                "height": "32px"
              }}></div>
            <div style={{
                "backgroundColor": "rgb(81, 131, 148)",
                "flexGrow": "1",
                "height": "32px"
              }}></div>
            <div style={{
                "backgroundColor": "rgb(61, 56, 245)",
                "flexGrow": "1",
                "height": "32px"
              }}></div>
          </div>
        </div>
        <span style={{
            "bottom": "0px",
            "display": "block",
            "height": "46px",
            "left": "0px",
            "position": "absolute",
            "right": "0px",
            "top": "0px",
            "width": "206px",
            "zIndex": "-1",
            "minWidth": "0px",
            "minHeight": "0px"
          }}></span>
      </div>
      <div style={{
          "alignItems": "center",
          "color": "rgba(0, 0, 0, 0.898)",
          "display": "flex",
          "flexGrow": "1",
          "justifyContent": "space-between",
          "overflowX": "hidden",
          "overflowY": "hidden"
        }}>
        <div style={{
            "flexGrow": "1",
            "marginLeft": "8px",
            "overflowX": "hidden",
            "overflowY": "hidden"
          }}>
          <div style={{
              "fontWeight": "550",
              "height": "16px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "textOverflow": "ellipsis",
              "width": "140px",
              "whiteSpace": "nowrap"
            }}>
            <span style={{
                "whiteSpace": "nowrap"
              }}>Light slides</span>
          </div>
          <div style={{
              "alignItems": "flex-start",
              "display": "flex",
              "height": "16px",
              "scale": "0.7",
              "transformOrigin": "0px 8px",
              "width": "140px"
            }}>
            <div>
              <p style={{
                  "color": "rgba(0, 0, 0, 0.898)",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "15px",
                  "fontWeight": "400",
                  "lineHeight": "16px",
                  "marginBottom": "0px",
                  "marginTop": "0px",
                  "whiteSpace": "nowrap"
                }} aria-hidden="true">
                <span style={{
                    "whiteSpace": "nowrap"
                  }}>Inter</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</button>;
}
export function ColorPickerButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.898)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "textAlign": "start",
    "textOverflow": "ellipsis",
    "width": "208px",
    "whiteSpace": "nowrap",
    "border": "1px solid rgb(230, 230, 230)",
    "borderRadius": "5px",
    "padding": "0px 4px 0px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="Color picker" aria-expanded="false" type="button" className={className}>
    <span style={{
      "display": "flex"
    }}>
      <span style={{
        "alignItems": "center",
        "boxSizing": "content-box",
        "columnGap": "6px",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "paddingLeft": "4px",
        "rowGap": "6px"
      }}>
        <div style={{
          "backgroundColor": "rgb(255, 255, 255)",
          "flexShrink": "0",
          "height": "14px",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "position": "relative",
          "width": "14px",
          "borderRadius": "2px"
        }} aria-hidden="true">
          <div style={{
            "backgroundImage": "url(\"data:image/svg+xml;utf8,%3Csvg%20width%3D%226%22%20height%3D%226%22%20viewBox%3D%220%200%206%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M0%200H3V3H0V0Z%22%20fill%3D%22%23E1E1E1%22/%3E%3Cpath%20d%3D%22M3%200H6V3H3V0Z%22%20fill%3D%22white%22/%3E%3Cpath%20d%3D%22M3%203H6V6H3V3Z%22%20fill%3D%22%23E1E1E1%22/%3E%3Cpath%20d%3D%22M0%203H3V6H0V3Z%22%20fill%3D%22white%22/%3E%3C/svg%3E%0A\")",
            "borderBottomRightRadius": "1px",
            "borderTopRightRadius": "1px",
            "height": "14px",
            "opacity": "0",
            "position": "absolute",
            "right": "0px",
            "top": "0px",
            "width": "7px"
          }}></div>
          <div style={{
            "bottom": "-7px",
            "boxShadow": "rgba(0, 0, 0, 0.1) 0px 0px 0px 2px inset",
            "left": "-7px",
            "position": "absolute",
            "right": "-7px",
            "top": "-7px",
            "transform": "matrix(0.5, 0, 0, 0.5, 0, 0)",
            "transformOrigin": "14px 14px",
            "borderRadius": "20%"
          }}></div>
        </div>
        <div style={{
          "display": "flex",
          "minWidth": "0px"
        }} aria-label="White">
          <div style={{
            "flexShrink": "1000",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "textOverflow": "ellipsis",
            "whiteSpace": "pre-wrap"
          }}>
            <span style={{
              "whiteSpace": "pre"
            }}>Whit</span>
          </div>
          <div style={{
            "flexShrink": "0.5",
            "maxWidth": "80%",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "textOverflow": "ellipsis",
            "whiteSpace": "pre-wrap"
          }}>
            <span style={{
              "whiteSpace": "pre"
            }}>e</span>
          </div>
        </div>
      </span>
    </span>
    <div style={{
      "flexShrink": "0"
    }} aria-hidden="true">
      <svg style={{
        "display": "block",
        "height": "16px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "16px"
      }} width="16" height="16" fill="none" viewBox="0 0 16 16">
        <path style={{
          "fill": "rgba(0, 0, 0, 0.898)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
      </svg>
    </div>
  </button>;
}
export function ColorSwatchBlackButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "height": "24px",
    "justifyItems": "center",
    "lineHeight": "16px",
    "outlineColor": "rgb(230, 230, 230)",
    "outlineOffset": "-1px",
    "outlineStyle": "solid",
    "outlineWidth": "1px",
    "textAlign": "start",
    "minWidth": "0px",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Color Variable Black with value #000 at 100%" type="button" className={className}>
    <div style={{
      "alignItems": "center",
      "display": "flex",
      "height": "14px",
      "justifyContent": "center",
      "lineHeight": "14px",
      "width": "14px",
      "margin": "4px 4px 4px 5px"
    }}>
      <div style={{
        "backgroundColor": "rgb(0, 0, 0)",
        "flexBasis": "14px",
        "flexShrink": "0",
        "height": "14px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "position": "relative",
        "width": "14px",
        "borderRadius": "2px",
        "margin": "4px"
      }} aria-hidden="true">
        <div style={{
          "backgroundImage": "url(\"data:image/svg+xml;utf8,%3Csvg%20width%3D%226%22%20height%3D%226%22%20viewBox%3D%220%200%206%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M0%200H3V3H0V0Z%22%20fill%3D%22%23E1E1E1%22/%3E%3Cpath%20d%3D%22M3%200H6V3H3V0Z%22%20fill%3D%22white%22/%3E%3Cpath%20d%3D%22M3%203H6V6H3V3Z%22%20fill%3D%22%23E1E1E1%22/%3E%3Cpath%20d%3D%22M0%203H3V6H0V3Z%22%20fill%3D%22white%22/%3E%3C/svg%3E%0A\")",
          "borderBottomRightRadius": "1px",
          "borderTopRightRadius": "1px",
          "height": "14px",
          "opacity": "0",
          "position": "absolute",
          "right": "0px",
          "top": "0px",
          "width": "7px"
        }}></div>
      </div>
    </div>
    <div style={{
      "alignContent": "center",
      "boxSizing": "content-box",
      "color": "rgba(0, 0, 0, 0.898)",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "1px",
      "paddingRight": "4px",
      "textOverflow": "ellipsis",
      "width": "128px",
      "whiteSpace": "nowrap"
    }}>
      <div style={{
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textOverflow": "ellipsis"
      }} aria-label="Black">
        <span style={{
          "whiteSpace": "nowrap"
        }}>Black</span>
      </div>
    </div>
  </button>;
}
export function ColorSwatchWhiteButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "height": "24px",
    "justifyItems": "center",
    "lineHeight": "16px",
    "outlineColor": "rgb(230, 230, 230)",
    "outlineOffset": "-1px",
    "outlineStyle": "solid",
    "outlineWidth": "1px",
    "textAlign": "start",
    "minWidth": "0px",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Color Variable White with value #FFF at 100%" type="button" className={className}>
    <div style={{
      "alignItems": "center",
      "display": "flex",
      "height": "14px",
      "justifyContent": "center",
      "lineHeight": "14px",
      "width": "14px",
      "margin": "4px 4px 4px 5px"
    }}>
      <div style={{
        "backgroundColor": "rgb(255, 255, 255)",
        "flexBasis": "14px",
        "flexShrink": "0",
        "height": "14px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "position": "relative",
        "width": "14px",
        "borderRadius": "2px",
        "margin": "4px"
      }} aria-hidden="true">
        <div style={{
          "backgroundImage": "url(\"data:image/svg+xml;utf8,%3Csvg%20width%3D%226%22%20height%3D%226%22%20viewBox%3D%220%200%206%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M0%200H3V3H0V0Z%22%20fill%3D%22%23E1E1E1%22/%3E%3Cpath%20d%3D%22M3%200H6V3H3V0Z%22%20fill%3D%22white%22/%3E%3Cpath%20d%3D%22M3%203H6V6H3V3Z%22%20fill%3D%22%23E1E1E1%22/%3E%3Cpath%20d%3D%22M0%203H3V6H0V3Z%22%20fill%3D%22white%22/%3E%3C/svg%3E%0A\")",
          "borderBottomRightRadius": "1px",
          "borderTopRightRadius": "1px",
          "height": "14px",
          "opacity": "0",
          "position": "absolute",
          "right": "0px",
          "top": "0px",
          "width": "7px"
        }}></div>
        <div style={{
          "bottom": "-7px",
          "boxShadow": "rgba(0, 0, 0, 0.1) 0px 0px 0px 2px inset",
          "left": "-7px",
          "position": "absolute",
          "right": "-7px",
          "top": "-7px",
          "transform": "matrix(0.5, 0, 0, 0.5, 0, 0)",
          "transformOrigin": "14px 14px",
          "borderRadius": "20%"
        }}></div>
      </div>
    </div>
    <div style={{
      "alignContent": "center",
      "boxSizing": "content-box",
      "color": "rgba(0, 0, 0, 0.898)",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "1px",
      "paddingRight": "4px",
      "textOverflow": "ellipsis",
      "width": "128px",
      "whiteSpace": "nowrap"
    }}>
      <div style={{
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textOverflow": "ellipsis"
      }} aria-label="White">
        <span style={{
          "whiteSpace": "nowrap"
        }}>White</span>
      </div>
    </div>
  </button>;
}
export function ShapesMoveButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Move" aria-pressed="false" type="button" className={className}>
      <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
      </svg>
    </button>;
}
export function ShapesMoveToolsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "16px",
    "borderRadius": "5px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Move tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" className={className}>
      <span style={{
      "display": "block"
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
        </svg>
      </span>
    </button>;
}
export function ShapesTextButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Text" aria-pressed="false" type="button" className={className}>
  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z"></path>
  </svg>
</button>;
}
export function ShapesImageVideoButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Image/video…" aria-pressed="false" type="button" className={className}>
  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M18 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM6 5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm2.725 5.582a.5.5 0 0 1 .629.064l6.5 6.5a.5.5 0 1 1-.707.707L9 11.708l-2.146 2.146a.5.5 0 1 1-.708-.707l2.5-2.5zM14.5 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5m0 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"></path>
  </svg>
</button>;
}
export function ShapesShapesButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 92, 22)",
    "boxSizing": "border-box",
    "color": "rgb(255, 255, 255)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Shapes" aria-pressed="true" type="button" className={className}>
  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
        "fill": "rgb(255, 255, 255)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M3 9c0 1.521.566 2.91 1.5 3.968a6 6 0 0 0 4 2.011.47.47 0 0 0 .5-.479.536.536 0 0 0-.49-.524H8.5a5 5 0 0 1-3.218-1.632A5 5 0 1 1 13.975 8.5l.001.008.013.073A.536.536 0 0 0 14.5 9a.47.47 0 0 0 .48-.5 6 6 0 0 0-2.012-4A6 6 0 0 0 3 9m9 2h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
  </svg>
</button>;
}
export function ShapesCommentButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Comment" aria-pressed="false" type="button" className={className}>
  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.5 3a8.5 8.5 0 0 1 0 17H7.09c-.89 0-1.39 0-1.767-.121l-.154-.06a2 2 0 0 1-.906-.828l-.082-.16c-.136-.297-.17-.657-.178-1.248L4 16.909V11.5A8.5 8.5 0 0 1 12.5 3m0 1A7.5 7.5 0 0 0 5 11.5v5.41c0 .523 0 .861.02 1.12.018.247.05.34.07.385a1 1 0 0 0 .495.494c.045.02.138.053.386.072.258.019.596.019 1.12.019H12.5a7.5 7.5 0 0 0 0-15"></path>
  </svg>
</button>;
}
export function ShapesActionsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Actions" aria-pressed="false" type="button" className={className}>
  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"></path>
  </svg>
</button>;
}
export function ShapesMoveButton2({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(13, 153, 255)",
    "boxSizing": "border-box",
    "color": "rgb(255, 255, 255)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Move" aria-pressed="true" type="button" aria-disabled="true" className={className}>
      <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
        "fill": "rgb(255, 255, 255)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
      </svg>
    </button>;
}
export function ShapesMoveToolsButton2({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "16px",
    "borderRadius": "5px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Move tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true" className={className}>
      <span style={{
      "display": "block"
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
        </svg>
      </span>
    </button>;
}
export function ShapesFrameButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.3)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Frame" aria-pressed="false" type="button" aria-disabled="true" className={className}>
  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
        "fill": "rgba(0, 0, 0, 0.3)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 4a.5.5 0 0 0-.5.5V7H4.5a.5.5 0 0 0 0 1H7v8H4.5a.5.5 0 0 0 0 1H7v2.5a.5.5 0 0 0 1 0V17h8v2.5a.5.5 0 0 0 1 0V17h2.5a.5.5 0 0 0 0-1H17V8h2.5a.5.5 0 0 0 0-1H17V4.5a.5.5 0 0 0-1 0V7H8V4.5a.5.5 0 0 0-.5-.5M16 8H8v8h8z" clipRule="evenodd"></path>
  </svg>
</button>;
}
export function ShapesRectangleButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.3)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Rectangle" aria-pressed="false" type="button" aria-disabled="true" className={className}>
      <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
        "fill": "rgba(0, 0, 0, 0.3)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1M6 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" clipRule="evenodd"></path>
      </svg>
    </button>;
}
export function ShapesShapeToolsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "16px",
    "borderRadius": "5px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Shape tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true" className={className}>
      <span style={{
      "display": "block"
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
        </svg>
      </span>
    </button>;
}
export function ShapesPenButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.3)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Pen" aria-pressed="false" type="button" aria-disabled="true" className={className}>
      <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
        "fill": "rgba(0, 0, 0, 0.3)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.886 3.21a1 1 0 0 1 .812-.19l7.698 1.56.338.076a7.67 7.67 0 0 1 5.806 7.266v.346l-.008.329 1.197 1.197a1 1 0 0 1 0 1.414l-5.523 5.522a1 1 0 0 1-1.413 0l-1.198-1.197-.328.008a7.67 7.67 0 0 1-7.612-5.806l-.077-.338L3.02 5.7a1 1 0 0 1 .274-.906l1.5-1.5zm.674 9.99a6.666 6.666 0 0 0 6.383 5.342h.3l.756-.018 1.5 1.5 5.523-5.522-1.5-1.5.018-.756a6.67 6.67 0 0 0-5.048-6.619l-.295-.066L5.5 4l-.396.397 5.16 5.16A3 3 0 0 1 12 9.001 3.001 3.001 0 0 1 12 15a3 3 0 0 1-2.444-4.737l-5.16-5.16L4 5.5zM12 10.001a2 2 0 0 0-2 2l.01.204a2 2 0 0 0 1.786 1.785L12 14a2 2 0 0 0 1.989-1.795l.01-.204a2 2 0 0 0-1.795-1.99z"></path>
      </svg>
    </button>;
}
export function ShapesCreationToolsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "16px",
    "borderRadius": "5px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Creation tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true" className={className}>
      <span style={{
      "display": "block"
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
        </svg>
      </span>
    </button>;
}
export function ShapesTextButton2({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.3)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Text" aria-pressed="false" type="button" aria-disabled="true" className={className}>
      <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
        "fill": "rgba(0, 0, 0, 0.3)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z"></path>
      </svg>
    </button>;
}
export function ShapesTypeToolsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "16px",
    "borderRadius": "5px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Type tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true" className={className}>
      <span style={{
      "display": "block"
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
        </svg>
      </span>
    </button>;
}
export function ShapesCommentButton2({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.3)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Comment" aria-pressed="false" type="button" aria-disabled="true" className={className}>
  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
        "fill": "rgba(0, 0, 0, 0.3)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.5 3a8.5 8.5 0 0 1 0 17H7.09c-.89 0-1.39 0-1.767-.121l-.154-.06a2 2 0 0 1-.906-.828l-.082-.16c-.136-.297-.17-.657-.178-1.248L4 16.909V11.5A8.5 8.5 0 0 1 12.5 3m0 1A7.5 7.5 0 0 0 5 11.5v5.41c0 .523 0 .861.02 1.12.018.247.05.34.07.385a1 1 0 0 0 .495.494c.045.02.138.053.386.072.258.019.596.019 1.12.019H12.5a7.5 7.5 0 0 0 0-15"></path>
  </svg>
</button>;
}
export function ShapesActionsButton2({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.3)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Actions" aria-pressed="false" type="button" aria-disabled="true" className={className}>
  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
        "fill": "rgba(0, 0, 0, 0.3)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"></path>
  </svg>
</button>;
}
export function ShapesAssetsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "inline-flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "9999px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Assets" type="button" aria-disabled="true" className={className}>
    <div style={{
      "color": "rgba(0, 0, 0, 0.3)",
      "borderRadius": "9999px"
    }}>
      <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
          "fill": "rgba(0, 0, 0, 0.3)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd"></path>
      </svg>
    </div>
  </button>;
}
export function ArrowButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Arrow" aria-pressed="false" type="button" className={className}>
            <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12.5 4.5A.5.5 0 0 1 13 4h6.5a.5.5 0 0 1 .5.5V11a.5.5 0 0 1-1 0V5.707L4.854 19.854a.5.5 0 0 1-.708-.708L18.293 5H13a.5.5 0 0 1-.5-.5" clipRule="evenodd"></path>
            </svg>
          </button>;
}
export function LineButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Line" aria-pressed="false" type="button" className={className}>
            <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M19.854 4.146a.5.5 0 0 1 0 .708l-15 15a.5.5 0 0 1-.708-.708l15-15a.5.5 0 0 1 .708 0" clipRule="evenodd"></path>
            </svg>
          </button>;
}
export function SquareButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "24px",
    "borderRadius": "3px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-current="false" aria-label="Square" type="button" className={className}>
                  <span style={{
      "alignItems": "center",
      "display": "flex",
      "filter": "drop-shadow(rgba(0, 0, 0, 0.3) 0px 0px 0.5px) drop-shadow(rgba(0, 0, 0, 0.15) 0px 1px 3px)",
      "height": "24px",
      "justifyContent": "center",
      "scale": "1",
      "transform": "matrix(0.75, 0, 0, 0.75, 0, 0)",
      "transformOrigin": "12px 12px",
      "width": "24px"
    }}>
  <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px",
        "fill": "rgb(61, 56, 245)",
        "stroke": "rgb(43, 39, 172)",
        "strokeWidth": "2px"
      }} width="24" height="24" viewBox="0 0 24 24">
    <rect style={{
          "strokeOpacity": "0.9"
        }} width="23" height="23" x=".5" y=".5" strokeOpacity=".9" rx="2.38"></rect>
  </svg>
</span>
                </button>;
}
export function EllipseButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "24px",
    "borderRadius": "3px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-current="false" aria-label="Ellipse" type="button" className={className}>
                  <span style={{
      "alignItems": "center",
      "display": "flex",
      "filter": "drop-shadow(rgba(0, 0, 0, 0.3) 0px 0px 0.5px) drop-shadow(rgba(0, 0, 0, 0.15) 0px 1px 3px)",
      "height": "24px",
      "justifyContent": "center",
      "scale": "1",
      "transform": "matrix(0.75, 0, 0, 0.75, 0, 0)",
      "transformOrigin": "12px 12px",
      "width": "24px"
    }}>
  <svg style={{
        "display": "block",
        "height": "26px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px",
        "fill": "rgb(61, 56, 245)",
        "stroke": "rgb(43, 39, 172)",
        "strokeWidth": "2px"
      }} width="27" height="26" viewBox="0 0 27 26">
    <circle style={{
          "strokeOpacity": "0.9"
        }} cx="13.5" cy="13" r="12.458" strokeLinecap="square" strokeOpacity=".9"></circle>
  </svg>
</span>
                </button>;
}
export function DiamondButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "24px",
    "borderRadius": "3px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-current="false" aria-label="Diamond" type="button" className={className}>
                  <span style={{
      "alignItems": "center",
      "display": "flex",
      "filter": "drop-shadow(rgba(0, 0, 0, 0.3) 0px 0px 0.5px) drop-shadow(rgba(0, 0, 0, 0.15) 0px 1px 3px)",
      "height": "24px",
      "justifyContent": "center",
      "scale": "1",
      "transform": "matrix(0.75, 0, 0, 0.75, 0, 0)",
      "transformOrigin": "12px 12px",
      "width": "24px"
    }}>
  <svg style={{
        "display": "block",
        "height": "30px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px",
        "fill": "rgb(61, 56, 245)",
        "stroke": "rgb(43, 39, 172)",
        "strokeWidth": "2px"
      }} width="29" height="30" viewBox="0 0 29 30">
    <rect style={{
          "strokeOpacity": "0.9"
        }} width="21" height="21" x="-.383" y="15.106" strokeOpacity=".9" rx="2.556" transform="rotate(-45 -.383 15.106)"></rect>
  </svg>
</span>
                </button>;
}
export function TriangleButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "24px",
    "borderRadius": "3px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-current="false" aria-label="Triangle" type="button" className={className}>
  <span style={{
      "alignItems": "center",
      "display": "flex",
      "filter": "drop-shadow(rgba(0, 0, 0, 0.3) 0px 0px 0.5px) drop-shadow(rgba(0, 0, 0, 0.15) 0px 1px 3px)",
      "height": "24px",
      "justifyContent": "center",
      "scale": "1",
      "transform": "matrix(0.75, 0, 0, 0.75, 0, 0)",
      "transformOrigin": "12px 12px",
      "width": "24px"
    }}>
    <svg style={{
        "display": "block",
        "height": "25px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px",
        "fill": "rgb(61, 56, 245)",
        "stroke": "rgb(43, 39, 172)",
        "strokeWidth": "2px"
      }} width="28" height="25" viewBox="0 0 28 25">
      <path style={{
          "strokeOpacity": "0.9"
        }} stroke="#000" strokeLinejoin="round" strokeOpacity=".9" d="M12.93 1.912c.444-.77 1.554-.77 1.998 0L26.786 22.45c.444.77-.11 1.731-1 1.731H2.072c-.888 0-1.443-.962-1-1.73z"></path>
    </svg>
  </span>
</button>;
}
export function StarButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "24px",
    "borderRadius": "3px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-current="false" aria-label="Star" type="button" className={className}>
  <span style={{
      "alignItems": "center",
      "display": "flex",
      "filter": "drop-shadow(rgba(0, 0, 0, 0.3) 0px 0px 0.5px) drop-shadow(rgba(0, 0, 0, 0.15) 0px 1px 3px)",
      "height": "24px",
      "justifyContent": "center",
      "scale": "1",
      "transform": "matrix(0.75, 0, 0, 0.75, 0, 0)",
      "transformOrigin": "12px 12px",
      "width": "24px"
    }}>
    <svg style={{
        "display": "block",
        "height": "27px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px",
        "fill": "rgb(61, 56, 245)",
        "stroke": "rgb(43, 39, 172)",
        "strokeWidth": "2px"
      }} width="29" height="27" viewBox="0 0 29 27">
      <path style={{
          "strokeOpacity": "0.9"
        }} stroke="#000" strokeOpacity=".9" d="m15.181 1.718 3.16 6.359c.274.552.801.935 1.411 1.025l7.024 1.04c.723.107 1.012.995.49 1.507l-5.071 4.97c-.441.431-.642 1.051-.54 1.66l1.182 7c.122.721-.634 1.27-1.282.932l-6.293-3.287c-.547-.286-1.199-.286-1.745 0L7.223 26.21c-.648.338-1.403-.21-1.282-.931l1.182-7.002c.102-.608-.099-1.228-.54-1.66l-5.07-4.969c-.523-.511-.234-1.4.49-1.507l7.023-1.04c.61-.09 1.137-.473 1.412-1.025l3.159-6.359c.325-.654 1.259-.654 1.584 0Z"></path>
    </svg>
  </span>
</button>;
}
export function PlusButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "24px",
    "borderRadius": "3px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-current="false" aria-label="Plus" type="button" className={className}>
  <span style={{
      "alignItems": "center",
      "display": "flex",
      "filter": "drop-shadow(rgba(0, 0, 0, 0.3) 0px 0px 0.5px) drop-shadow(rgba(0, 0, 0, 0.15) 0px 1px 3px)",
      "height": "24px",
      "justifyContent": "center",
      "scale": "1",
      "transform": "matrix(0.75, 0, 0, 0.75, 0, 0)",
      "transformOrigin": "12px 12px",
      "width": "24px"
    }}>
    <svg style={{
        "display": "block",
        "height": "26px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px",
        "fill": "rgb(61, 56, 245)",
        "stroke": "rgb(43, 39, 172)",
        "strokeWidth": "2px"
      }} width="27" height="26" viewBox="0 0 27 26">
      <path style={{
          "strokeOpacity": "0.9"
        }} stroke="#000" strokeOpacity=".9" d="M7.972 8.083h.5V1.477c0-.54.438-.977.978-.977h7.878c.54 0 .978.438.978.977v6.606h6.606c.54 0 .977.438.977.978v7.878c0 .54-.437.978-.977.978h-6.606v6.606c0 .54-.438.977-.978.977H9.45c-.54 0-.978-.437-.978-.977v-6.606H1.866c-.54 0-.977-.438-.977-.978V9.061c0-.54.438-.978.977-.978z"></path>
    </svg>
  </span>
</button>;
}
export function LeftArrowButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "24px",
    "borderRadius": "3px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-current="false" aria-label="Left arrow" type="button" className={className}>
  <span style={{
      "alignItems": "center",
      "display": "flex",
      "filter": "drop-shadow(rgba(0, 0, 0, 0.3) 0px 0px 0.5px) drop-shadow(rgba(0, 0, 0, 0.15) 0px 1px 3px)",
      "height": "24px",
      "justifyContent": "center",
      "scale": "1",
      "transform": "matrix(0.75, 0, 0, 0.75, 0, 0)",
      "transformOrigin": "12px 12px",
      "width": "24px"
    }}>
    <svg style={{
        "display": "block",
        "height": "25px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px",
        "fill": "rgb(61, 56, 245)",
        "stroke": "rgb(43, 39, 172)",
        "strokeWidth": "2px"
      }} width="33" height="25" viewBox="0 0 33 25">
      <path style={{
          "strokeOpacity": "0.9"
        }} stroke="#000" strokeOpacity=".9" d="M13.786 18.639h-.5v4.416c0 .675-.816 1.013-1.293.536L1.103 12.717c-.297-.296-.297-.776 0-1.072L11.993.77c.477-.477 1.293-.138 1.293.537V5.73H31.1c.419 0 .758.34.758.758v11.392c0 .418-.34.758-.758.758z"></path>
    </svg>
  </span>
</button>;
}
export function RightArrowButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "24px",
    "borderRadius": "3px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-current="false" aria-label="Right arrow" type="button" className={className}>
  <span style={{
      "alignItems": "center",
      "display": "flex",
      "filter": "drop-shadow(rgba(0, 0, 0, 0.3) 0px 0px 0.5px) drop-shadow(rgba(0, 0, 0, 0.15) 0px 1px 3px)",
      "height": "24px",
      "justifyContent": "center",
      "scale": "1",
      "transform": "matrix(0.75, 0, 0, 0.75, 0, 0)",
      "transformOrigin": "12px 12px",
      "width": "24px"
    }}>
    <svg style={{
        "display": "block",
        "height": "25px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px",
        "fill": "rgb(61, 56, 245)",
        "stroke": "rgb(43, 39, 172)",
        "strokeWidth": "2px"
      }} width="33" height="25" viewBox="0 0 33 25">
      <path style={{
          "strokeOpacity": "0.9"
        }} stroke="#000" strokeOpacity=".9" d="M19.213 19.484v-.5H1.4c-.418 0-.758-.34-.758-.759V6.836c0-.42.34-.759.758-.759h17.813V1.653c0-.675.816-1.014 1.294-.537l10.89 10.874c.296.296.296.776 0 1.072l-10.89 10.874c-.478.477-1.294.139-1.294-.537z"></path>
    </svg>
  </span>
</button>;
}
export function SpeechBubbleButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "24px",
    "borderRadius": "3px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-current="false" aria-label="Speech bubble" type="button" className={className}>
  <span style={{
      "alignItems": "center",
      "display": "flex",
      "filter": "drop-shadow(rgba(0, 0, 0, 0.3) 0px 0px 0.5px) drop-shadow(rgba(0, 0, 0, 0.15) 0px 1px 3px)",
      "height": "24px",
      "justifyContent": "center",
      "scale": "1",
      "transform": "matrix(0.75, 0, 0, 0.75, 0, 0)",
      "transformOrigin": "12px 12px",
      "width": "24px"
    }}>
    <svg style={{
        "display": "block",
        "height": "29px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px",
        "fill": "rgb(61, 56, 245)",
        "stroke": "rgb(43, 39, 172)",
        "strokeWidth": "2px"
      }} width="33" height="29" viewBox="0 0 33 29">
      <path style={{
          "strokeOpacity": "0.9"
        }} stroke="#000" strokeOpacity=".9" d="M10 21.392v-.5H2.063c-.437 0-.792-.355-.792-.792V1.684c0-.437.355-.792.792-.792H31.48c.437 0 .792.355.792.792V20.1c0 .437-.355.792-.792.792H19.49l-.141.125-8.034 7.102c-.511.452-1.317.089-1.317-.594z"></path>
    </svg>
  </span>
</button>;
}
export function MoreShapesButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgba(0, 0, 0, 0.898)",
    "display": "flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "height": "24px",
    "justifyItems": "center",
    "letterSpacing": "0.05504px",
    "lineHeight": "16px",
    "maxWidth": "100%",
    "outlineColor": "rgba(0, 0, 0, 0.1)",
    "outlineOffset": "-1px",
    "outlineStyle": "solid",
    "outlineWidth": "1px",
    "textAlign": "center",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
            <span style={{
      "display": "flex",
      "height": "24px",
      "maxWidth": "100%",
      "width": "84.0469px"
    }}>
              <span style={{
        "alignItems": "center",
        "display": "flex",
        "justifyContent": "center",
        "marginLeft": "8px",
        "marginRight": "8px",
        "maxWidth": "100%",
        "overflowX": "hidden",
        "overflowY": "hidden"
      }}>
                <span style={{
          "display": "block",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
  <span style={{
            "display": "contents"
          }}>
    <span style={{
              "whiteSpace": "nowrap"
            }}>More shapes</span>
  </span>
</span>
              </span>
            </span>
          </button>;
}
export function CopyLinkButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="Copy link" type="button" className={className}>
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
                  </button>;
}
export function InviteEmailFieldButton({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "alignContent": "flex-start",
    "columnGap": "4px",
    "display": "flex",
    "flexWrap": "wrap",
    "rowGap": "4px",
    "minWidth": "0px",
    "borderRadius": "3px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 448,
    ...style
  }} className={className}>
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
    </div>;
}
export function InviteEmailsInput({
  style,
  className
}: AirDesignComponentProps) {
  return <input style={{
    "appearance": "auto",
    "backgroundColor": "rgb(245, 245, 245)",
    "boxSizing": "content-box",
    "color": "rgba(0, 0, 0, 0.898)",
    "display": "block",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "lineHeight": "16px",
    "marginLeft": "4px",
    "overflowX": "clip",
    "overflowY": "clip",
    "unicodeBidi": "isolate",
    "border": "1px solid rgba(0, 0, 0, 0)",
    "padding": "3px 3px 3px 0px",
    position: "relative",
    flexShrink: 0,
    width: 200,
    ...style
  }} aria-expanded="false" aria-label="Add comma separated emails to invite" placeholder="Add comma separated emails to invite" role="combobox" value="" className={className}></input>;
}
export function InviteButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "4px 12px",
    position: "relative",
    ...style
  }} type="submit" aria-disabled="true" disabled={true} className={className}>
  Invite
</button>;
}
export function AnyoneCanViewButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px 16px 0px 12px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
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
</button>;
}
export function ShareMoveToFolderButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
    <span style={{
      "whiteSpace": "nowrap"
    }}>Move to folder</span>
  </button>;
}
export function ShareCloseButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Close" type="button" className={className}>
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
      </button>;
}
export function ShareMoreMoveToFolderButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
                  <span style={{
      "whiteSpace": "nowrap"
    }}>Move to folder</span>
                </button>;
}
export function TextUntitledFileNameButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgba(0, 0, 0, 0.898)",
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Untitled, file name" type="button" className={className}>
                <span style={{
      "whiteSpace": "nowrap"
    }}>Untitled</span>
              </button>;
}
export function TextEditFileMenuButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "borderBottomRightRadius": "5px",
    "borderTopRightRadius": "5px",
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="Edit file menu" type="button" className={className}>
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
          "fill": "rgba(0, 0, 0, 0.898)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
    </svg>
  </span>
</button>;
}
export function TextSlideViewButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Slide view" type="button" className={className}>
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 19a.5.5 0 0 1 0 1h-15a.5.5 0 0 1 0-1zM19 8a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM5 15h14V9H5zM19.5 4a.5.5 0 0 1 0 1h-15a.5.5 0 0 1 0-1z"></path>
          </svg>
        </span>
      </button>;
}
export function TextBackButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
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
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Back" type="button" className={className}>
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M13.854 7.146a.5.5 0 0 1 0 .708L9.707 12l4.147 4.146a.5.5 0 0 1-.708.708l-4.5-4.5a.5.5 0 0 1 0-.708l4.5-4.5a.5.5 0 0 1 .708 0" clipRule="evenodd"></path>
          </svg>
        </span>
      </button>;
}
export function AddTextBoxButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgba(0, 0, 0, 0.898)",
    "display": "flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "height": "24px",
    "justifyItems": "center",
    "letterSpacing": "0.05504px",
    "lineHeight": "16px",
    "maxWidth": "100%",
    "outlineColor": "rgba(0, 0, 0, 0.1)",
    "outlineOffset": "-1px",
    "outlineStyle": "solid",
    "outlineWidth": "1px",
    "textAlign": "center",
    "width": "274px",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
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
                "fill": "rgba(0, 0, 0, 0.898)"
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M6 6.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5V9a.5.5 0 0 1-1 0V7h-4.5v10h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2V7H7v2a.5.5 0 0 1-1 0z" clipRule="evenodd"></path>
                </svg>
                <span style={{
              "whiteSpace": "nowrap"
            }}>Add text box</span>
              </span>
            </span>
          </span>
        </span>
      </button>;
}
export function TextTextButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "40px",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "274px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-expanded="true" type="button" className={className}>
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
          "fill": "rgba(0, 0, 0, 0.3)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
  </svg>
</span>
                  <span style={{
      "color": "rgba(0, 0, 0, 0.898)",
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
                </button>;
}
export function TextStyleTitleButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
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
    "padding": "12px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="" type="button" className={className}>
    <span style={{
      display: "flex",
      alignItems: "center",
      width: "100%",
      height: "100%",
      fontFamily: "Inter, sans-serif",
      fontSize: 32,
      fontWeight: 550,
      color: "#222222"
    }}>Title</span>
  </button>;
}
export function TextStyleHeader1Button({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
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
    "padding": "12px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="" type="button" className={className}>
    <span style={{
      display: "flex",
      alignItems: "center",
      width: "100%",
      height: "100%",
      fontFamily: "Inter, sans-serif",
      fontSize: 24,
      fontWeight: 550,
      color: "#222222"
    }}>Header 1</span>
  </button>;
}
export function TextStyleHeader2Button({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
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
    "padding": "12px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="" type="button" className={className}>
    <span style={{
      display: "flex",
      alignItems: "center",
      width: "100%",
      height: "100%",
      fontFamily: "Inter, sans-serif",
      fontSize: 20,
      fontWeight: 550,
      color: "#222222"
    }}>Header 2</span>
  </button>;
}
export function TextStyleHeader3Button({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
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
    "padding": "12px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="" type="button" className={className}>
    <span style={{
      display: "flex",
      alignItems: "center",
      width: "100%",
      height: "100%",
      fontFamily: "Inter, sans-serif",
      fontSize: 16,
      fontWeight: 550,
      color: "#222222"
    }}>Header 3</span>
  </button>;
}
export function TextStyleBody1Button({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
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
    "padding": "12px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="" type="button" className={className}>
    <span style={{
      display: "flex",
      alignItems: "center",
      width: "100%",
      height: "100%",
      fontFamily: "Inter, sans-serif",
      fontSize: 14,
      fontWeight: 400,
      color: "#222222"
    }}>Body 1</span>
  </button>;
}
export function TextStyleBody2Button({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
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
    "padding": "12px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="" type="button" className={className}>
    <span style={{
      display: "flex",
      alignItems: "center",
      width: "100%",
      height: "100%",
      fontFamily: "Inter, sans-serif",
      fontSize: 12,
      fontWeight: 400,
      color: "#222222"
    }}>Body 2</span>
  </button>;
}
export function TextStyleBody3Button({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
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
    "padding": "12px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="" type="button" className={className}>
    <span style={{
      display: "flex",
      alignItems: "center",
      width: "100%",
      height: "100%",
      fontFamily: "Inter, sans-serif",
      fontSize: 11,
      fontWeight: 400,
      color: "#222222"
    }}>Body 3</span>
  </button>;
}
export function TextStyleNoteButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
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
    "padding": "12px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="" type="button" className={className}>
    <span style={{
      display: "flex",
      alignItems: "center",
      width: "100%",
      height: "100%",
      fontFamily: "Inter, sans-serif",
      fontSize: 11,
      fontWeight: 400,
      color: "#222222"
    }}>Note</span>
  </button>;
}
export function FontCombinationsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "40px",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "274px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-expanded="false" type="button" className={className}>
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
          "fill": "rgba(0, 0, 0, 0.3)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M6.768 5.525a.5.5 0 0 1 .707 0l2.121 2.121a.5.5 0 0 1 0 .707l-2.121 2.122a.5.5 0 0 1-.707-.708L8.535 8 6.768 6.232a.5.5 0 0 1 0-.707"></path>
  </svg>
</span>
                  <span style={{
      "color": "rgba(0, 0, 0, 0.5)",
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
                </button>;
}
