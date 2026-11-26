import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/class-names"

const outline =
  "bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity,transform] outline-none select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:not-aria-busy:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary-strong text-primary-foreground hover:bg-strong-hover active:bg-strong-hover active:translate-y-0",
        signature:
          "border-0 bg-[image:var(--fill-marketing)] text-primary-foreground shadow-[inset_0_1px_0_var(--white-35),0_2px_6px_var(--strong-20)] hover:bg-[image:var(--fill-marketing-hover)] active:bg-[image:var(--fill-marketing-active)]",
        outline: cn("border-border", outline),
        "outline-field": cn("border-field-edge", outline),
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        "panel-action":
          "p-0 text-[var(--panel-icon)] hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground active:translate-y-0 dark:hover:bg-muted/50",
        "panel-segment":
          "h-[var(--control-dense)] gap-1.5 rounded-[var(--panel-segment-radius)] p-0 text-xs font-normal text-quiet hover:bg-transparent hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground active:translate-y-0 aria-pressed:bg-white aria-pressed:font-medium aria-pressed:text-foreground aria-pressed:shadow-[inset_0_0_0_1px_var(--panel-edge)] aria-pressed:hover:bg-white aria-pressed:data-inherited:text-quiet",
        "picker-icon": "border-0 p-0 text-quiet active:translate-y-0",
        "picker-swatch":
          "aspect-square w-full rounded-md border-0 p-0 active:translate-y-0 data-edged:shadow-[0px_0px_0px_1px_var(--field-edge)] aria-pressed:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]",
        destructive:
          "bg-destructive/10 text-danger-text hover:bg-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30",
        "destructive-solid":
          "border-0 bg-danger-solid text-white shadow-[inset_0_0_0_1px_var(--danger-edge)] hover:bg-danger-solid",
        link: "text-primary-strong underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[length:var(--type-dense)] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        "panel-caption":
          "h-6 gap-1 rounded-[min(var(--radius-md),12px)] px-1.5 text-[length:var(--type-caption)] font-normal text-quiet active:translate-y-0 in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        compact: "h-7 gap-1 px-2.5 text-[length:var(--type-dense)]",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        dialog: "h-9 px-4",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return <ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
