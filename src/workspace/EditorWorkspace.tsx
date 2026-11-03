import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Avatar } from "../components/Avatar.js";
import { Button } from "../components/Button.js";
import { Divider } from "../components/Divider.js";
import { IconButton } from "../components/IconButton.js";
import { NavRail, NavRailItem } from "../components/NavRail.js";
import { Icon } from "../icons/Icon.js";
import { cx } from "../lib/cx.js";
import type { EditorEvent, EditorPanel, EditorSnapshot } from "../machine/editorMachine.js";
import { selectLayout } from "../machine/editorSelectors.js";
import { AgentsPanel } from "./AgentsPanel.js";
import { AppMark } from "./AppMark.js";
import { BottomToolbar } from "./BottomToolbar.js";
import { DraftingState } from "./DraftingState.js";
import { EmptyDeck } from "./EmptyDeck.js";
import { FilePanel } from "./FilePanel.js";
import { GettingStartedDialog } from "./GettingStartedDialog.js";
import { HelpButton } from "./HelpButton.js";
import { InsertsPanel } from "./InsertsPanel.js";
import { InspectorHead } from "./InspectorHead.js";
import { MediaPanel } from "./MediaPanel.js";
import { PresentView } from "./PresentView.js";
import { PresenterNotes } from "./PresenterNotes.js";
import { ShareDialog } from "./ShareDialog.js";
import { SlideInspector } from "./SlideInspector.js";
import { SlideThumb } from "./SlideThumb.js";
import { TemplateGallery } from "./TemplateGallery.js";
import type { PresentSlideItem } from "./PresentView.js";

export type { PresentSlideItem };

export type EditorWorkspaceProps = ComponentProps<"div"> & {
  snapshot: EditorSnapshot;
  send: (event: EditorEvent) => void;
  user?: { name: string; avatar?: string } | string;
  onDraft?: (prompt: string, api: { setProgress(n: number): void; done(): void }) => void;
  /**
   * Current drafting progress (0-100).
   * When omitted, EditorWorkspace runs a built-in simulated draft (0->100 over ~2.5s)
   * or invokes onDraft with an api { setProgress, done }.
   */
  draftProgress?: number;
  slideItems?: PresentSlideItem[];
  onCopyLink?: () => void;
  onPublishTemplate?: () => void;
  onCopyPresentationLink?: () => void;
  onGetEmbedCode?: () => void;
  onMoveToFolder?: () => void;
  onAnyoneAccess?: () => void;
};

export function EditorWorkspace({
  snapshot,
  send,
  user = "Ada Lovelace",
  onDraft,
  draftProgress,
  slideItems: propSlideItems,
  onCopyLink,
  onPublishTemplate,
  onCopyPresentationLink,
  onGetEmbedCode,
  onMoveToFolder,
  onAnyoneAccess,
  className,
  ...rest
}: EditorWorkspaceProps) {
  const name = typeof user === "string" ? user : user.name;
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasPresentRef = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const emptyDeckBtnRef = useRef<HTMLButtonElement | null>(null);

  const {
    panelWide,
    showLeftPanel,
    inspector,
    floatingHeader,
    floatingTop,
    shapes,
    empty,
    present,
  } = selectLayout(snapshot);

  const panel = snapshot.value.panel as EditorPanel;
  const canvas = snapshot.value.canvas;
  const overlay = snapshot.value.overlay;
  const zoom = snapshot.context.zoom;
  const slides = snapshot.context.slides;
  const selected = snapshot.context.selected;

  const prevOverlayRef = useRef<string>(overlay);

  // N2: After any dialog closes into the editor, move focus to slide stage or EmptyDeck button
  useEffect(() => {
    if (prevOverlayRef.current !== "none" && overlay === "none") {
      if (!empty && stageRef.current) {
        stageRef.current.focus();
      } else if (empty && emptyDeckBtnRef.current) {
        emptyDeckBtnRef.current.focus();
      }
    }
    prevOverlayRef.current = overlay;
  }, [overlay, empty]);

  // N1: Built-in simulated draft or onDraft handler
  const [internalDraftProgress, setInternalDraftProgress] = useState<number | undefined>(undefined);
  const effectiveDraftProgress = draftProgress !== undefined ? draftProgress : internalDraftProgress;

  useEffect(() => {
    if (overlay !== "drafting") {
      setInternalDraftProgress(undefined);
      return;
    }
    if (draftProgress !== undefined) {
      return;
    }
    let active = true;
    const prompt = snapshot.context.draftPrompt ?? "";
    const api = {
      setProgress: (n: number) => {
        if (active) setInternalDraftProgress(n);
      },
      done: () => {
        if (active) setInternalDraftProgress(100);
      },
    };

    if (onDraft) {
      onDraft(prompt, api);
      return () => {
        active = false;
      };
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setInternalDraftProgress(100);
      return;
    }

    setInternalDraftProgress(0);
    const start = Date.now();
    const duration = 2500;
    const interval = setInterval(() => {
      if (!active) return;
      const elapsed = Date.now() - start;
      const p = Math.min(100, Math.round((elapsed / duration) * 100));
      setInternalDraftProgress(p);
      if (p >= 100) {
        clearInterval(interval);
      }
    }, 50);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [overlay, draftProgress, onDraft, snapshot.context.draftPrompt]);

  // UI keyboard shortcut for TOGGLE_FOCUS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        send({ type: "TOGGLE_FOCUS" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [send]);

  const handlePresent = () => {
    returnFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    send({ type: "PRESENT" });
  };

  const handleExitPresent = () => {
    send({ type: "EXIT_PRESENT" });
  };

  useEffect(() => {
    if (wasPresentRef.current && !present) {
      if (returnFocusRef.current?.isConnected) {
        returnFocusRef.current.focus();
      } else {
        const btn = document.querySelector<HTMLElement>("button[aria-label='Present']");
        btn?.focus();
      }
      returnFocusRef.current = null;
    }
    wasPresentRef.current = present;
  }, [present]);

  const currentSlide = selected[selected.length - 1] ?? selected[0] ?? 1;

  const defaultSlideItems: PresentSlideItem[] = useMemo(
    () =>
      Array.from({ length: Math.max(1, slides) }, (_, i) => ({
        title: i === 0 ? "Slide Deck Title" : `Slide ${i + 1}`,
        body: i === 0 ? "This is just the beginning of something big." : `Content for slide ${i + 1}`,
      })),
    [slides]
  );

  const effectiveSlideItems =
    propSlideItems ?? snapshot.context.slideItems ?? defaultSlideItems;
  const currentItem =
    effectiveSlideItems[currentSlide - 1] ??
    effectiveSlideItems[0] ?? {
      title: `Slide ${currentSlide}`,
      body: `Content for slide ${currentSlide}`,
    };

  if (present) {
    return (
      <PresentView
        slides={effectiveSlideItems}
        currentSlide={currentSlide}
        returnFocusRef={returnFocusRef}
        onExit={handleExitPresent}
        className={className}
        {...rest}
      />
    );
  }

  return (
    <div className={cx("ed", className)} data-wide={panelWide || undefined} {...rest}>
      <NavRail label="Editor" className="ed__rail">
        <AppMark />
        <Divider style={{ width: 16 }} />
        <NavRailItem
          icon="file"
          active={panel === "file"}
          onClick={() => send({ type: "OPEN_PANEL", panel: "file" })}
        >
          File
        </NavRailItem>
        <NavRailItem
          icon="sparkle"
          active={panel === "agents"}
          onClick={() => send({ type: "OPEN_PANEL", panel: "agents" })}
        >
          Agents
        </NavRailItem>
        <NavRailItem
          icon="add-circle"
          active={panel === "inserts" || panel === "media"}
          onClick={() => send({ type: "OPEN_PANEL", panel: "inserts" })}
        >
          Inserts
        </NavRailItem>
      </NavRail>

      {showLeftPanel && (
        <aside className="ed__left" aria-label="Panel">
          {panel === "file" && (
            <FilePanel
              slides={empty ? 0 : 1}
              onOverview={() => send({ type: "SHOW_OVERVIEW" })}
              onNewSlide={() => send({ type: "ADD_SLIDE" })}
              onAddBlank={() => send({ type: "ADD_SLIDE" })}
            />
          )}
          {panel === "agents" && (
            <AgentsPanel onOverview={() => send({ type: "SHOW_OVERVIEW" })} />
          )}
          {panel === "inserts" && (
            <InsertsPanel
              onOpen={(id) => id === "media" && send({ type: "OPEN_MEDIA" })}
              onSlideView={() => send({ type: "SHOW_SLIDE" })}
            />
          )}
          {panel === "media" && (
            <MediaPanel
              slideView={canvas === "slide"}
              onViewToggle={() =>
                send(canvas === "slide" ? { type: "SHOW_OVERVIEW" } : { type: "SHOW_SLIDE" })
              }
              onBack={() => send({ type: "OPEN_PANEL", panel: "inserts" })}
            />
          )}
        </aside>
      )}

      <main className="ed__main" data-overview={canvas === "overview" || undefined}>
        {floatingHeader && (
          <div className="float float--head">
            <button type="button" className="lp__title">
              Untitled
              <Icon name="chevron-down-small" size={16} />
            </button>
            <Button size="sm" iconStart="plus" onClick={() => send({ type: "ADD_SLIDE" })}>
              New slide
            </Button>
            <IconButton
              icon="slide-view"
              label="Slide view"
              size="sm"
              onClick={() => send({ type: "SHOW_SLIDE" })}
            />
          </div>
        )}
        {floatingTop && (
          <div className="float float--top">
            <span className="insp__avatar">
              <Avatar name={name} size={24} />
              <Icon name="chevron-down-small" size={14} />
            </span>
            <Button size="sm" variant="ghost" className="zoomtag" iconEnd="chevron-down-small">
              {zoom}
            </Button>
            <IconButton
              icon="play"
              label="Present"
              size="sm"
              iconSize={24}
              disabled={slides === 0}
              onClick={handlePresent}
            />
            <Button size="sm" variant="primary" onClick={() => send({ type: "OPEN_SHARE" })}>
              Share
            </Button>
          </div>
        )}

        {canvas === "slide" ? (
          <div className="slide-view">
            <div
              ref={stageRef}
              className="slide-view__stage"
              tabIndex={-1}
              aria-label={`Slide ${currentSlide}`}
            >
              {!empty && inspector !== "none" && (
                <div className="bigslide">
                  <h1>{currentItem.title}</h1>
                  {currentItem.body && <p>{currentItem.body}</p>}
                </div>
              )}
              {empty && (
                <EmptyDeck
                  primaryButtonRef={emptyDeckBtnRef}
                  onCreateSlide={() => send({ type: "ADD_SLIDE" })}
                  onBrowseTemplates={() => send({ type: "OPEN_TEMPLATES" })}
                  inert={overlay !== "none" ? true : undefined}
                  aria-hidden={overlay !== "none" ? true : undefined}
                />
              )}
            </div>
            {!empty && inspector === "docked" && <PresenterNotes />}
            {inspector === "none" && (
              <div className="slide-view__single">
                <span className="slide-view__n">{slides === 1 ? 1 : (selected[0] ?? 1)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="overview" aria-label="Slides overview">
            {Array.from({ length: slides }, (_, i) => i + 1).map((n) => (
              <div key={n} className="ov" data-selected={selected?.includes(n) || undefined}>
                <span className="ov__n">{n}</span>
                <SlideThumb n={undefined} empty={n !== 1} />
              </div>
            ))}
          </div>
        )}

        <BottomToolbar
          shapes={shapes}
          onShapes={() => send({ type: "TOGGLE_SHAPES" })}
          mediaActive={panel === "media"}
        />
      </main>

      {inspector !== "none" && (
        <aside
          className="ed__insp"
          data-floating={inspector === "floating" || undefined}
          aria-label="Inspector"
        >
          <InspectorHead
            zoom={zoom}
            floating={inspector === "floating"}
            onShare={() => send({ type: "OPEN_SHARE" })}
            onPresent={handlePresent}
            presentDisabled={slides === 0}
            user={user}
          />
          {empty ? (
            <div className="insp__empty">
              <span>
                <Icon name="cursor" size={18} />
              </span>
              <b>No element selected</b>
              <p>Select an element on your slide to inspect and edit its properties</p>
            </div>
          ) : (
            <SlideInspector
              n={selected[selected.length - 1] ?? selected[0] ?? 1}
              withColors={canvas === "slide"}
              ai={canvas === "slide"}
            />
          )}
        </aside>
      )}

      <HelpButton />

      <GettingStartedDialog
        open={overlay === "start"}
        onClose={() => send({ type: "CLOSE_OVERLAY" })}
        onStartFromScratch={() => send({ type: "ADD_SLIDE" })}
        onAddContext={() => send({ type: "ADD_SLIDE" })}
        onUseTemplate={() => send({ type: "PICK_TEMPLATE" })}
        onComposerSend={(prompt) => {
          send({ type: "DESCRIBE_DECK", prompt });
        }}
      />

      <TemplateGallery
        open={overlay === "templates"}
        onClose={() => send({ type: "CLOSE_OVERLAY" })}
        onSelect={(templateId, templateSlides) =>
          send({ type: "USE_TEMPLATE", templateId, slides: templateSlides })
        }
        onBack={
          snapshot.context.templatesFrom === "start"
            ? () => send({ type: "BACK_TO_START" })
            : undefined
        }
      />

      <DraftingState
        open={overlay === "drafting"}
        prompt={snapshot.context.draftPrompt}
        progress={effectiveDraftProgress}
        onClose={() => send({ type: "CLOSE_OVERLAY" })}
        onCancel={() => send({ type: "CLOSE_OVERLAY" })}
        onOpenDeck={() => send({ type: "DRAFT_READY" })}
      />

      <ShareDialog
        open={overlay === "share" || overlay === "invited"}
        invited={overlay === "invited"}
        invitees={snapshot.context.invitees}
        onClose={() => send({ type: "CLOSE_OVERLAY" })}
        onInvite={(emails) => send({ type: "INVITE", emails })}
        onDone={() => send({ type: "INVITE_DONE" })}
        onCopyLink={
          onCopyLink ??
          (() => {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              navigator.clipboard
                .writeText(typeof window !== "undefined" ? window.location.href : "")
                .catch(() => {});
            }
          })
        }
        onCopyPresentationLink={
          onCopyPresentationLink ??
          (() => {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              navigator.clipboard
                .writeText(
                  typeof window !== "undefined"
                    ? `${window.location.origin}${window.location.pathname}?present=1`
                    : ""
                )
                .catch(() => {});
            }
          })
        }
        onGetEmbedCode={
          onGetEmbedCode ??
          (() => {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              navigator.clipboard
                .writeText('<iframe src="..." width="800" height="450"></iframe>')
                .catch(() => {});
            }
          })
        }
        onPublishTemplate={onPublishTemplate ?? (() => {})}
        onMoveToFolder={onMoveToFolder ?? (() => {})}
        onAnyoneAccess={onAnyoneAccess ?? (() => {})}
        user={user}
      />
    </div>
  );
}
