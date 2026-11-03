import { useState, type ComponentProps } from "react";
import { Badge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { ChatComposer } from "../components/Chat.js";
import { Divider } from "../components/Divider.js";
import { IconButton } from "../components/IconButton.js";
import { Icon } from "../icons/Icon.js";
import type { IconName } from "../icons/icon-data.js";
import { cx } from "../lib/cx.js";
import { PanelHeader } from "./PanelHeader.js";

export type AgentsPanelProps = ComponentProps<"div"> & {
  title?: string;
  subtitle?: string;
  chatTitle?: string;
  chatSubtitle?: string;
  onOverview?: () => void;
  onTitleClick?: () => void;
  onChatOptions?: () => void;
  onActionClick?: (label: string) => void;
  composerValue?: string;
  onComposerValueChange?: (value: string) => void;
  onSend?: (text: string) => void;
};

const defaultItems: { icon: IconName; label: string }[] = [
  { icon: "palette", label: "Improve the deck" },
  { icon: "add-circle", label: "Add to the deck" },
  { icon: "text", label: "Prepare to present" },
  { icon: "list", label: "Understand the deck" },
];

export function AgentsPanel({
  title = "Untitled",
  subtitle = "Drafts",
  chatTitle = "New chat",
  chatSubtitle = "Shared",
  onOverview,
  onTitleClick,
  onChatOptions,
  onActionClick,
  composerValue,
  onComposerValueChange,
  onSend,
  className,
  ...rest
}: AgentsPanelProps) {
  const [internalDraft, setInternalDraft] = useState("");
  const draft = composerValue !== undefined ? composerValue : internalDraft;
  const setDraft = onComposerValueChange ?? setInternalDraft;

  return (
    <div className={cx("ad-agents-panel", className)} {...rest}>
      <PanelHeader
        title={title}
        subtitle={subtitle}
        trailing={<IconButton icon="grid" label="Overview" size="sm" onClick={onOverview} />}
        onTitleClick={onTitleClick}
      />
      <Divider />
      <div className="lp__chat">
        <div>
          <div className="lp__chat-title">{chatTitle}</div>
          <div className="lp__sub">{chatSubtitle}</div>
        </div>
        <Badge>Beta</Badge>
        <IconButton icon="more" label="Chat options" size="sm" onClick={onChatOptions} />
      </div>
      <Divider />
      <div className="agents">
        <span className="agents__badge">
          <Icon name="actions" size={22} />
        </span>
        <h2>What do you want to do?</h2>
        <div className="agents__list">
          {defaultItems.map((i) => (
            <Button
              key={i.label}
              variant="secondary"
              iconStart={i.icon}
              iconEnd="chevron-down"
              className="row"
              onClick={() => onActionClick?.(i.label)}
            >
              {i.label}
            </Button>
          ))}
        </div>
      </div>
      <ChatComposer
        className="agents__composer"
        value={draft}
        onValueChange={setDraft}
        onSend={(t) => {
          onSend?.(t);
          if (composerValue === undefined) setDraft("");
        }}
        placeholder="Ask for changes"
        label="Ask for changes"
        tools={
          <>
            <IconButton icon="plus" label="Add context" size="sm" />
            <IconButton icon="palette" label="Template" size="sm" />
            <IconButton icon="mic" label="Dictate" size="sm" className="mic" />
          </>
        }
      />
    </div>
  );
}
