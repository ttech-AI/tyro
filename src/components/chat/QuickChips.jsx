import { HugeiconsIcon } from "@hugeicons/react"
import {
  StickyNote01Icon,
  SourceCodeIcon,
  PaintBoardIcon,
  AiSearch02Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/useLocale"

const CHIPS = [
  { id: "summary", labelKey: "chat.chips.summary", prefixKey: "chat.chips.prefix.summary", icon: StickyNote01Icon },
  { id: "code", labelKey: "chat.chips.code", prefixKey: "chat.chips.prefix.code", icon: SourceCodeIcon },
  { id: "design", labelKey: "chat.chips.design", prefixKey: "chat.chips.prefix.design", icon: PaintBoardIcon },
  { id: "research", labelKey: "chat.chips.research", prefixKey: "chat.chips.prefix.research", icon: AiSearch02Icon },
]

export function QuickChips({ onChip }) {
  const { t } = useLocale()
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {CHIPS.map((chip) => (
        <Button
          key={chip.id}
          variant="outline"
          size="sm"
          onClick={() => onChip?.(t(chip.prefixKey))}
          className="h-10 gap-2 rounded-full border-border/70 bg-background px-4 text-sm font-medium text-foreground/80 hover:text-foreground"
        >
          <HugeiconsIcon icon={chip.icon} className="size-4 text-brand-via" />
          {t(chip.labelKey)}
        </Button>
      ))}
    </div>
  )
}
