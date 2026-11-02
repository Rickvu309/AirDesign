import type { AirDesignProps } from "../types.ts";

export function TableButton({
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
          }} fillRule="evenodd" d="M4 14v-4h5v4zm-1 1V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm1-6h5V5H5a1 1 0 0 0-1 1zm6-4v4h10V6a1 1 0 0 0-1-1zm10 5H10v4h10zm0 5H10v4h9a1 1 0 0 0 1-1zM9 19H5a1 1 0 0 1-1-1v-3h5z" clipRule="evenodd"></path>
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
