import type { AirDesignProps } from "../types.ts";

export function ShapesShapesButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "var(--ad-brand, rgb(255, 92, 22))",
    "boxSizing": "border-box",
    "color": "var(--ad-surface, rgb(255, 255, 255))",
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
  }} aria-hidden="false" aria-label="Shapes" aria-pressed="true" type="button" className={className} {...rest}>
  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
        "fill": "var(--ad-surface, rgb(255, 255, 255))"
      }} fillRule="evenodd" d="M3 9c0 1.521.566 2.91 1.5 3.968a6 6 0 0 0 4 2.011.47.47 0 0 0 .5-.479.536.536 0 0 0-.49-.524H8.5a5 5 0 0 1-3.218-1.632A5 5 0 1 1 13.975 8.5l.001.008.013.073A.536.536 0 0 0 14.5 9a.47.47 0 0 0 .48-.5 6 6 0 0 0-2.012-4A6 6 0 0 0 3 9m9 2h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
  </svg>
</button>;
}
