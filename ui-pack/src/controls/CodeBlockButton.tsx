import type { AirDesignProps } from "../types.ts";

export function CodeBlockButton({
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
  }} type="button" className={className} {...rest}>
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
            "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
          }} fillRule="evenodd" d="M7.354 4.146a.5.5 0 0 1 0 .708L5.207 7l2.147 2.146a.5.5 0 1 1-.708.708l-2.5-2.5a.5.5 0 0 1 0-.708l2.5-2.5a.5.5 0 0 1 .708 0M14 4.5a.5.5 0 0 1 .5-.5H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6.5a.5.5 0 0 1 1 0V18a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3.5a.5.5 0 0 1-.5-.5m-4.354.354a.5.5 0 1 1 .708-.708l2.5 2.5a.5.5 0 0 1 0 .708l-2.5 2.5a.5.5 0 0 1-.708-.708L11.793 7z" clipRule="evenodd"></path>
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
