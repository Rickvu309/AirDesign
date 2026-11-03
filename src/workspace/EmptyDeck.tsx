import type { ComponentProps } from "react";
import { Button } from "../components/Button.js";
import { Icon } from "../icons/Icon.js";
import { cx } from "../lib/cx.js";

export type EmptyDeckProps = ComponentProps<"div"> & {
  onCreateSlide?: () => void;
  onBrowseTemplates?: () => void;
  primaryButtonRef?: React.Ref<HTMLButtonElement>;
};

export function EmptyDeck({
  onCreateSlide,
  onBrowseTemplates,
  primaryButtonRef,
  className,
  ...rest
}: EmptyDeckProps) {
  return (
    <div className={cx("empty-deck", className)} {...rest}>
      <div className="empty-deck__icon" aria-hidden="true">
        <Icon name="file" size={32} />
      </div>
      <h2 className="empty-deck__title">No slides yet</h2>
      <p className="empty-deck__desc">
        Start building your presentation or choose from a template.
      </p>
      <div className="empty-deck__actions">
        <Button ref={primaryButtonRef} variant="primary" iconStart="plus" onClick={onCreateSlide}>
          Create your first slide
        </Button>
        <Button variant="ghost" iconStart="layout" onClick={onBrowseTemplates}>
          Browse templates
        </Button>
      </div>
    </div>
  );
}
