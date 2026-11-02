import type { AirDesignProps } from "../types.js";

export function NotificationsButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
  }} aria-haspopup="menu" aria-label="Notifications, new notification received" aria-expanded="false" type="button" className={className} {...rest}>
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
        }} cx="16.5" cy="7.5" r="2.5"></circle>
          <path style={{
          "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
        }} d="M12 5a1 1 0 0 1 .991 1.124q.131.035.258.077a3.5 3.5 0 0 0-.233.979A3 3 0 0 0 9 10v1.172l-.009.338A6.83 6.83 0 0 1 7 16h10a6.83 6.83 0 0 1-1.991-4.49L15 11.172v-.509c.31.148.647.25 1 .3v.209c0 1.546.614 3.028 1.707 4.121A1 1 0 0 1 17 17h-3a2 2 0 1 1-4 0H7a1 1 0 0 1-.707-1.707A5.83 5.83 0 0 0 8 11.172V10a4 4 0 0 1 3.008-3.876A1 1 0 0 1 12 5m-1 12a1 1 0 1 0 2 0z"></path>
        </svg>
      </div>
    </button>;
}
