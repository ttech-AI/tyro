import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, Tick01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IconOrLogo } from "@/components/common/IconOrLogo"
import { useConfig } from "@/hooks/useConfig"

export function AgentSelect({ value, onChange }) {
  const { agents, getAgent } = useConfig()
  const current = getAgent(value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-full border-border/70 bg-background px-3.5 text-sm font-medium"
        >
          <span className="grid size-4 shrink-0 place-items-center overflow-hidden rounded-sm">
            <IconOrLogo
              iconName={current?.iconName}
              logo={current?.logo}
              className="size-4"
            />
          </span>
          <span>{current?.name}</span>
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[min(280px,calc(100vw-2rem))] sm:w-56"
      >
        {agents.map((agent) => (
          <DropdownMenuItem
            key={agent.id}
            onClick={() => onChange?.(agent.id)}
            className="flex items-center gap-2"
          >
            <span className="grid size-4 shrink-0 place-items-center overflow-hidden rounded-sm text-brand-deep">
              <IconOrLogo
                iconName={agent.iconName}
                logo={agent.logo}
                className="size-4"
              />
            </span>
            <span className="flex-1">{agent.name}</span>
            {value === agent.id && (
              <HugeiconsIcon icon={Tick01Icon} className="size-3.5 text-brand-via" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
