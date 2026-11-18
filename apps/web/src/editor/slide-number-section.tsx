import { numberCounts, numberFormats, shownSlideNumber, type SlideNumber, type SlideNumbers } from "@airdesign/document"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { slideNumberCopy as copy } from "@/copy/slide-number-copy"
import { DesignSection } from "./design-panel"

type Props = {
  readonly settings: SlideNumber
  readonly numbers: SlideNumbers
  readonly onChange: (settings: SlideNumber) => void
  readonly onAddAll: () => void
}

export function SlideNumberSection({ settings, numbers, onChange, onAddAll }: Props) {
  const formats = numberFormats.map((format) => {
    const shown = shownSlideNumber({ ...settings, format }, numbers)
    return { value: format, label: shown.number + shown.suffix }
  })
  return (
    <DesignSection title={copy.title}>
      <div className="grid grid-cols-2 items-center gap-2 text-[length:var(--type-caption)]">
        <span className="text-quiet">{copy.count}</span>
        <Select
          value={settings.count}
          onValueChange={(value) => {
            if (value !== null) onChange({ ...settings, count: value })
          }}
        >
          <SelectTrigger
            size="sm"
            aria-label={copy.count}
            className="w-full text-[length:var(--type-caption)] data-[size=sm]:h-[var(--control-dense)]"
          >
            <SelectValue>{copy.counts[settings.count]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {numberCounts.map((count) => (
              <SelectItem key={count} value={count}>
                {copy.counts[count]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-quiet">{copy.includeTotal}</span>
        <Switch
          size="sm"
          aria-label={copy.includeTotal}
          checked={settings.format !== null}
          className="justify-self-start"
          onCheckedChange={(checked) => onChange({ ...settings, format: checked ? "slash" : null })}
        />
        {settings.format === null ? null : (
          <>
            <span className="text-quiet">{copy.format}</span>
            <Select
              value={settings.format}
              onValueChange={(value) => {
                if (value !== null) onChange({ ...settings, format: value })
              }}
            >
              <SelectTrigger
                size="sm"
                aria-label={copy.format}
                className="w-full text-[length:var(--type-caption)] data-[size=sm]:h-[var(--control-dense)]"
              >
                <SelectValue>{formats.find((item) => item.value === settings.format)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {formats.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onAddAll}>
        {copy.addAll}
      </Button>
    </DesignSection>
  )
}
