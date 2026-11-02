import type { AirDesignProps } from "../types.js";

export function SelectOrangeIcon({
  style,
  className,
  ...rest
}: AirDesignProps<"svg">) {
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
  }} width="24" height="24" fill="none" viewBox="0 0 24 24" className={className} {...rest}>
                            <path style={{
      "fill": "var(--ad-brand-strong, rgb(226, 76, 12))"
    }} d="M11.127 12.852c-.423-1.08.643-2.147 1.724-1.724l5.316 2.089c1.17.46 1.108 2.138-.096 2.509l-1.795.551-.551 1.795c-.37 1.204-2.05 1.266-2.51.096zm1.358-.793a.33.33 0 0 0-.427.427l2.089 5.316a.33.33 0 0 0 .622-.024l.708-2.3 2.3-.708a.33.33 0 0 0 .024-.622zM6.5 14a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 1 0 1h-2A1.5 1.5 0 0 1 6 16.5v-2a.5.5 0 0 1 .5-.5m3-8a.5.5 0 0 1 0 1h-2a.5.5 0 0 0-.5.5v2a.5.5 0 0 1-1 0v-2A1.5 1.5 0 0 1 7.5 6zm7 0A1.5 1.5 0 0 1 18 7.5v2a.5.5 0 0 1-1 0v-2a.5.5 0 0 0-.5-.5h-2a.5.5 0 0 1 0-1z"></path>
                          </svg>;
}
