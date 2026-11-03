import { useState, type ComponentProps } from "react";
import { Button } from "../components/Button.js";
import { Divider } from "../components/Divider.js";
import { IconButton } from "../components/IconButton.js";
import { cx } from "../lib/cx.js";

export type PresentViewProps = ComponentProps<"div"> & {
  slides?: number;
  currentSlide?: number;
  onSlideChange?: (slide: number) => void;
  onExit?: () => void;
};

export function PresentView({
  slides = 3,
  currentSlide: controlledSlide,
  onSlideChange,
  onExit,
  className,
  ...rest
}: PresentViewProps) {
  const [internalSlide, setInternalSlide] = useState(1);
  const current = controlledSlide ?? internalSlide;

  const setSlide = (n: number) => {
    if (controlledSlide === undefined) setInternalSlide(n);
    onSlideChange?.(n);
  };

  const handlePrev = () => {
    if (current > 1) setSlide(current - 1);
  };

  const handleNext = () => {
    if (current < slides) setSlide(current + 1);
  };

  return (
    <div
      className={cx("present-view", className)}
      role="region"
      aria-label="Presentation"
      {...rest}
    >
      <div className="present-view__stage">
        <div className="bigslide bigslide--present">
          <h1>Slide Deck Title</h1>
          <p>This is just the beginning of something big.</p>
        </div>
      </div>

      <div className="present-view__bar float">
        <IconButton
          icon="chevron-left"
          label="Previous slide"
          size="sm"
          disabled={current <= 1}
          onClick={handlePrev}
        />
        <span className="present-view__counter">
          {current} / {slides}
        </span>
        <IconButton
          icon="chevron-right"
          label="Next slide"
          size="sm"
          disabled={current >= slides}
          onClick={handleNext}
        />
        <Divider style={{ width: 1, height: 16, margin: "0 4px" }} />
        <Button size="sm" variant="secondary" onClick={onExit}>
          Exit
        </Button>
      </div>
    </div>
  );
}
