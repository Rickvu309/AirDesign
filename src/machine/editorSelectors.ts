import type { EditorPanel, EditorSnapshot } from "./editorMachine.js";

export interface EditorLayout {
  panelWide: boolean;
  showLeftPanel: boolean;
  inspector: "docked" | "floating" | "none";
  header: "docked" | "floating" | "none";
  floatingHeader: boolean;
  floatingTop: boolean;
  shapes: boolean;
  empty: boolean;
}

export function selectLayout(snapshot: EditorSnapshot): EditorLayout {
  const panel = snapshot.value.panel as EditorPanel;
  const canvas = snapshot.value.canvas;
  const layout = snapshot.value.layout;
  const tray = snapshot.value.tray;
  const deck = snapshot.value.deck;

  const panelWide = panel !== "file";
  const floatingHeader = canvas === "overview" && layout === "floating" && panel === "file";
  const showLeftPanel = !floatingHeader;

  const inspector: "docked" | "floating" | "none" =
    layout === "focus" ? "none" : layout === "floating" ? "floating" : "docked";

  const header: "docked" | "floating" | "none" =
    layout === "focus" ? "none" : layout === "floating" ? "floating" : "docked";

  const floatingTop = inspector === "none";
  const shapes = tray === "shapes";
  const empty = deck === "empty" || snapshot.context.slides === 0;

  return {
    panelWide,
    showLeftPanel,
    inspector,
    header,
    floatingHeader,
    floatingTop,
    shapes,
    empty,
  };
}

export const selectPanel = (snapshot: EditorSnapshot): EditorPanel => snapshot.value.panel as EditorPanel;
export const selectCanvas = (snapshot: EditorSnapshot): "slide" | "overview" => snapshot.value.canvas as "slide" | "overview";
export const selectOverlay = (snapshot: EditorSnapshot): "none" | "start" | "share" => snapshot.value.overlay as "none" | "start" | "share";
export const selectTray = (snapshot: EditorSnapshot): "closed" | "shapes" => snapshot.value.tray as "closed" | "shapes";
export const selectDeck = (snapshot: EditorSnapshot): "empty" | "filled" => snapshot.value.deck as "empty" | "filled";
export const selectZoom = (snapshot: EditorSnapshot): string => snapshot.context.zoom;
export const selectSlides = (snapshot: EditorSnapshot): number => snapshot.context.slides;
export const selectSelected = (snapshot: EditorSnapshot): number[] => snapshot.context.selected;
