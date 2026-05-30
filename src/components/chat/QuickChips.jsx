import { HugeiconsIcon } from "@hugeicons/react"
import {
  StickyNote01Icon,
  BubbleChatTranslateIcon,
  PaintBoardIcon,
  AiSearch02Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/useLocale"

const CHIPS = [
  { id: "summary", labelKey: "chat.chips.summary", prefixKey: "chat.chips.prefix.summary", icon: StickyNote01Icon },
  { id: "translate", labelKey: "chat.chips.translate", prefixKey: "chat.chips.prefix.translate", icon: BubbleChatTranslateIcon },
  { id: "design", labelKey: "chat.chips.design", prefixKey: "chat.chips.prefix.design", icon: PaintBoardIcon },
  { id: "research", labelKey: "chat.chips.research", prefixKey: "chat.chips.prefix.research", icon: AiSearch02Icon },
]

export function QuickChips({ onChip }) {
  const { t } = useLocale()
  return (
    // Horizontal scroll-snap row on mobile so chips never wrap awkwardly into
    // 2-3 lines; flex-wrap layout on sm+ centers the chips like before.
    // Hide the scrollbar visually but leave keyboard arrow-key scroll intact.
    <div
      role="group"
      aria-label={t("chat.chips.aria")}
      className="-mx-1 flex w-full items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:pb-0"
    >
      {CHIPS.map((chip) => (
        <Button
          key={chip.id}
          variant="outline"
          size="sm"
          onClick={() => onChip?.(t(chip.prefixKey))}
          className="h-11 shrink-0 snap-start gap-2 rounded-full border-border/70 bg-background px-4 text-sm font-medium text-foreground/80 hover:text-foreground sm:h-10 sm:shrink"
        >
          <HugeiconsIcon icon={chip.icon} className="size-[18px] text-brand-via" strokeWidth={1.6} />
          {t(chip.labelKey)}
        </Button>
      ))}
    </div>
  )
}
