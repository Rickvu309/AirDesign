import { useState } from "react";
import { Avatar } from "../components/Avatar.js";
import { Button } from "../components/Button.js";
import { Dialog, type DialogProps } from "../components/Dialog.js";
import { IconButton } from "../components/IconButton.js";
import { Input } from "../components/Input.js";
import { Icon } from "../icons/Icon.js";
import { cx } from "../lib/cx.js";

export type ShareDialogProps = Omit<DialogProps, "title" | "children"> & {
  title?: string;
  user?: { name: string; email?: string } | string;
  onCopyLink?: () => void;
  onInvite?: (emails: string) => void;
  onPublishTemplate?: () => void;
  onCopyPresentationLink?: () => void;
  onGetEmbedCode?: () => void;
  onMoveToFolder?: () => void;
};

export function ShareDialog({
  title = "Share these slides",
  user = "Ada Lovelace",
  open,
  onClose,
  onCopyLink,
  onInvite,
  onPublishTemplate,
  onCopyPresentationLink,
  onGetEmbedCode,
  onMoveToFolder,
  className,
  ...rest
}: ShareDialogProps) {
  const [inviteText, setInviteText] = useState("");
  const name = typeof user === "string" ? user : user.name;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      className={cx("share", className)}
      initialFocus="dialog"
      {...rest}
    >
      <div className="share__card">
        <div className="share__head">
          <strong>{title}</strong>
          <Button
            size="sm"
            variant="ghost"
            iconStart="link"
            iconEnd="chevron-down-small"
            className="orange"
            onClick={onCopyLink}
          >
            Copy link
          </Button>
          <IconButton icon="close" label="Close" size="sm" iconSize={24} onClick={onClose} />
        </div>
        <div className="share__body">
          <div className="share__row">
            <Input
              label="Invite emails"
              placeholder="Add comma separated emails to invite"
              value={inviteText}
              onChange={(e) => setInviteText(e.target.value)}
            />
            <Button
              variant="primary"
              disabled={!inviteText.trim()}
              onClick={() => onInvite?.(inviteText)}
            >
              Invite
            </Button>
          </div>
          <div className="share__sub">Who has access</div>
          <button type="button" className="share__access" aria-label="Anyone can view">
            <Icon name="globe" />
            <span>Anyone</span>
            <em>
              can view <Icon name="chevron-right" size={12} />
            </em>
          </button>
          <div className="share__access">
            <Avatar name={name} size={24} />
            <span>
              {name} <small>(you)</small>
            </span>
            <em>owner</em>
          </div>
        </div>
      </div>
      <div className="share__card share__menu">
        <button type="button" onClick={onPublishTemplate}>
          <Icon name="layout" />
          <span>Publish template</span>
          <Icon name="chevron-right" size={12} />
        </button>
        <button type="button" onClick={onCopyPresentationLink}>
          <Icon name="play" />
          <span>Copy presentation link</span>
        </button>
        <button type="button" onClick={onGetEmbedCode}>
          <Icon name="code" />
          <span>Get embed code</span>
          <Icon name="chevron-right" size={12} />
        </button>
        <button type="button" className="share__cta" onClick={onMoveToFolder}>
          <Icon name="upload" />
          <span>Ready to share with your team?</span>
          <b>Move to folder</b>
        </button>
      </div>
    </Dialog>
  );
}
