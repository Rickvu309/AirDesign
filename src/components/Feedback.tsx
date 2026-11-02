import type { ComponentProps, ReactNode } from "react";
import { Icon } from "../icons/Icon.js";
import type { IconName } from "../icons/icon-data.js";
import { cx } from "../lib/cx.js";

export function Spinner({ label = "Loading", className, ...rest }: ComponentProps<"span"> & { label?: string }) {
  return <span role="status" aria-label={label} className={cx("ad ad-spinner ad-spinner--lg", className)} {...rest} />;
}

export type ProgressProps = Omit<ComponentProps<"div">, "children"> & {
  /** Accessible name. */
  label: string;
  /** 0 to max. Omit for an indeterminate bar. */
  value?: number;
  max?: number;
};

export function Progress({ label, value, max = 100, className, ...rest }: ProgressProps) {
  const determinate = value !== undefined;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={determinate ? value : undefined}
      className={cx("ad ad-progress", !determinate && "ad-progress--indeterminate", className)}
      {...rest}
    >
      <div className="ad-progress__bar" style={determinate ? { width: `${(value / max) * 100}%` } : undefined} />
    </div>
  );
}

/** Placeholder block shown while content loads. Hidden from assistive tech; announce loading elsewhere. */
export function Skeleton({ className, style, ...rest }: ComponentProps<"div">) {
  return <div aria-hidden="true" className={cx("ad ad-skeleton", className)} style={style} {...rest} />;
}

export type EmptyStateProps = Omit<ComponentProps<"div">, "title"> & {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  /** Usually a Button. */
  action?: ReactNode;
};

export function EmptyState({ icon = "file", title, description, action, className, ...rest }: EmptyStateProps) {
  return (
    <div className={cx("ad ad-empty", className)} {...rest}>
      <Icon name={icon} size={24} className="ad-empty__icon" />
      <div className="ad-empty__title">{title}</div>
      {description && <div className="ad-empty__desc">{description}</div>}
      {action}
    </div>
  );
}

export type AlertProps = Omit<ComponentProps<"div">, "title"> & { tone?: "info" | "warning" | "danger"; title?: ReactNode };

/** Inline message. Use `danger` and `warning` for things the user must notice (role=alert). */
export function Alert({ tone = "info", title, className, children, ...rest }: AlertProps) {
  return (
    <div role={tone === "info" ? "status" : "alert"} className={cx("ad ad-alert", `ad-alert--${tone}`, className)} {...rest}>
      <Icon name={tone === "info" ? "info" : "warning"} />
      <div>{title && <div className="ad-alert__title">{title}</div>}{children}</div>
    </div>
  );
}
