export type ShapeArt =
  | { kind: "box"; x: number; y: number; w: number; h: number; radius: string }
  | { kind: "svg"; x: number; y: number; markup: string }

export const shapeArt: ShapeArt[][] = [
  [
    { kind: "svg", x: 26.42, y: 26.42, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="5.42 5.42 15.16 15.16" width="15.16" height="15.16" overflow="visible" preserveAspectRatio="none"><line x1="5.42" y1="20.58" x2="20.58" y2="5.42" fill="none" stroke="#222222" stroke-width="1.63" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 26.42, y: 26.42, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="5.42 5.42 15.16 15.16" width="15.16" height="15.16" overflow="visible" preserveAspectRatio="none"><line x1="5.42" y1="20.58" x2="20.58" y2="5.42" fill="none" stroke="#222222" stroke-width="1.63" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
    { kind: "svg", x: 32.92, y: 26.42, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="11.92 5.42 8.66 8.66" width="8.66" height="8.66" overflow="visible" preserveAspectRatio="none"><path d="M11.92,5.42 L20.58,5.42 L20.58,14.08" fill="none" stroke="#222222" stroke-width="1.63" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "box", x: 22.75, y: 22.75, w: 22.5, h: 22.5, radius: "2.5px" },
  ],
  [
    { kind: "box", x: 22.13, y: 22.13, w: 23.75, h: 23.75, radius: "50%" },
  ],
  [
    { kind: "svg", x: 22.13, y: 22.13, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.13 3.13 23.75 23.75" width="23.75" height="23.75" overflow="visible" preserveAspectRatio="none"><path d="M15,3.13 L26.88,15 L15,26.88 L3.13,15 L15,3.13 Z" fill="#4d94fb" stroke="none"/> <path d="M15,3.13 L26.88,15 L15,26.88 L3.13,15 L15,3.13 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 22.13, y: 22.75, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.13 3.75 23.75 21.88" width="23.75" height="21.88" overflow="visible" preserveAspectRatio="none"><path d="M15,3.75 L26.88,25.63 L3.13,25.63 L15,3.75 Z" fill="#4d94fb" stroke="none"/> <path d="M15,3.75 L26.88,25.63 L3.13,25.63 L15,3.75 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 22.13, y: 23.38, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.13 4.38 23.75 21.87" width="23.75" height="21.87" overflow="visible" preserveAspectRatio="none"><path d="M3.13,4.38 L26.88,4.38 L15,26.25 L3.13,4.38 Z" fill="#4d94fb" stroke="none"/> <path d="M3.13,4.38 L26.88,4.38 L15,26.25 L3.13,4.38 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "box", x: 22.13, y: 26.5, w: 23.75, h: 15, radius: "6px" },
  ],
  [
    { kind: "svg", x: 22.13, y: 22.13, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.13 3.13 23.75 23.12" width="23.75" height="23.12" overflow="visible" preserveAspectRatio="none"><path d="M15,3.13 L26.88,11.88 L22.38,26.25 L7.63,26.25 L3.13,11.88 L15,3.13 Z" fill="#4d94fb" stroke="none"/> <path d="M15,3.13 L26.88,11.88 L22.38,26.25 L7.63,26.25 L3.13,11.88 L15,3.13 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 22.13, y: 22.13, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.13 3.13 23.75 23.75" width="23.75" height="23.75" overflow="visible" preserveAspectRatio="none"><path d="M10,3.13 L20,3.13 L26.88,10 L26.88,20 L20,26.88 L10,26.88 L3.13,20 L3.13,10 L10,3.13 Z" fill="#4d94fb" stroke="none"/> <path d="M10,3.13 L20,3.13 L26.88,10 L26.88,20 L20,26.88 L10,26.88 L3.13,20 L3.13,10 L10,3.13 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 22.75, y: 22.75, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.75 3.75 22.5 22.5" width="22.5" height="22.5" overflow="visible" preserveAspectRatio="none"><path d="M11.25,3.75 L18.75,3.75 L18.75,11.25 L26.25,11.25 L26.25,18.75 L18.75,18.75 L18.75,26.25 L11.25,26.25 L11.25,18.75 L3.75,18.75 L3.75,11.25 L11.25,11.25 L11.25,3.75 Z" fill="#4d94fb" stroke="none"/> <path d="M11.25,3.75 L18.75,3.75 L18.75,11.25 L26.25,11.25 L26.25,18.75 L18.75,18.75 L18.75,26.25 L11.25,26.25 L11.25,18.75 L3.75,18.75 L3.75,11.25 L11.25,11.25 L11.25,3.75 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 22.75, y: 24, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.75 5 22.5 20" width="22.5" height="20" overflow="visible" preserveAspectRatio="none"><path d="M3.75,15 L12.5,5 L12.5,11.25 L26.25,11.25 L26.25,18.75 L12.5,18.75 L12.5,25 L3.75,15 Z" fill="#4d94fb" stroke="none"/> <path d="M12.5,5 L3.75,15 L12.5,25 L12.5,18.75 L26.25,18.75 L26.25,11.25 L12.5,11.25 L12.5,5 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 22.75, y: 24, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.75 5 22.5 20" width="22.5" height="20" overflow="visible" preserveAspectRatio="none"><path d="M17.5,5 L26.25,15 L17.5,25 L17.5,18.75 L3.75,18.75 L3.75,11.25 L17.5,11.25 L17.5,5 Z" fill="#4d94fb" stroke="none"/> <path d="M17.5,5 L26.25,15 L17.5,25 L17.5,18.75 L3.75,18.75 L3.75,11.25 L17.5,11.25 L17.5,5 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 22.75, y: 25.25, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.75 6.25 22.5 17.5" width="22.5" height="17.5" overflow="visible" preserveAspectRatio="none"><path d="M3.75,6.25 L20,6.25 L26.25,15 L20,23.75 L3.75,23.75 L10,15 L3.75,6.25 Z" fill="#4d94fb" stroke="none"/> <path d="M3.75,6.25 L20,6.25 L26.25,15 L20,23.75 L3.75,23.75 L10,15 L3.75,6.25 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 22.13, y: 22.13, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.13 3.13 23.75 22.75" width="23.75" height="22.75" overflow="visible" preserveAspectRatio="none"><path d="M15,3.13 L18.63,10.88 L26.88,11.88 L20.75,17.63 L22.38,25.88 L15,21.75 L7.63,25.88 L9.25,17.63 L3.13,11.88 L11.38,10.88 L15,3.13 Z" fill="#4d94fb" stroke="none"/> <path d="M15,3.13 L18.63,10.88 L26.88,11.88 L20.75,17.63 L22.38,25.88 L15,21.75 L7.63,25.88 L9.25,17.63 L3.13,11.88 L11.38,10.88 L15,3.13 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 22.75, y: 24, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.75 5 22.5 20" width="22.5" height="20" overflow="visible" preserveAspectRatio="none"><path d="M3.75,5 L26.25,5 L26.25,20 L12.5,20 L6.25,25 L6.25,20 L3.75,20 L3.75,5 Z" fill="#4d94fb" stroke="none"/> <path d="M3.75,5 L26.25,5 L26.25,20 L12.5,20 L6.25,25 L6.25,20 L3.75,20 L3.75,5 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 22.75, y: 26.5, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.75 7.5 22.5 15" width="22.5" height="15" overflow="visible" preserveAspectRatio="none"><path d="M9.38,7.5 L26.25,7.5 L20.63,22.5 L3.75,22.5 L9.38,7.5 Z" fill="#4d94fb" stroke="none"/> <path d="M9.38,7.5 L26.25,7.5 L20.63,22.5 L3.75,22.5 L9.38,7.5 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 22.75, y: 26.5, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.75 7.5 22.5 15" width="22.5" height="15" overflow="visible" preserveAspectRatio="none"><path d="M3.75,7.5 L20.63,7.5 L26.25,22.5 L9.38,22.5 L3.75,7.5 Z" fill="#4d94fb" stroke="none"/> <path d="M3.75,7.5 L20.63,7.5 L26.25,22.5 L9.38,22.5 L3.75,7.5 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 24, y: 22.75, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="5 3.75 20 22.5" width="20" height="22.5" overflow="visible" preserveAspectRatio="none"><path d="M5,7.5 C5,5.37 9.5,3.75 15,3.75 C20.5,3.75 25,5.37 25,7.5 L25,22.5 C25,24.63 20.5,26.25 15,26.25 C9.5,26.25 5,24.63 5,22.5 L5,7.5 Z" fill="#4d94fb" stroke="none"/> <path d="M5,7.5 C5,5.37 9.5,3.75 15,3.75 C20.5,3.75 25,5.37 25,7.5 L25,22.5 C25,24.63 20.5,26.25 15,26.25 C9.5,26.25 5,24.63 5,22.5 L5,7.5 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
    { kind: "svg", x: 24, y: 26.5, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="5 7.5 20 3.75" width="20" height="3.75" overflow="visible" preserveAspectRatio="none"><path d="M5,7.5 C5,9.63 9.5,11.25 15,11.25 C20.5,11.25 25,9.63 25,7.5" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 22.75, y: 25.25, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.75 6.25 22.5 17.5" width="22.5" height="17.5" overflow="visible" preserveAspectRatio="none"><path d="M7.5,6.25 L22.5,6.25 C24.63,6.25 26.25,10.12 26.25,15 C26.25,19.88 24.63,23.75 22.5,23.75 L7.5,23.75 C5.37,23.75 3.75,19.88 3.75,15 C3.75,10.12 5.37,6.25 7.5,6.25 Z" fill="#4d94fb" stroke="none"/> <path d="M7.5,6.25 L22.5,6.25 C24.63,6.25 26.25,10.12 26.25,15 C26.25,19.88 24.63,23.75 22.5,23.75 L7.5,23.75 C5.37,23.75 3.75,19.88 3.75,15 C3.75,10.12 5.37,6.25 7.5,6.25 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
    { kind: "svg", x: 37.75, y: 25.25, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="18.75 6.25 3.75 17.5" width="3.75" height="17.5" overflow="visible" preserveAspectRatio="none"><path d="M22.5,6.25 C20.37,6.25 18.75,10.12 18.75,15 C18.75,19.88 20.37,23.75 22.5,23.75" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 24, y: 24, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="5 5 20 20" width="20" height="20" overflow="visible" preserveAspectRatio="none"><path d="M5,5 L18.75,5 L25,11.25 L25,25 L5,25 L5,5 Z" fill="#4d94fb" stroke="none"/> <path d="M5,5 L18.75,5 L25,11.25 L25,25 L5,25 L5,5 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
    { kind: "svg", x: 37.75, y: 24, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="18.75 5 6.25 6.25" width="6.25" height="6.25" overflow="visible" preserveAspectRatio="none"><path d="M18.75,5 L18.75,11.25 L25,11.25" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 22.75, y: 25.25, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.75 6.25 22.5 17.5" width="22.5" height="17.5" overflow="visible" preserveAspectRatio="none"><path d="M3.75,6.25 L11.25,6.25 L13.75,9.38 L26.25,9.38 L26.25,23.75 L3.75,23.75 L3.75,6.25 Z" fill="#4d94fb" stroke="none"/> <path d="M3.75,6.25 L11.25,6.25 L13.75,9.38 L26.25,9.38 L26.25,23.75 L3.75,23.75 L3.75,6.25 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
    { kind: "svg", x: 22.75, y: 28.25, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.75 9.25 22.5 4" width="22.5" height="4" overflow="visible" preserveAspectRatio="none"><line x1="3.75" y1="11.25" x2="26.25" y2="11.25" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 24, y: 25.25, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="5 6.25 20 15.4" width="20" height="15.4" overflow="visible" preserveAspectRatio="none"><path d="M5,6.25 L25,6.25 L25,20 C21.25,20 18.75,17.5 15,20 C11.25,22.5 8.75,21.88 5,20 L5,6.25 Z" fill="#4d94fb" stroke="none"/> <path d="M5,6.25 L25,6.25 L25,20 C21.25,20 18.75,17.5 15,20 C11.25,22.5 8.75,21.88 5,20 L5,6.25 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 27.75, y: 22.75, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="8.75 3.75 17.5 13.75" width="17.5" height="13.75" overflow="visible" preserveAspectRatio="none"><path d="M8.75,3.75 L26.25,3.75 L26.25,17.5 C22.5,17.5 20,15 17.5,17.5 L8.75,3.75 Z" fill="#4d94fb" stroke="none"/> <path d="M8.75,3.75 L26.25,3.75 L26.25,17.5 C22.5,17.5 20,15 17.5,17.5 L8.75,3.75 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
    { kind: "svg", x: 22.75, y: 27.75, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.75 8.75 17.5 15.4" width="17.5" height="15.4" overflow="visible" preserveAspectRatio="none"><path d="M3.75,8.75 L21.25,8.75 L21.25,22.5 C17.5,22.5 15,20 12.5,22.5 C10,25 7.5,24.38 3.75,22.5 L3.75,8.75 Z" fill="#4d94fb" stroke="none"/> <path d="M3.75,8.75 L21.25,8.75 L21.25,22.5 C17.5,22.5 15,20 12.5,22.5 C10,25 7.5,24.38 3.75,22.5 L3.75,8.75 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "box", x: 22.75, y: 25.25, w: 22.5, h: 17.5, radius: "1px" },
    { kind: "svg", x: 27.75, y: 25.25, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="8.75 6.25 12.5 17.5" width="12.5" height="17.5" overflow="visible" preserveAspectRatio="none"><path d="M8.75,6.25 L8.75,23.75 M21.25,6.25 L21.25,23.75" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 25.25, y: 24, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="6.25 5 17.5 19.38" width="17.5" height="19.38" overflow="visible" preserveAspectRatio="none"><path d="M6.25,5 L23.75,5 L23.75,16.25 L15,24.38 L6.25,16.25 L6.25,5 Z" fill="#4d94fb" stroke="none"/> <path d="M6.25,5 L23.75,5 L23.75,16.25 L15,24.38 L6.25,16.25 L6.25,5 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 22.75, y: 26.5, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="3.75 7.5 22.5 15" width="22.5" height="15" overflow="visible" preserveAspectRatio="none"><path d="M3.75,7.5 L26.25,7.5 L21.88,22.5 L8.13,22.5 L3.75,7.5 Z" fill="#4d94fb" stroke="none"/> <path d="M3.75,7.5 L26.25,7.5 L21.88,22.5 L8.13,22.5 L3.75,7.5 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
  [
    { kind: "svg", x: 24, y: 24, markup: `<svg xmlns="http://www.w3.org/2000/svg" style="display: block" viewBox="5 5 20 20" width="20" height="20" overflow="visible" preserveAspectRatio="none"><path d="M5,9.38 L25,5 L25,25 L5,25 L5,9.38 Z" fill="#4d94fb" stroke="none"/> <path d="M5,9.38 L25,5 L25,25 L5,25 L5,9.38 Z" fill="none" stroke="#2d6fcd" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>` },
  ],
]
