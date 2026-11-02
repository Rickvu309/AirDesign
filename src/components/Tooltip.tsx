import { useId, cloneElement, type ReactElement } from "react";

export interface TooltipProps {
  label: string;
  /** A single focusable element. It gets aria-describedby pointing at the label. */
  children: ReactElement<{ "aria-describedby"?: string }>;
}

export function Tooltip({ label, children }: TooltipProps) {
  const id = useId();
  return (
    <span className="ad ad-tip">
      {cloneElement(children, { "aria-describedby": id })}
      <span role="tooltip" id={id} className="ad-tip__label">{label}</span>
    </span>
  );
}
