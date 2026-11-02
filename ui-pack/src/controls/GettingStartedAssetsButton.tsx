import type { AirDesignProps } from "../types.ts";

export function GettingStartedAssetsButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
  }} aria-hidden="true" aria-label="Assets" type="button" aria-disabled="true" className={className} {...rest}>
  <div style={{
      "color": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))",
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
          "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
        }} fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd"></path>
    </svg>
  </div>
</button>;
}
