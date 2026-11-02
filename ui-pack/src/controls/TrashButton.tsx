import type { AirDesignComponentProps } from "../types.ts";

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
