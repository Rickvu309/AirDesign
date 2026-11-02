import { useId, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
import { Avatar } from "./Avatar.js";
import { IconButton } from "./IconButton.js";
import { Icon } from "../icons/Icon.js";
import { cx } from "../lib/cx.js";

/** Scrolling transcript. role=log announces new messages politely. */
export function ChatThread({ label = "Conversation", className, ...rest }: ComponentProps<"div"> & { label?: string }) {
  return <div role="log" aria-live="polite" aria-label={label} className={cx("ad ad-thread", className)} {...rest} />;
}

export type ChatMessageProps = Omit<ComponentProps<"article">, "role"> & {
  role: "user" | "assistant";
  /** Display name, also the avatar's accessible name. */
  name?: string;
  streaming?: boolean;
};

export function ChatMessage({ role, name, streaming, className, children, ...rest }: ChatMessageProps) {
  const who = name ?? (role === "user" ? "You" : "Assistant");
  return (
    <article className={cx("ad ad-msg", `ad-msg--${role}`, className)} aria-busy={streaming || undefined} {...rest}>
      <Avatar name={who} size={24} />
      <div className="ad-msg__body">
        <div className="ad-msg__name">{who}</div>
        <div className="ad-msg__text">{children}{streaming && <span className="ad-msg__caret" aria-hidden="true" />}</div>
      </div>
    </article>
  );
}

/** Quick prompt chip, such as "Improve the deck". */
export function Suggestion({ className, children, type = "button", ...rest }: ComponentProps<"button">) {
  return (
    <button type={type} className={cx("ad ad-suggestion", className)} {...rest}>
      <Icon name="sparkle" size={12} />
      {children}
    </button>
  );
}

export interface ChatComposerProps {
  value: string;
  onValueChange: (value: string) => void;
  onSend: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Replaces send with a busy state while a reply is generating. */
  sending?: boolean;
  /** Left slot for context chips or attach buttons. */
  tools?: ReactNode;
  label?: string;
  className?: string;
}

/** Enter sends, Shift+Enter adds a line, empty input cannot be sent. */
export function ChatComposer({ value, onValueChange, onSend, placeholder = "Ask AirDesign", disabled, sending, tools, label = "Message", className }: ChatComposerProps) {
  const id = useId();
  const canSend = !disabled && !sending && value.trim().length > 0;
  const submit = () => { if (canSend) onSend(value.trim()); };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
  };
  return (
    <form className={cx("ad ad-composer", className)} onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <label htmlFor={id} className="ad-sr-only">{label}</label>
      <textarea id={id} rows={2} className="ad-composer__input" value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onValueChange(e.target.value)} onKeyDown={onKeyDown} />
      <div className="ad-composer__bar">
        <div className="ad-composer__tools">{tools}</div>
        <IconButton type="submit" icon="send" label={sending ? "Sending" : "Send"} variant="primary" size="sm" disabled={!canSend} aria-busy={sending || undefined} />
      </div>
    </form>
  );
}
