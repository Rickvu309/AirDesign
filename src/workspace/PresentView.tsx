import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Button } from "../components/Button.js";
import { Divider } from "../components/Divider.js";
import { IconButton } from "../components/IconButton.js";
import { cx } from "../lib/cx.js";

export interface PresentSlideItem {
  title: string;
  body?: string;
}

export type PresentViewProps = ComponentProps<"div"> & {
  slides?: number | PresentSlideItem[];
  currentSlide?: number;
  onSlideChange?: (slide: number) => void;
  onExit?: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

export function PresentView({
  slides = 3,
  currentSlide: controlledSlide,
  onSlideChange,
  onExit,
  returnFocusRef,
  className,
  ...rest
}: PresentViewProps) {
  const slideItems: PresentSlideItem[] = Array.isArray(slides)
    ? slides
    : Array.from({ length: typeof slides === "number" && slides > 0 ? slides : 1 }, (_, i) => ({
        title: `Slide ${i + 1}`,
        body: `Content for slide ${i + 1}`,
      }));

  const totalSlides = slideItems.length;
  const [internalSlide, setInternalSlide] = useState(controlledSlide ?? 1);
  const current = controlledSlide !== undefined && onSlideChange ? controlledSlide : internalSlide;
  const currentItem = slideItems[current - 1] ?? slideItems[0] ?? { title: `Slide ${current}` };

  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackFocusRef = useRef<HTMLElement | null>(null);
  const capturedRef = useRef(false);

  useEffect(() => {
    if (controlledSlide !== undefined) {
      setInternalSlide(controlledSlide);
    }
  }, [controlledSlide]);

  useEffect(() => {
    // StrictMode-safe: only capture once if returnFocusRef was not supplied
    if (!returnFocusRef && !capturedRef.current) {
      fallbackFocusRef.current = document.activeElement as HTMLElement | null;
      capturedRef.current = true;
    }
    containerRef.current?.focus();
    return () => {
      const target = returnFocusRef?.current ?? fallbackFocusRef.current;
      target?.focus();
    };
  }, [returnFocusRef]);

  const setSlide = (n: number) => {
    const clamped = Math.max(1, Math.min(totalSlides, n));
    setInternalSlide(clamped);
    onSlideChange?.(clamped);
  };

  const handlePrev = () => {
    if (current > 1) setSlide(current - 1);
  };

  const handleNext = () => {
    if (current < totalSlides) setSlide(current + 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowLeft":
      case "PageUp":
        e.preventDefault();
        handlePrev();
        break;
      case "ArrowRight":
      case "PageDown":
      case " ":
        e.preventDefault();
        handleNext();
        break;
      case "Home":
        e.preventDefault();
        setSlide(1);
        break;
      case "End":
        e.preventDefault();
        setSlide(totalSlides);
        break;
      case "Escape":
        e.preventDefault();
        onExit?.();
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={cx("present-view", className)}
      role="region"
      aria-label="Presentation"
      {...rest}
    >
      <div className="present-view__stage">
        <div className="bigslide bigslide--present">
          <h1>{currentItem.title}</h1>
          {currentItem.body && <p>{currentItem.body}</p>}
        </div>
      </div>

      <div className="present-view__bar float">
        <IconButton
          icon="chevron-left"
          label="Previous slide"
          size="sm"
          iconSize={16}
          disabled={current <= 1}
          onClick={handlePrev}
        />
        <span className="present-view__counter" aria-live="polite">
          {current} / {totalSlides}
        </span>
        <IconButton
          icon="chevron-right"
          label="Next slide"
          size="sm"
          iconSize={16}
          disabled={current >= totalSlides}
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
