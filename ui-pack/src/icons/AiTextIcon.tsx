import type { AirDesignComponentProps } from "../types.ts";

export function AiTextIcon({
  style,
  className
}: AirDesignComponentProps) {
  return <svg style={{
    "display": "block",
    "height": "24px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 24,
    ...style
  }} width="24" height="24" fill="none" viewBox="0 0 24 24" className={className}>
    <path style={{
      "fill": "rgba(0, 0, 0, 0.898)"
    }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18.5 14a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0V15h-1v3h.5a.5.5 0 0 1 0 1h-2a.5.5 0 1 1 0-1h.5v-3h-1v.5a.5.5 0 0 1-1 0v-1a.5.5 0 0 1 .5-.5zM9.62 5.906c.513-1.205 2.248-1.205 2.762 0l.047.125.884 2.656 2.658.886c1.372.458 1.372 2.399 0 2.857l-2.658.884-.884 2.658c-.458 1.372-2.4 1.372-2.857 0l-.885-2.658-2.657-.884c-1.372-.458-1.372-2.4 0-2.857l2.657-.886.885-2.656zm1.825.352.011.028c-.173-.379-.74-.379-.912 0l.012-.028-.937-.352.92.392.005-.012-.035.097.012-.035-.949-.317.937.352-.874 2.62-.158.475-.474.159-2.656.885a.505.505 0 0 0 0 .96l2.656.884.474.158.158.474.886 2.657a.505.505 0 0 0 .959.001L12.364 13l.159-.475.474-.158 2.657-.885a.505.505 0 0 0 0-.959l-3.131-1.044-1.04-3.12.01.025.936-.352-.95.317.004.01-.027-.072.006.012.92-.392z" clipRule="evenodd"></path>
  </svg>;
}
