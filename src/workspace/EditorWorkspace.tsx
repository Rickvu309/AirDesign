import type { ComponentProps } from "react";
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
import { FilePanel } from "./FilePanel.js";
import { GettingStartedDialog } from "./GettingStartedDialog.js";
import { HelpButton } from "./HelpButton.js";
import { InsertsPanel } from "./InsertsPanel.js";
import { InspectorHead } from "./InspectorHead.js";
import { MediaPanel } from "./MediaPanel.js";
import { PresenterNotes } from "./PresenterNotes.js";
import { ShareDialog } from "./ShareDialog.js";
import { SlideInspector } from "./SlideInspector.js";
import { SlideThumb } from "./SlideThumb.js";

export type EditorWorkspaceProps = ComponentProps<"div"> & {
  snapshot: EditorSnapshot;
  send: (event: EditorEvent) => void;
  user?: { name: string; avatar?: string } | string;
};

export function EditorWorkspace({
  snapshot,
  send,
  user = "Ada Lovelace",
  className,
  ...rest
}: EditorWorkspaceProps) {
  const name = typeof user === "string" ? user : user.name;
  const {
    panelWide,
    showLeftPanel,
    inspector,
    floatingHeader,
    floatingTop,
    shapes,
    empty,
  } = selectLayout(snapshot);

  const panel = snapshot.value.panel as EditorPanel;
  const canvas = snapshot.value.canvas;
  const overlay = snapshot.value.overlay;
  const zoom = snapshot.context.zoom;
  const slides = snapshot.context.slides;
  const selected = snapshot.context.selected;

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
            <IconButton icon="play" label="Present" size="sm" iconSize={24} />
            <Button size="sm" variant="primary" onClick={() => send({ type: "OPEN_SHARE" })}>
              Share
            </Button>
          </div>
        )}

        {canvas === "slide" ? (
          <div className="slide-view">
            <div className="slide-view__stage">
              {!empty && inspector !== "none" && (
                <div className="bigslide">
                  <h1>Slide Deck Title</h1>
                  <p>This is just the beginning of something big.</p>
                </div>
              )}
            </div>
            {!empty && inspector === "docked" && <PresenterNotes />}
            {inspector === "none" && (
              <div className="slide-view__single">
                <span className="slide-view__n">3</span>
              </div>
            )}
          </div>
        ) : (
          <div className="overview" aria-label="Slides overview">
            {[1, 2, 3].slice(0, slides).map((n) => (
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
              n={canvas === "overview" ? 3 : 1}
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
      />

      <ShareDialog
        open={overlay === "share"}
        onClose={() => send({ type: "CLOSE_OVERLAY" })}
        user={user}
      />
    </div>
  );
}
