import type { AirDesignProps } from "../types.js";

export function InspectorTabsAndZoom({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return <div style={{
    "alignItems": "flex-end",
    "borderBottomColor": "var(--ad-divider, rgb(230, 230, 230))",
    "borderBottomStyle": "solid",
    "borderBottomWidth": "1px",
    "boxSizing": "content-box",
    "display": "flex",
    "height": "32px",
    "justifyContent": "space-between",
    "wordBreak": "keep-all",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    flexShrink: 0,
    width: 240,
    ...style
  }} className={className} {...rest}>
            <div style={{
      "alignItems": "center",
      "boxSizing": "content-box",
      "columnGap": "8px",
      "display": "flex",
      "flexShrink": "0",
      "height": "40px",
      "justifyContent": "flex-start",
      "paddingLeft": "8px",
      "rowGap": "8px"
    }}>
              <div style={{
        "columnGap": "4px",
        "display": "flex",
        "rowGap": "4px"
      }} role="tablist" aria-orientation="horizontal">
                <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
          "boxSizing": "border-box",
          "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
          "padding": "0px 8px"
        }} type="button" role="tab" aria-selected="true">
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
                </button>
                <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
          "boxSizing": "border-box",
          "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
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
          "padding": "0px 8px"
        }} type="button" role="tab" aria-selected="false">
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
                </button>
              </div>
            </div>
            <div style={{
      "alignItems": "center",
      "boxSizing": "content-box",
      "display": "flex",
      "height": "40px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingRight": "8px"
    }}>
              <div style={{
        "display": "contents",
        "minWidth": "0px",
        "minHeight": "0px"
      }} role="presentation">
                <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
          "boxSizing": "border-box",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
          "padding": "4px 4px 4px 12px"
        }} aria-label="100%, zoom and view options" aria-haspopup="menu" aria-expanded="false" type="button">
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
              "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
            }} d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>;
}
