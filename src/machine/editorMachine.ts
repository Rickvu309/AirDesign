import { createMachine, type Machine, type Snapshot } from "./createMachine.js";

export type EditorPanel = "file" | "agents" | "inserts" | "media";

export interface EditorContext {
  zoom: string;
  /** Number of slides in the deck. 0 means an empty deck. */
  slides: number;
  /** Selected slide numbers (1-based), only meaningful in the overview. */
  selected: number[];
  /** Present mode is its own mode, not a layout state. */
  presenting: boolean;
  /** True when any overlay dialog is open. */
  dialogOpen: boolean;
  /** Mirrored overlay state for guards that check overlay status. */
  overlay?: string;
  /** Prompt text for drafting flow. */
  draftPrompt?: string;
  /** Real invitee emails for share/invited. */
  invitees?: string[];
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
  | { type: "OPEN_TEMPLATES" }
  | { type: "CLOSE_OVERLAY" }
  | { type: "ADD_SLIDE" }
  | { type: "REMOVE_SLIDES" }
  | { type: "EMPTY_DECK" }
  | { type: "SELECT_SLIDES"; slides: number[] }
  | { type: "SET_ZOOM"; zoom: string }
  | { type: "PICK_TEMPLATE" }
  | { type: "USE_TEMPLATE"; templateId?: string; slides?: number }
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
      guard: (c: EditorContext, e: EditorEvent) => !c.presenting && e.type === "OPEN_PANEL" && e.panel === p,
    })),
    ...(self === "inserts"
      ? {
          OPEN_MEDIA: {
            target: "media",
            guard: (c: EditorContext) => !c.presenting,
          },
        }
      : {}),
  },
});

const canAddSlide = (c: EditorContext) => !c.presenting && (!c.dialogOpen || c.overlay === "start");

/**
 * The editor as a state machine. Parallel regions run together and every event goes to all of them:
 *
 *  panel     file | agents | inserts | media        left panel opened from the rail
 *  canvas    slide | overview                       what the middle shows
 *  layout    docked | floating | focus              inspector and header placement (present is in context)
 *  overlay   none | start | share | templates | drafting | invited    modal dialogs
 *  tray      closed | shapes                        shapes tray above the bottom toolbar
 *  deck      empty | filled                         slide count, selection, zoom and presenting live in context
 */
export const editorMachine: Machine<EditorContext, EditorEvent> = createMachine<EditorContext, EditorEvent>({
  id: "editor",
  context: {
    zoom: "45%",
    slides: 1,
    selected: [],
    presenting: false,
    dialogOpen: false,
    overlay: "none",
    draftPrompt: "",
    invitees: [],
  },
  regions: {
    panel: {
      initial: "file",
      states: {
        file: panelState("file"),
        agents: panelState("agents"),
        inserts: panelState("inserts"),
        media: panelState("media"),
      },
    },
    canvas: {
      initial: "slide",
      states: {
        slide: {
          on: {
            SHOW_OVERVIEW: {
              target: "overview",
              guard: (c: EditorContext) => !c.presenting,
              action: () => ({ zoom: "12%" }),
            },
          },
        },
        overview: {
          on: {
            SHOW_SLIDE: {
              target: "slide",
              guard: (c: EditorContext) => !c.presenting,
              action: () => ({ zoom: "45%", selected: [] }),
            },
          },
        },
      },
    },
    layout: {
      initial: "docked",
      states: {
        docked: {
          on: {
            SHOW_OVERVIEW: {
              target: "floating",
              guard: (c: EditorContext) => !c.presenting,
            },
            TOGGLE_FOCUS: {
              target: "focus",
              guard: (c: EditorContext) => !c.presenting,
            },
            PRESENT: {
              guard: (c: EditorContext) => !c.presenting && c.slides > 0 && !c.dialogOpen,
              action: () => ({ presenting: true }),
            },
            EXIT_PRESENT: {
              guard: (c: EditorContext) => c.presenting,
              action: () => ({ presenting: false }),
            },
          },
        },
        floating: {
          on: {
            SHOW_SLIDE: {
              target: "docked",
              guard: (c: EditorContext) => !c.presenting,
            },
            PRESENT: {
              guard: (c: EditorContext) => !c.presenting && c.slides > 0 && !c.dialogOpen,
              action: () => ({ presenting: true }),
            },
            EXIT_PRESENT: {
              guard: (c: EditorContext) => c.presenting,
              action: () => ({ presenting: false }),
            },
          },
        },
        focus: {
          on: {
            TOGGLE_FOCUS: {
              target: "docked",
              guard: (c: EditorContext) => !c.presenting,
            },
            PRESENT: {
              guard: (c: EditorContext) => !c.presenting && c.slides > 0 && !c.dialogOpen,
              action: () => ({ presenting: true }),
            },
            EXIT_PRESENT: {
              guard: (c: EditorContext) => c.presenting,
              action: () => ({ presenting: false }),
            },
          },
        },
      },
    },
    overlay: {
      initial: "none",
      states: {
        none: {
          on: {
            OPEN_SHARE: {
              target: "share",
              guard: (c: EditorContext) => !c.presenting && c.slides > 0,
              action: () => ({ overlay: "share", dialogOpen: true }),
            },
            OPEN_START: {
              target: "start",
              guard: (c: EditorContext) => !c.presenting,
              action: () => ({ overlay: "start", dialogOpen: true }),
            },
            OPEN_TEMPLATES: {
              target: "templates",
              guard: (c: EditorContext) => !c.presenting,
              action: () => ({ overlay: "templates", dialogOpen: true }),
            },
          },
        },
        start: {
          on: {
            CLOSE_OVERLAY: {
              target: "none",
              action: () => ({ overlay: "none", dialogOpen: false }),
            },
            ADD_SLIDE: {
              target: "none",
              action: () => ({ overlay: "none", dialogOpen: false }),
            },
            PICK_TEMPLATE: {
              target: "templates",
              guard: (c: EditorContext) => !c.presenting,
              action: () => ({ overlay: "templates", dialogOpen: true }),
            },
            DESCRIBE_DECK: {
              target: "drafting",
              guard: (c: EditorContext) => !c.presenting,
              action: (_, e) => ({
                overlay: "drafting",
                dialogOpen: true,
                draftPrompt: (e as { prompt?: string }).prompt ?? "",
              }),
            },
          },
        },
        templates: {
          on: {
            CLOSE_OVERLAY: {
              target: "none",
              action: () => ({ overlay: "none", dialogOpen: false }),
            },
            BACK_TO_START: {
              target: "start",
              action: () => ({ overlay: "start", dialogOpen: true }),
            },
            USE_TEMPLATE: {
              target: "none",
              action: () => ({ overlay: "none", dialogOpen: false }),
            },
          },
        },
        drafting: {
          on: {
            CLOSE_OVERLAY: {
              target: "none",
              action: () => ({ overlay: "none", dialogOpen: false }),
            },
            BACK_TO_START: {
              target: "start",
              action: () => ({ overlay: "start", dialogOpen: true }),
            },
            DRAFT_READY: {
              target: "none",
              action: () => ({ overlay: "none", dialogOpen: false }),
            },
          },
        },
        share: {
          on: {
            CLOSE_OVERLAY: {
              target: "none",
              action: () => ({ overlay: "none", dialogOpen: false }),
            },
            INVITE: {
              target: "invited",
              guard: (c: EditorContext) => c.slides > 0,
              action: (c: EditorContext, e: EditorEvent) => {
                const emailStr = (e as { emails?: string }).emails;
                const parsed = emailStr
                  ? emailStr
                      .split(/[,;\s]+/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : undefined;
                return {
                  overlay: "invited",
                  dialogOpen: true,
                  invitees:
                    parsed && parsed.length > 0
                      ? parsed
                      : c.invitees && c.invitees.length > 0
                        ? c.invitees
                        : ["grace@example.com", "alan@example.com"],
                };
              },
            },
            REMOVE_SLIDES: {
              target: "none",
              action: () => ({ overlay: "none", dialogOpen: false }),
            },
            EMPTY_DECK: {
              target: "none",
              action: () => ({ overlay: "none", dialogOpen: false }),
            },
          },
        },
        invited: {
          on: {
            CLOSE_OVERLAY: {
              target: "none",
              action: () => ({ overlay: "none", dialogOpen: false }),
            },
            INVITE_DONE: {
              target: "none",
              action: () => ({ overlay: "none", dialogOpen: false }),
            },
            REMOVE_SLIDES: {
              target: "none",
              action: () => ({ overlay: "none", dialogOpen: false }),
            },
            EMPTY_DECK: {
              target: "none",
              action: () => ({ overlay: "none", dialogOpen: false }),
            },
          },
        },
      },
    },
    tray: {
      initial: "closed",
      states: {
        closed: {
          on: {
            TOGGLE_SHAPES: {
              target: "shapes",
              guard: (c: EditorContext) => !c.presenting,
            },
          },
        },
        shapes: {
          on: {
            TOGGLE_SHAPES: {
              target: "closed",
              guard: (c: EditorContext) => !c.presenting,
            },
            OPEN_PANEL: {
              target: "closed",
              guard: (c: EditorContext) => !c.presenting,
            },
            PRESENT: {
              target: "closed",
            },
          },
        },
      },
    },
    deck: {
      initial: "filled",
      states: {
        empty: {
          on: {
            ADD_SLIDE: {
              target: "filled",
              guard: canAddSlide,
              action: () => ({ slides: 1, selected: [] }),
            },
            USE_TEMPLATE: {
              target: "filled",
              action: (_, e) => {
                const added = (e as { slides?: number }).slides ?? 1;
                return { slides: added, selected: [] };
              },
            },
            DRAFT_READY: {
              target: "filled",
              action: () => ({ slides: 1, selected: [] }),
            },
            SET_ZOOM: {
              action: (_, e) => ({ zoom: (e as { zoom: string }).zoom }),
            },
            REMOVE_SLIDES: {
              action: () => ({ slides: 0, selected: [] }),
            },
            EMPTY_DECK: {
              action: () => ({ slides: 0, selected: [] }),
            },
          },
        },
        filled: {
          on: {
            ADD_SLIDE: {
              guard: canAddSlide,
              action: (c: EditorContext) => ({ slides: c.slides + 1 }),
            },
            USE_TEMPLATE: {
              action: (c: EditorContext, e: EditorEvent) => {
                const added = (e as { slides?: number }).slides ?? 1;
                return { slides: c.slides <= 1 ? added : c.slides + added };
              },
            },
            DRAFT_READY: {
              action: (c: EditorContext) => ({ slides: c.slides > 0 ? c.slides : 1 }),
            },
            REMOVE_SLIDES: {
              target: "empty",
              action: () => ({ slides: 0, selected: [] }),
            },
            EMPTY_DECK: {
              target: "empty",
              action: () => ({ slides: 0, selected: [] }),
            },
            SELECT_SLIDES: {
              action: (_, e) => ({ selected: (e as { slides: number[] }).slides }),
            },
            SET_ZOOM: {
              action: (_, e) => ({ zoom: (e as { zoom: string }).zoom }),
            },
          },
        },
      },
    },
  },
});

/**
 * Builds an editor snapshot from partial values and context, normalizing deck state,
 * presenting flag and overlay open context.
 */
export function restoreEditor(
  value: Record<string, string> = {},
  context: Partial<EditorContext> = {},
): EditorSnapshot {
  const normValue: Record<string, string> = { ...value };
  const normContext: Partial<EditorContext> = { ...context };

  // If layout was "present", normalize layout to docked and set presenting true
  if (normValue.layout === "present") {
    normValue.layout = "docked";
    if (normContext.presenting === undefined) {
      normContext.presenting = true;
    }
  }

  // Requirement 3: if deck region is "empty" and slides not given, context slides must be 0
  if (normValue.deck === "empty" && normContext.slides === undefined) {
    normContext.slides = 0;
  }
  if (normContext.slides === 0 && !normValue.deck) {
    normValue.deck = "empty";
  }

  // Mirror overlay in context if not specified
  if (normContext.overlay === undefined) {
    normContext.overlay = normValue.overlay ?? "none";
  }
  if (normContext.dialogOpen === undefined) {
    normContext.dialogOpen = normContext.overlay !== "none";
  }

  return editorMachine.restore(normValue, normContext);
}

export type EditorSnapshot = Snapshot<EditorContext>;
