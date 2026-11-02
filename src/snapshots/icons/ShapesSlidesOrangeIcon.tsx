import type { AirDesignProps } from "../types.js";

export function ShapesSlidesOrangeIcon({
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
    }} fillRule="evenodd" d="M7 7h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1m1.68 9H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1.68l.662 2.365a.5.5 0 0 1-.963.27L14.28 16H9.719l-.738 2.635a.5.5 0 0 1-.962-.27zM8.5 8.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2m0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2" clipRule="evenodd"></path>
</svg>;
}
