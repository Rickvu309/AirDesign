import { lineStroke, shapeFill, shapeStroke } from "@/design/shape-marks-art"

export const basicShapes: Record<string, string> = {
  square: '<rect x="3" y="3" width="18" height="18" rx="2.5"/>',
  circle: '<circle cx="12" cy="12" r="9.5"/>',
  diamond: '<path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/>',
  triangle: '<path d="M12 3 21.5 20.5H2.5z"/>',
  star: '<path d="m12 2.5 2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/>',
  plus: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  arrowl: '<path d="M10 4 3 12l7 8v-5h11V9H10z"/>',
  arrowr: '<path d="M14 4l7 8-7 8v-5H3V9h11z"/>',
  bubble: '<path d="M3 4h18v12H10l-5 4v-4H3z"/>',
  tridown: '<path d="M2.5 3.5h19L12 21z"/>',
  pill: '<rect x="2.5" y="6" width="19" height="12" rx="6"/>',
  pentagon: '<path d="m12 2.5 9.5 7-3.6 11.5H6.1L2.5 9.5z"/>',
  octagon: '<path d="M8 2.5h8l5.5 5.5v8L16 21.5H8L2.5 16V8z"/>',
  chevron: '<path d="M3 5h13l5 7-5 7H3l5-7z"/>',
}

export const trayShapes = ["square", "circle", "diamond", "triangle", "star", "plus", "arrowl", "arrowr", "bubble"]

export function ShapeSvg({ markup, size, stroke = shapeStroke }: { markup: string; size: number; stroke?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      fill={shapeFill}
      stroke={stroke}
      strokeWidth="1"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}

export function LineArt({ arrow, size }: { arrow: boolean; size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      fill="none"
      stroke={lineStroke}
      strokeWidth={size > 24 ? 1.5 : 1.6}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M5 19 19 5" />
      {arrow ? <path d="M11 5h8v8" /> : null}
    </svg>
  )
}
