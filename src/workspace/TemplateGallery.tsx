import { useState, type ReactNode } from "react";
import { Dialog, type DialogProps } from "../components/Dialog.js";
import { IconButton } from "../components/IconButton.js";
import { SearchField } from "../components/Input.js";
import { Tabs, type TabItem } from "../components/Tabs.js";
import { cx } from "../lib/cx.js";

export interface TemplateCardItem {
  id: string;
  title: string;
  category: string;
  slides: number;
}

export const defaultTemplates: TemplateCardItem[] = [
  { id: "pitch", title: "Startup Pitch", category: "pitch", slides: 12 },
  { id: "all-hands", title: "Company All-Hands", category: "company", slides: 8 },
  { id: "product", title: "Product Launch", category: "product", slides: 10 },
  { id: "quarterly", title: "Quarterly Review", category: "company", slides: 14 },
  { id: "portfolio", title: "Design Portfolio", category: "minimal", slides: 16 },
  { id: "executive", title: "Executive Briefing", category: "pitch", slides: 6 },
];

const categoryTabs: TabItem[] = [
  { id: "all", label: "All" },
  { id: "pitch", label: "Pitch deck" },
  { id: "product", label: "Product" },
  { id: "company", label: "Company" },
  { id: "minimal", label: "Minimal" },
];

export type TemplateGalleryProps = Omit<DialogProps, "title" | "children" | "onSelect"> & {
  title?: ReactNode;
  templates?: TemplateCardItem[];
  onSelect?: (templateId: string) => void;
  onBack?: () => void;
};

function TemplateThumbPreview({ id }: { id: string }) {
  switch (id) {
    case "pitch":
      return (
        <div className="thumb-preview thumb-preview--pitch">
          <div className="thumb-preview__bar thumb-preview__bar--wide" />
          <div className="thumb-preview__split">
            <div className="thumb-preview__box" />
            <div className="thumb-preview__box" />
          </div>
        </div>
      );
    case "all-hands":
      return (
        <div className="thumb-preview thumb-preview--allhands">
          <div className="thumb-preview__bar" />
          <div className="thumb-preview__rows">
            <div className="thumb-preview__row" />
            <div className="thumb-preview__row" />
            <div className="thumb-preview__row" />
          </div>
        </div>
      );
    case "product":
      return (
        <div className="thumb-preview thumb-preview--product">
          <div className="thumb-preview__hero" />
          <div className="thumb-preview__bar" />
        </div>
      );
    case "quarterly":
      return (
        <div className="thumb-preview thumb-preview--chart">
          <div className="thumb-preview__bars">
            <span style={{ height: "40%" }} />
            <span style={{ height: "70%" }} />
            <span style={{ height: "55%" }} />
            <span style={{ height: "90%" }} />
          </div>
          <div className="thumb-preview__line" />
        </div>
      );
    case "portfolio":
      return (
        <div className="thumb-preview thumb-preview--grid">
          <div className="thumb-preview__tile" />
          <div className="thumb-preview__tile" />
          <div className="thumb-preview__tile" />
          <div className="thumb-preview__tile" />
        </div>
      );
    case "executive":
    default:
      return (
        <div className="thumb-preview thumb-preview--exec">
          <div className="thumb-preview__center-title" />
          <div className="thumb-preview__bar thumb-preview__bar--short" />
          <div className="thumb-preview__bar thumb-preview__bar--short" />
        </div>
      );
  }
}

export function TemplateGallery({
  title,
  templates = defaultTemplates,
  open,
  onClose,
  onSelect,
  onBack,
  className,
  ...rest
}: TemplateGalleryProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const filtered = templates.filter((t) => {
    const matchCat = category === "all" || t.category === category;
    const matchQuery = !search.trim() || t.title.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title ?? "Template gallery"}
      className={cx("start templates-dialog", className)}
      initialFocus="dialog"
      {...rest}
    >
      <div className="templates__body">
        <div className="templates__filter-bar">
          {onBack && (
            <IconButton
              icon="chevron-left"
              label="Back"
              size="sm"
              onClick={onBack}
            />
          )}
          <Tabs
            label="Template categories"
            items={categoryTabs}
            value={category}
            onValueChange={setCategory}
          />
          <div className="templates__search">
            <SearchField
              label="Search templates"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="templates__grid" role="region" aria-label="Available templates">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="template-card ad ad-card ad-card--interactive"
              onClick={() => onSelect?.(item.id)}
            >
              <div className="templates__thumb">
                <TemplateThumbPreview id={item.id} />
              </div>
              <div className="ad-card__body">
                <div className="ad-card__title">{item.title}</div>
                <div className="ad-card__meta">{item.slides} slides</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
