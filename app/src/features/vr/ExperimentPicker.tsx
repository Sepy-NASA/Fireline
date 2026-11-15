import * as Dialog from '@radix-ui/react-dialog'
import { Check, ChevronDown, ChevronRight, FlaskConical, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import type { ExperimentOption } from './flamePanels'

export function ExperimentPicker({ options, selectedId, onSelect }: {
  options: ExperimentOption[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" aria-label={`Choose experiment, current ${selectedId}`} className="flex h-9 items-center gap-2 rounded-md border border-edge2 bg-panel2 px-3 text-xs text-text hover:border-bright/60">
          <FlaskConical className="size-4 text-bright" />
          <span className="hidden text-dim sm:inline">Experiment</span>
          <span className="font-mono">{selectedId}</span>
          <ChevronDown className="size-3.5 text-dim" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/80" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85dvh] w-[min(560px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-edge2 bg-panel p-6 shadow-pop">
          <Dialog.Title className="text-balance text-xl font-semibold text-text">Choose an experiment</Dialog.Title>
          <Dialog.Description className="mt-2 pr-5 text-pretty text-sm leading-relaxed text-dim">Select a recording to inspect its flame and sensor signals.</Dialog.Description>
          <Dialog.Close asChild><button type="button" aria-label="Close experiment picker" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-md text-dim hover:bg-panel2 hover:text-text"><X className="size-4" /></button></Dialog.Close>
          <div className="mt-5 grid gap-3">
            {options.map((option) => {
              const selected = selectedId === option.id
              return <button type="button" key={option.id} aria-label={`Select experiment ${option.id}`} aria-current={selected ? 'true' : undefined} onClick={() => { onSelect(option.id); setOpen(false) }} className={cn('rounded-lg border p-4 text-left hover:border-bright/70', selected ? 'border-bright/60 bg-bright/10' : 'border-edge2 bg-panel2')}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-base font-medium text-text">{option.label}</span>
                  {selected ? <span className="flex items-center gap-1.5 text-xs text-bright"><Check className="size-3.5" />Current</span> : <ChevronRight className="size-4 text-dim" />}
                </div>
                <p className="mt-2 text-sm text-text">{option.summary}</p>
                <p className="mt-1 text-xs leading-relaxed text-dim">{option.detail}</p>
              </button>
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
