import { useEffect, useRef } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Attachment01Icon, Mic01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { AgentSelect } from "./AgentSelect"
import { useLocale } from "@/hooks/useLocale"
import { cn } from "@/lib/utils"

export function ChatComposer({
  value,
  onChange,
  onSend,
  agent,
  onAgentChange,
  onMicToggle,
  micActive,
  disabled,
  className,
}) {
  const { t } = useLocale()
  const taRef = useRef(null)

  // auto-resize
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = "auto"
    const max = 6 * 24 // ~6 lines of 24px line-height
    el.style.height = Math.min(el.scrollHeight, max) + "px"
  }, [value])

  // focus on mount
  useEffect(() => {
    taRef.current?.focus()
  }, [])

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) {
        onSend?.()
      }
    }
  }

  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      <div className="px-4 pt-4 sm:px-6 sm:pt-5">
        <Textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chat.placeholder")}
          rows={2}
          inputMode="text"
          className="min-h-[56px] sm:min-h-[64px] resize-none border-0 bg-transparent dark:bg-transparent px-0 py-0 text-[16px] sm:text-base leading-7 shadow-none focus-visible:ring-0 focus-visible:border-0"
        />
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-10 text-muted-foreground hover:text-foreground"
            aria-label={t("chat.attach")}
          >
            <HugeiconsIcon icon={Attachment01Icon} className="size-5" />
          </Button>
          <AgentSelect value={agent} onChange={onAgentChange} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMicToggle}
            aria-label={t("chat.mic")}
            aria-pressed={micActive}
            className={cn(
              "size-10 rounded-full text-muted-foreground hover:text-foreground",
              micActive && "bg-brand-soft/60 text-brand-deep",
            )}
          >
            <HugeiconsIcon icon={Mic01Icon} className="size-5" />
          </Button>
          <Button
            type="button"
            onClick={onSend}
            disabled={disabled || !value.trim()}
            aria-label={t("chat.send")}
            className={cn(
              "size-10 rounded-full bg-gradient-to-br from-brand-from via-brand-via to-brand-to p-0 text-white shadow-sm",
              "duration-200 ease-linear hover:brightness-110 hover:text-white",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            <HugeiconsIcon icon={ArrowUp01Icon} className="size-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
