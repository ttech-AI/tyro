import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Attachment01Icon,
  Mic01Icon,
  ArrowRight01Icon,
  TextBoldIcon,
  TextItalicIcon,
  TextUnderlineIcon,
  LeftToRightListBulletIcon,
  TextFontIcon,
  File01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { AgentSelect } from "./AgentSelect"
import { useLocale } from "@/hooks/useLocale"
import { cn } from "@/lib/utils"

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function FormatButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault() /* keep textarea focus */}
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      <HugeiconsIcon icon={icon} className="size-4" strokeWidth={1.8} />
    </button>
  )
}

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
  const fileInputRef = useRef(null)
  const [attachments, setAttachments] = useState([])
  const [richTextOpen, setRichTextOpen] = useState(false)

  // auto-resize
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = "auto"
    const max = 6 * 24 // ~6 lines of 24px line-height
    el.style.height = Math.min(el.scrollHeight, max) + "px"
  }, [value])

  // Focus on mount, but ONLY on hover-capable pointer devices. On mobile,
  // programmatic focus pops the soft keyboard (Android) or jumps the
  // viewport (iOS) the moment the user lands on the page — both ruin the
  // welcome experience. The user can always tap to focus.
  useEffect(() => {
    if (typeof window === "undefined") return
    const isTouch = "ontouchstart" in window || !window.matchMedia("(pointer: fine)").matches
    if (!isTouch) taRef.current?.focus()
  }, [])


  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && (value.trim() || attachments.length > 0)) {
        handleSendClick()
      }
    }
  }

  function handleSendClick() {
    onSend?.()
    setAttachments([])
  }

  // ---------- Attachments ----------
  function openFilePicker() {
    fileInputRef.current?.click()
  }

  function handleFiles(e) {
    const picked = Array.from(e.target.files || [])
    if (picked.length === 0) return
    setAttachments((prev) => [
      ...prev,
      ...picked.map((file) => ({
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
      })),
    ])
    e.target.value = ""
  }

  function removeAttachment(id) {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  // ---------- Rich text — markdown syntax insertion ----------
  function insertSyntax(prefix, suffix = prefix, lineMode = false) {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = value.slice(0, start)
    const selected = value.slice(start, end)
    const after = value.slice(end)

    let next
    let cursorStart
    let cursorEnd

    if (lineMode) {
      // List mode: prefix each line of selection (or current line if empty)
      const block = selected || ""
      const lines = block ? block.split("\n") : [""]
      const prefixed = lines.map((l) => (l.startsWith(prefix) ? l : `${prefix}${l}`)).join("\n")
      next = `${before}${prefixed}${after}`
      cursorStart = start + prefix.length
      cursorEnd = start + prefixed.length
    } else if (selected) {
      next = `${before}${prefix}${selected}${suffix}${after}`
      cursorStart = start + prefix.length
      cursorEnd = end + prefix.length
    } else {
      // No selection: insert syntax with cursor between
      next = `${before}${prefix}${suffix}${after}`
      cursorStart = cursorEnd = start + prefix.length
    }

    onChange?.(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(cursorStart, cursorEnd)
    })
  }

  const hasContent = value.trim().length > 0 || attachments.length > 0

  return (
    // OUTER beam host. Must NOT have overflow:hidden — the beam's
    // ::before sits at inset:-2px (OUTSIDE the inner border), so any
    // overflow clip here would slice it off. The outer wrapper is also
    // where the brand-halo box-shadow lives.
    <div className={cn("composer-beam relative w-full rounded-2xl", className)}>
      {/* INNER chrome — keeps overflow:hidden so the rich-text toolbar
          and attachments tray AnimatePresence height tweens don't jut
          out of the rounded corners. */}
      <div
        className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      >
      {/* Rich text toolbar */}
      <AnimatePresence initial={false}>
        {richTextOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-b border-border/60 bg-muted/30"
          >
            <div className="flex items-center gap-0.5 px-3 py-1.5">
              <FormatButton
                icon={TextBoldIcon}
                label={t("chat.format.bold")}
                onClick={() => insertSyntax("**")}
              />
              <FormatButton
                icon={TextItalicIcon}
                label={t("chat.format.italic")}
                onClick={() => insertSyntax("_")}
              />
              <FormatButton
                icon={TextUnderlineIcon}
                label={t("chat.format.underline")}
                onClick={() => insertSyntax("<u>", "</u>")}
              />
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-border/70" />
              <FormatButton
                icon={LeftToRightListBulletIcon}
                label={t("chat.format.bulletList")}
                onClick={() => insertSyntax("- ", "", true)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachments preview */}
      <AnimatePresence initial={false}>
        {attachments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-b border-border/60 bg-muted/20"
          >
            <div className="flex flex-wrap gap-2 px-4 py-2.5 sm:px-6">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="group inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 text-xs"
                >
                  <HugeiconsIcon
                    icon={File01Icon}
                    className="size-3.5 shrink-0 text-brand-deep"
                    strokeWidth={1.6}
                  />
                  <span className="max-w-[160px] truncate font-medium" title={att.name}>
                    {att.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatFileSize(att.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    aria-label={t("chat.attach.remove")}
                    className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-3" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Textarea */}
      <div className="px-4 pt-4 sm:px-6 sm:pt-5">
        <Textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chat.placeholder")}
          rows={2}
          inputMode="text"
          enterKeyHint="send"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          aria-multiline="true"
          aria-label={t("chat.placeholder")}
          className="min-h-[56px] sm:min-h-[64px] resize-none border-0 bg-transparent dark:bg-transparent px-0 py-0 text-[16px] sm:text-base leading-7 shadow-none focus-visible:ring-0 focus-visible:border-0"
        />
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={openFilePicker}
            className="size-9 text-muted-foreground hover:text-foreground"
            aria-label={t("chat.attach")}
          >
            <HugeiconsIcon icon={Attachment01Icon} className="size-[18px]" />
          </Button>
          <AgentSelect value={agent} onChange={onAgentChange} />
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Rich-text toggle — hidden on mobile (ChatGPT/Claude mobile
              composers omit it too). Stays available on tablet+ where the
              row has room. */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setRichTextOpen((v) => !v)}
            aria-label={t("chat.format.toggle")}
            aria-pressed={richTextOpen}
            className={cn(
              "hidden text-muted-foreground hover:text-foreground sm:inline-flex sm:size-9",
              richTextOpen && "bg-brand-soft/60 text-brand-deep",
            )}
          >
            <HugeiconsIcon icon={TextFontIcon} className="size-[18px]" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onMicToggle}
            aria-label={t("chat.mic")}
            aria-pressed={micActive}
            className={cn(
              "size-9 rounded-full text-muted-foreground hover:text-foreground sm:size-9",
              micActive && "bg-brand-soft/60 text-brand-deep",
            )}
          >
            <HugeiconsIcon icon={Mic01Icon} className="size-[18px]" />
          </Button>
          <Button
            type="button"
            onClick={handleSendClick}
            disabled={disabled || !hasContent}
            aria-label={t("chat.send")}
            className={cn(
              "size-10 rounded-full bg-gradient-to-br from-brand-from via-brand-via to-brand-to p-0 text-white shadow-sm sm:size-10",
              "duration-200 ease-linear hover:brightness-110 hover:text-white",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" />
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
      </div>
    </div>
  )
}
