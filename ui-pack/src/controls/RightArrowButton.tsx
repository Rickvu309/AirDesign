import type { AirDesignProps } from "../types.ts";

export function RightArrowButton({
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
  }} aria-current="false" aria-label="Right arrow" type="button" className={className} {...rest}>
  <span style={{
      "alignItems": "center",
      "display": "flex",
      "filter": "drop-shadow(var(--ad-ink-subtle, rgba(0, 0, 0, 0.3)) 0px 0px 0.5px) drop-shadow(var(--ad-border-strong, rgba(0, 0, 0, 0.15)) 0px 1px 3px)",
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
        "fill": "var(--ad-accent, rgb(61, 56, 245))",
        "stroke": "var(--ad-accent-strong, rgb(43, 39, 172))",
        "strokeWidth": "2px"
      }} width="33" height="25" viewBox="0 0 33 25">
      <path style={{
          "strokeOpacity": "0.9"
        }} stroke="var(--ad-ink-strong, #000)" strokeOpacity=".9" d="M19.213 19.484v-.5H1.4c-.418 0-.758-.34-.758-.759V6.836c0-.42.34-.759.758-.759h17.813V1.653c0-.675.816-1.014 1.294-.537l10.89 10.874c.296.296.296.776 0 1.072l-10.89 10.874c-.478.477-1.294.139-1.294-.537z"></path>
    </svg>
  </span>
</button>;
}
