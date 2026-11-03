import { createMachine, type Machine, type Snapshot } from "./createMachine.js";

export type EditorPanel = "file" | "agents" | "inserts" | "media";

export interface EditorContext {
  zoom: string;
  /** Number of slides in the deck. 0 means an empty deck. */
  slides: number;
  /** Selected slide numbers (1-based), only meaningful in the overview. */
  selected: number[];
}

export type EditorEvent =
  | { type: "OPEN_PANEL"; panel: EditorPanel }
  | { type: "OPEN_MEDIA" }
  | { type: "SHOW_OVERVIEW" }
  | { type: "SHOW_SLIDE" }
  | { type: "TOGGLE_FOCUS" }
  | { type: "TOGGLE_SHAPES" }
  | { type: "OPEN_SHARE" }
  | { type: "OPEN_START" }
  | { type: "CLOSE_OVERLAY" }
  | { type: "ADD_SLIDE" }
  | { type: "SELECT_SLIDES"; slides: number[] }
  | { type: "SET_ZOOM"; zoom: string }
  | { type: "PICK_TEMPLATE" }
  | { type: "USE_TEMPLATE" }
  | { type: "DESCRIBE_DECK"; prompt?: string }
  | { type: "DRAFT_READY" }
  | { type: "BACK_TO_START" }
  | { type: "PRESENT" }
  | { type: "EXIT_PRESENT" }
  | { type: "INVITE"; emails?: string }
  | { type: "INVITE_DONE" };

const PANELS = ["file", "agents", "inserts", "media"] as const;
const panelState = (self: EditorPanel) => ({
  on: {
    OPEN_PANEL: PANELS.filter((p) => p !== self).map((p) => ({
      target: p,
      guard: (_: EditorContext, e: EditorEvent) => e.type === "OPEN_PANEL" && e.panel === p,
    })),
    ...(self === "inserts" ? { OPEN_MEDIA: "media" } : {}),
  },
});

/**
 * The editor as a state machine. Four regions run in parallel and every event goes to all of them,
 * so one event (SHOW_OVERVIEW) can move the canvas, float the inspector and change the zoom together.
 *
 *  panel     file | agents | inserts | media        left panel opened from the rail
 *  canvas    slide | overview                       what the middle shows
 *  layout    docked | floating | focus | present    inspector, header placement and present mode
 *  overlay   none | start | share | templates | drafting | invited    modal dialogs
 *  tray      closed | shapes                        shapes tray above the bottom toolbar
 *  deck      empty | filled                         slide count, selection and zoom live in the context
 */
export const editorMachine: Machine<EditorContext, EditorEvent> = createMachine<EditorContext, EditorEvent>({
  id: "editor",
  context: { zoom: "45%", slides: 1, selected: [] },
  regions: {
    panel: {
      initial: "file",
      states: { file: panelState("file"), agents: panelState("agents"), inserts: panelState("inserts"), media: panelState("media") },
    },
    canvas: {
      initial: "slide",
      states: {
        slide: { on: { SHOW_OVERVIEW: { target: "overview", action: () => ({ zoom: "12%" }) } } },
        overview: { on: { SHOW_SLIDE: { target: "slide", action: () => ({ zoom: "45%", selected: [] }) } } },
      },
    },
    layout: {
      initial: "docked",
      states: {
        docked: {
          on: {
            SHOW_OVERVIEW: "floating",
            TOGGLE_FOCUS: "focus",
            PRESENT: {
              target: "present",
              guard: (c: EditorContext) => c.slides > 0,
            },
          },
        },
        floating: {
          on: {
            SHOW_SLIDE: "docked",
            PRESENT: {
              target: "present",
              guard: (c: EditorContext) => c.slides > 0,
            },
          },
        },
        focus: { on: { TOGGLE_FOCUS: "docked" } },
        present: { on: { EXIT_PRESENT: "docked" } },
      },
    },
    overlay: {
      initial: "none",
      states: {
        none: { on: { OPEN_SHARE: "share", OPEN_START: "start" } },
        start: {
          on: {
            CLOSE_OVERLAY: "none",
            ADD_SLIDE: "none",
            PICK_TEMPLATE: "templates",
            DESCRIBE_DECK: "drafting",
          },
        },
        templates: {
          on: {
            CLOSE_OVERLAY: "none",
            BACK_TO_START: "start",
            USE_TEMPLATE: "none",
          },
        },
        drafting: {
          on: {
            CLOSE_OVERLAY: "none",
            BACK_TO_START: "start",
            DRAFT_READY: "none",
          },
        },
        share: {
          on: {
            CLOSE_OVERLAY: "none",
            INVITE: "invited",
          },
        },
        invited: {
          on: {
            CLOSE_OVERLAY: "none",
            INVITE_DONE: "share",
          },
        },
      },
    },
    tray: {
      initial: "closed",
      states: {
        closed: { on: { TOGGLE_SHAPES: "shapes" } },
        shapes: { on: { TOGGLE_SHAPES: "closed", OPEN_PANEL: "closed" } },
      },
    },
    deck: {
      initial: "filled",
      states: {
        empty: {
          on: {
            ADD_SLIDE: { target: "filled", action: () => ({ slides: 1 }) },
            USE_TEMPLATE: { target: "filled", action: () => ({ slides: 1 }) },
            DRAFT_READY: { target: "filled", action: () => ({ slides: 1 }) },
            SET_ZOOM: { action: (_, e) => ({ zoom: (e as { zoom: string }).zoom }) },
          },
        },
        filled: {
          on: {
            ADD_SLIDE: { action: (c) => ({ slides: c.slides + 1 }) },
            USE_TEMPLATE: { action: () => ({ slides: 1 }) },
            DRAFT_READY: { action: (c) => ({ slides: c.slides > 0 ? c.slides : 1 }) },
            SELECT_SLIDES: { action: (_, e) => ({ selected: (e as { slides: number[] }).slides }) },
            SET_ZOOM: { action: (_, e) => ({ zoom: (e as { zoom: string }).zoom }) },
          },
        },
      },
    },
  },
});

export type EditorSnapshot = Snapshot<EditorContext>;
