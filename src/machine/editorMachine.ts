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
  /** Where templates was opened from ("start" | "empty"). */
  templatesFrom?: "start" | "empty";
  /** Mirrored canvas state ("slide" | "overview"). */
  canvas?: "slide" | "overview";
  /** Mirrored layout state ("docked" | "floating" | "focus"). */
  layout?: "docked" | "floating" | "focus";
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

function parseTemplateSlides(e: EditorEvent): number {
  const raw = (e as { slides?: number }).slides;
  if (typeof raw === "number" && !Number.isNaN(raw)) {
    return Math.max(1, Math.floor(raw));
  }
  return 1;
}

function clampSelected(slides: number, rawSelected?: number[]): number[] {
  if (!Array.isArray(rawSelected) || slides <= 0) return [];
  const clamped = rawSelected
    .map((n) => Math.floor(Number(n)))
    .filter((n) => !Number.isNaN(n) && n >= 1 && n <= slides);
  return Array.from(new Set(clamped));
}

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
    templatesFrom: "empty",
    canvas: "slide",
    layout: "docked",
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
              guard: (c: EditorContext) => !c.presenting && c.layout !== "focus",
              action: () => ({ zoom: "12%", canvas: "overview" }),
            },
          },
        },
        overview: {
          on: {
            SHOW_SLIDE: {
              target: "slide",
              guard: (c: EditorContext) => !c.presenting,
              action: () => ({ zoom: "45%", selected: [], canvas: "slide" }),
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
              action: () => ({ layout: "floating" }),
            },
            TOGGLE_FOCUS: {
              target: "focus",
              guard: (c: EditorContext) => !c.presenting,
              action: () => ({ layout: "focus" }),
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
              action: () => ({ layout: "docked" }),
            },
            TOGGLE_FOCUS: {
              target: "focus",
              guard: (c: EditorContext) => !c.presenting,
              action: () => ({ layout: "focus" }),
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
            TOGGLE_FOCUS: [
              {
                target: "floating",
                guard: (c: EditorContext) => !c.presenting && c.canvas === "overview",
                action: () => ({ layout: "floating" }),
              },
              {
                target: "docked",
                guard: (c: EditorContext) => !c.presenting,
                action: () => ({ layout: "docked" }),
              },
            ],
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
              action: () => ({ overlay: "templates", dialogOpen: true, templatesFrom: "empty" }),
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
              action: () => ({ overlay: "templates", dialogOpen: true, templatesFrom: "start" }),
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
            BACK_TO_START: [
              {
                target: "start",
                guard: (c: EditorContext) => c.templatesFrom !== "empty",
                action: () => ({ overlay: "start", dialogOpen: true }),
              },
            ],
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
              guard: (c: EditorContext, e: EditorEvent) => {
                if (c.slides <= 0) return false;
                const emailStr = (e as { emails?: string }).emails;
                if (emailStr !== undefined) {
                  const parsed = emailStr.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
                  if (parsed.length === 0) return false;
                }
                return true;
              },
              action: (c: EditorContext, e: EditorEvent) => {
                const emailStr = (e as { emails?: string }).emails;
                const parsed =
                  emailStr !== undefined
                    ? emailStr.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)
                    : undefined;
                return {
                  overlay: "invited",
                  dialogOpen: true,
                  invitees: parsed ?? (c.invitees && c.invitees.length > 0 ? c.invitees : []),
                };
              },
            },
            REMOVE_SLIDES: {
              target: "none",
              action: () => ({ overlay: "none", dialogOpen: false, presenting: false }),
            },
            EMPTY_DECK: {
              target: "none",
              action: () => ({ overlay: "none", dialogOpen: false, presenting: false }),
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
              action: () => ({ overlay: "none", dialogOpen: false, presenting: false }),
            },
            EMPTY_DECK: {
              target: "none",
              action: () => ({ overlay: "none", dialogOpen: false, presenting: false }),
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
                const added = parseTemplateSlides(e);
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
              action: () => ({ slides: 0, selected: [], presenting: false }),
            },
            EMPTY_DECK: {
              action: () => ({ slides: 0, selected: [], presenting: false }),
            },
            SELECT_SLIDES: {
              action: () => ({ selected: [] }),
            },
          },
        },
        filled: {
          on: {
            ADD_SLIDE: {
              guard: canAddSlide,
              action: (c: EditorContext) => ({ slides: Math.max(1, c.slides + 1) }),
            },
            USE_TEMPLATE: {
              target: "filled",
              action: (c: EditorContext, e: EditorEvent) => {
                const added = parseTemplateSlides(e);
                const base = Math.max(0, c.slides);
                const next = base <= 1 ? added : base + added;
                return { slides: Math.max(1, next) };
              },
            },
            DRAFT_READY: {
              action: (c: EditorContext) => ({ slides: Math.max(1, c.slides > 0 ? c.slides : 1) }),
            },
            REMOVE_SLIDES: {
              target: "empty",
              action: () => ({ slides: 0, selected: [], presenting: false }),
            },
            EMPTY_DECK: {
              target: "empty",
              action: () => ({ slides: 0, selected: [], presenting: false }),
            },
            SELECT_SLIDES: {
              action: (c: EditorContext, e: EditorEvent) => ({
                selected: clampSelected(c.slides, (e as { slides?: number[] }).slides),
              }),
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

  // 1. Normalize slides to integer >= 0
  if (normContext.slides !== undefined) {
    normContext.slides = Math.max(0, Math.floor(Number(normContext.slides) || 0));
  }

  // 2. If layout was "present", normalize layout to docked and set presenting true
  if (normValue.layout === "present") {
    normValue.layout = "docked";
    if (normContext.presenting === undefined) {
      normContext.presenting = true;
    }
  }

  // 3. Deck region follows slides: filled iff slides > 0
  if (normContext.slides === 0) {
    normValue.deck = "empty";
  } else if (normContext.slides !== undefined && normContext.slides > 0) {
    normValue.deck = "filled";
  } else if (normValue.deck === "empty") {
    normContext.slides = 0;
  } else {
    normValue.deck = "filled";
    if (normContext.slides === undefined) {
      normContext.slides = 1;
    }
  }

  // 4. Invariant I2: slides === 0 => overlay cannot be share/invited, not presenting
  if (normContext.slides === 0) {
    normContext.presenting = false;
    if (normValue.overlay === "share" || normValue.overlay === "invited") {
      normValue.overlay = "none";
    }
  }

  // 5. Invariant I1: presenting => no dialog open, tray closed
  if (normContext.presenting) {
    normValue.overlay = "none";
    normValue.tray = "closed";
    normContext.dialogOpen = false;
  }

  // 6. Invariant I5: selected clamped to 1..slides and deduped
  normContext.selected = clampSelected(normContext.slides ?? 0, normContext.selected);

  // 7. Mirror overlay in context if not specified
  if (normContext.overlay === undefined) {
    normContext.overlay = normValue.overlay ?? "none";
  }
  if (normContext.dialogOpen === undefined) {
    normContext.dialogOpen = normContext.overlay !== "none";
  }

  // 8. Mirror canvas and layout in context
  if (normContext.canvas === undefined) {
    normContext.canvas = (normValue.canvas as any) ?? "slide";
  }
  if (normContext.layout === undefined) {
    normContext.layout = (normValue.layout as any) ?? "docked";
  }

  // 9. templatesFrom
  if (normContext.templatesFrom === undefined) {
    normContext.templatesFrom = normContext.slides === 0 ? "empty" : "start";
  }

  return editorMachine.restore(normValue, normContext);
}

export type EditorSnapshot = Snapshot<EditorContext>;
