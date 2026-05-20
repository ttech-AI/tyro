import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { IconPicker } from "./IconPicker"
import { LogoUpload } from "./LogoUpload"
import { useLocale } from "@/hooks/useLocale"

function emptyState(kind) {
  if (kind === "agent") {
    return {
      name: "",
      description: "",
      tenantId: "",
      clientId: "",
      agentId: "",
      iconName: "Robot01Icon",
      logo: null,
    }
  }
  return {
    name: "",
    description: "",
    url: "",
    iconName: "AppsIcon",
    logo: null,
  }
}

export function EntityForm({ kind, open, initialValue, onClose, onSave }) {
  if (!open) return null
  return (
    <EntityFormInner
      key={initialValue?.id ?? `new-${kind}`}
      kind={kind}
      initialValue={initialValue}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

function EntityFormInner({ kind, initialValue, onClose, onSave }) {
  const { t } = useLocale()
  const [form, setForm] = useState(() => initialValue ?? emptyState(kind))

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }))
  }

  function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave?.({ ...form, name: form.name.trim() })
  }

  const isAgent = kind === "agent"
  const isEditing = Boolean(initialValue?.id)

  const titleKey = isAgent
    ? isEditing
      ? "settings.agent.editTitle"
      : "settings.agent.newTitle"
    : kind === "aiApp"
      ? isEditing
        ? "settings.aiApp.editTitle"
        : "settings.aiApp.newTitle"
      : isEditing
        ? "settings.businessApp.editTitle"
        : "settings.businessApp.newTitle"

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t(titleKey)}</DialogTitle>
            <DialogDescription>{t("settings.form.subtitle")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="entity-name">{t("settings.field.name")}</Label>
              <Input
                id="entity-name"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder={isAgent ? "TYRO HR" : "tyroSign"}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="entity-desc">{t("settings.field.description")}</Label>
              <Textarea
                id="entity-desc"
                value={form.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder={t("settings.field.descriptionPlaceholder")}
                rows={2}
              />
            </div>

            {isAgent ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="entity-tenant">{t("settings.field.tenantId")}</Label>
                  <Input
                    id="entity-tenant"
                    value={form.tenantId}
                    onChange={(e) => update({ tenantId: e.target.value })}
                    placeholder="00000000-..."
                    className="font-mono text-xs"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="entity-client">{t("settings.field.clientId")}</Label>
                  <Input
                    id="entity-client"
                    value={form.clientId}
                    onChange={(e) => update({ clientId: e.target.value })}
                    placeholder="00000000-..."
                    className="font-mono text-xs"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="entity-agent">{t("settings.field.agentId")}</Label>
                  <Input
                    id="entity-agent"
                    value={form.agentId}
                    onChange={(e) => update({ agentId: e.target.value })}
                    placeholder="agent-id"
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="entity-url">{t("settings.field.url")}</Label>
                <Input
                  id="entity-url"
                  type="url"
                  value={form.url}
                  onChange={(e) => update({ url: e.target.value })}
                  placeholder="https://"
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label>{t("settings.field.icon")}</Label>
              <IconPicker
                value={form.iconName}
                onChange={(name) => update({ iconName: name })}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>{t("settings.field.logo")}</Label>
              <LogoUpload value={form.logo} onChange={(logo) => update({ logo })} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("settings.action.cancel")}
            </Button>
            <Button type="submit" disabled={!form.name.trim()}>
              {isEditing ? t("settings.action.save") : t("settings.action.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
