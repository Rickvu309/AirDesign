import { useState, type ReactNode } from "react";
import { Card } from "../components/Card.js";
import { Dialog, type DialogProps } from "../components/Dialog.js";
import { IconButton } from "../components/IconButton.js";
import { SearchField } from "../components/Input.js";
import { Tabs, type TabItem } from "../components/Tabs.js";
import { cx } from "../lib/cx.js";
import { SlideThumb } from "./SlideThumb.js";

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

export type TemplateGalleryProps = Omit<DialogProps, "title" | "children"> & {
  title?: ReactNode;
  templates?: TemplateCardItem[];
  onSelect?: (templateId: string) => void;
  onBack?: () => void;
};

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

  const headerTitle = title ?? (
    <span className="templates__title">
      {onBack && (
        <IconButton
          icon="chevron-left"
          label="Back"
          size="sm"
          onClick={onBack}
        />
      )}
      <span>Template gallery</span>
    </span>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={headerTitle}
      className={cx("start templates-dialog", className)}
      initialFocus="dialog"
      {...rest}
    >
      <div className="templates__body">
        <div className="templates__filter-bar">
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
            <Card
              key={item.id}
              interactive
              media={
                <div className="templates__thumb">
                  <SlideThumb title={item.title} />
                </div>
              }
              title={item.title}
              meta={`${item.slides} slides`}
              onClick={() => onSelect?.(item.id)}
            />
          ))}
        </div>
      </div>
    </Dialog>
  );
}
