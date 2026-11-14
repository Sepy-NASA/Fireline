import * as Dialog from '@radix-ui/react-dialog'
import { PanelRightClose, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'

const TYPE_LABELS: Record<string, string> = {
  dataset: 'dataset',
  investigation: 'investigation',
  file: 'file',
}

export function WorkingSetTray() {
  const open = useAppStore((s) => s.trayOpen)
  const setOpen = useAppStore((s) => s.setTrayOpen)
  const items = useAppStore((s) => s.workingItems)
  const groups = useAppStore((s) => s.workingGroups)
  const remove = useAppStore((s) => s.removeWorkingItem)
  const clear = useAppStore((s) => s.clearWorkingItems)
  const addGroup = useAppStore((s) => s.addWorkingGroup)
  const removeGroup = useAppStore((s) => s.removeWorkingGroup)
  const setView = useAppStore((s) => s.setView)

  const [groupName, setGroupName] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const ungrouped = items.filter((i) => !groups.some((g) => g.itemIds.includes(i.id)))

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed inset-y-0 right-0 flex w-[360px] max-w-[90vw] flex-col border-l border-edge bg-panel shadow-pop focus:outline-none">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-edge px-3">
            <PanelRightClose className="size-4 text-dim" />
            <Dialog.Title className="text-sm font-semibold">Working set</Dialog.Title>
            <Dialog.Description className="sr-only">
              Files and investigations chosen for analysis
            </Dialog.Description>
            <div className="ml-auto flex items-center gap-2">
              {items.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clear} className="text-faint">
                  <Trash2 /> Clear
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                <PanelRightClose className="rotate-180" />
              </Button>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-3 p-3">
              {items.length === 0 && (
                <div className="mt-8 text-center text-sm text-dim">
                  <p className="mb-1 font-medium text-text">Nothing selected yet</p>
                  <p>
                    Choose files or investigations in{' '}
                    <button
                      className="text-bright underline"
                      onClick={() => {
                        setOpen(false)
                        setView('explore')
                      }}
                    >
                      Explore
                    </button>{' '}
                    and send them here for analysis.
                  </p>
                </div>
              )}

              {groups.map((g) => (
                <section key={g.id} className="rounded-md border border-edge bg-panel2">
                  <header className="flex items-center gap-2 border-b border-edge px-2 py-1.5">
                    <span className="text-xs font-semibold text-teal">{g.name}</span>
                    <button
                      onClick={() => removeGroup(g.id)}
                      className="ml-auto text-faint hover:text-flame"
                      aria-label={`Delete group ${g.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </header>
                  <ul className="flex flex-col">
                    {items
                      .filter((i) => g.itemIds.includes(i.id))
                      .map((i) => (
                        <TrayItem
                          key={i.id}
                          id={i.id}
                          label={i.label}
                          sub={i.sub}
                          typeLabel={i.type}
                          tags={i.tags}
                          selected={selected.has(i.id)}
                          onToggle={() => toggle(i.id)}
                          onRemove={() => remove(i.id)}
                        />
                      ))}
                  </ul>
                </section>
              ))}

              {ungrouped.length > 0 && (
                <ul className="flex flex-col">
                  {ungrouped.map((i) => (
                    <TrayItem
                      key={i.id}
                      id={i.id}
                      label={i.label}
                      sub={i.sub}
                      typeLabel={i.type}
                      tags={i.tags}
                      selected={selected.has(i.id)}
                      onToggle={() => toggle(i.id)}
                      onRemove={() => remove(i.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </ScrollArea>

          <div className="shrink-0 space-y-2 border-t border-edge p-3">
            <div className="flex gap-1.5">
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group selected items…"
                aria-label="Group name"
              />
              <Button
                size="sm"
                disabled={!groupName.trim() || selected.size === 0}
                onClick={() => {
                  addGroup(groupName.trim(), [...selected])
                  setGroupName('')
                  setSelected(new Set())
                }}
              >
                <Plus /> Group
              </Button>
            </div>
            <button
              onClick={() => {
                setOpen(false)
                setView('visualize')
              }}
              disabled={items.length === 0}
              className="h-8 w-full rounded-md bg-bright text-xs font-semibold text-ink transition-colors hover:bg-bright/85 disabled:opacity-40"
            >
              Go to visualization
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function TrayItem({
  id,
  label,
  sub,
  typeLabel,
  tags,
  selected,
  onToggle,
  onRemove,
}: {
  id: string
  label: string
  sub: string
  typeLabel: string
  tags: string[]
  selected: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <li className="group flex items-start gap-2 px-2 py-2">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        aria-label={`Select ${label}`}
        className="mt-0.5 size-3.5 accent-[#4da3ff]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm text-text">{label}</span>
          <Badge variant="muted">{TYPE_LABELS[typeLabel] ?? typeLabel}</Badge>
        </div>
        <p className="truncate text-xs text-dim">{sub}</p>
        {tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded bg-edge/40 px-1 py-0.5 text-[10px] text-faint">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onRemove}
        className="ml-1 self-start text-faint transition-colors hover:text-flame"
        aria-label={`Remove ${label} (${id})`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  )
}
