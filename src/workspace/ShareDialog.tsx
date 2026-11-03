import { useState } from "react";
import { Avatar } from "../components/Avatar.js";
import { Button } from "../components/Button.js";
import { Dialog, type DialogProps } from "../components/Dialog.js";
import { Alert } from "../components/Feedback.js";
import { IconButton } from "../components/IconButton.js";
import { Input } from "../components/Input.js";
import { Icon } from "../icons/Icon.js";
import { cx } from "../lib/cx.js";

export type ShareDialogProps = Omit<DialogProps, "title" | "children"> & {
  title?: string;
  user?: { name: string; email?: string } | string;
  invited?: boolean;
  invitees?: string[];
  onDone?: () => void;
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
  invited = false,
  invitees,
  open,
  onClose,
  onDone,
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
  const actualInvitees = invitees && invitees.length > 0 ? invitees : ["grace@example.com", "alan@example.com"];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      className={cx("share", className)}
      data-invited={invited || undefined}
      initialFocus="dialog"
      {...rest}
    >
      <div className={cx("share__card", invited && "share__card--invited")}>
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
          {invited && (
            <Alert tone="info" className="share__alert">
              {`Invitation sent to ${actualInvitees.length} ${actualInvitees.length === 1 ? "person" : "people"}`}
            </Alert>
          )}
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
              onClick={() => {
                onInvite?.(inviteText);
                setInviteText("");
              }}
            >
              Invite
            </Button>
          </div>
          <div className="share__sub">Who has access</div>
          {invited && (
            <>
              {actualInvitees.map((email, idx) => {
                const namePart = email.includes("@") ? email.split("@")[0] : email;
                const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
                return (
                  <div key={email + idx} className="share__access">
                    <Avatar name={capitalized} size={24} />
                    <span>
                      {capitalized} <small>({email})</small>
                    </span>
                    <em>can view</em>
                  </div>
                );
              })}
            </>
          )}
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
          {invited && onDone && (
            <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
              <Button size="sm" variant="secondary" onClick={onDone}>
                Done
              </Button>
            </div>
          )}
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
