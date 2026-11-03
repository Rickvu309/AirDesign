import type { ComponentProps, ReactNode } from "react";
import { Icon } from "../icons/Icon.js";
import { cx } from "../lib/cx.js";

export type PanelHeaderProps = ComponentProps<"div"> & {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onTitleClick?: () => void;
};

export function PanelHeader({
  title,
  subtitle,
  trailing,
  onTitleClick,
  className,
  ...rest
}: PanelHeaderProps) {
  return (
    <div className={cx("lp__head", className)} {...rest}>
      <div>
        <button type="button" className="lp__title" onClick={onTitleClick}>
          {title}
          <Icon name="chevron-down-small" size={16} />
        </button>
        {subtitle && <div className="lp__sub">{subtitle}</div>}
      </div>
      {trailing}
    </div>
  );
}
