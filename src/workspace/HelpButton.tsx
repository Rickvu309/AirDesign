import { IconButton, type IconButtonProps } from "../components/IconButton.js";
import { cx } from "../lib/cx.js";

export type HelpButtonProps = Partial<IconButtonProps>;

export function HelpButton({
  className,
  icon = "help",
  label = "Help",
  variant = "secondary",
  iconSize = 24,
  ...rest
}: HelpButtonProps) {
  return (
    <IconButton
      className={cx("help", className)}
      icon={icon}
      label={label}
      variant={variant}
      iconSize={iconSize}
      {...rest}
    />
  );
}
