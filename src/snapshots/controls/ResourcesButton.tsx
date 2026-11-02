import type { AirDesignProps } from "../types.js";

export function ResourcesButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
  }} type="button" className={className} {...rest}>
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
              "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
            }} fillRule="evenodd" d="M7 7h10a1 1 0 0 1 1 1v2H6V8a1 1 0 0 1 1-1m-1 4v5a1 1 0 0 0 1 1h2v-6zm4 6h7a1 1 0 0 0 1-1v-5h-8zM5 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
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
