import * as Dialog from '@radix-ui/react-dialog'
import { Cable, Check, Database, FileText, Loader2, Plug, X } from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { EXTERNAL_SOURCES } from '../../generated/graph'
import { newId } from '../analyze/catalog'
import { Button } from '../../components/ui/button'
import { cn } from '../../lib/utils'

/* ————————————————————————————————————————————
   "Add data" — mock Connections dialog.
   Simulates connecting external sources
   (standards, databases, docs, MCP) that inject
   externalSource nodes into the active session.
   ———————————————————————————————————————————— */

const KIND_ICON: Record<string, React.ReactNode> = {
  standard: <FileText className="size-3.5" />,
  database: <Database className="size-3.5" />,
  document: <FileText className="size-3.5" />,
  mcp: <Cable className="size-3.5" />,
}

export function AddDataDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const sessions = useAppStore((s) => s.sessions)
  const activeId = useAppStore((s) => s.activeSessionId)
  const session = sessions.find((x) => x.id === activeId)
  const addNode = useAppStore((s) => s.addNode)
  const addEdge = useAppStore((s) => s.addEdge)
  const addMessage = useAppStore((s) => s.addMessage)

  const [connecting, setConnecting] = useState<string | null>(null)

  const connect = (src: (typeof EXTERNAL_SOURCES)[number]) => {
    if (!session || connecting) return
    setConnecting(src.id)
    setTimeout(() => {
      const existing = session.nodes.find((n) => n.data.ref === src.id)
      if (!existing) {
        const id = newId('externalSource', src.id)
        addNode(session.id, {
          id,
          type: 'externalSource',
          position: { x: 340 + Math.random() * 420, y: 140 + Math.random() * 280 },
          data: { kind: 'externalSource', ref: src.id, label: src.name, hint: src.note },
        })
        const anchor = session.nodes.find((n) => n.type === 'researchQuestion')
        if (anchor) {
          addEdge(session.id, {
            id: `e_${Date.now().toString(36)}_${id}`,
            source: anchor.id,
            target: id,
            label: src.kind === 'mcp' ? 'indexed via MCP' : 'linked',
            type: 'INDEXED_IN',
          })
        }
        addMessage(session.id, {
          id: `m_${Date.now().toString(36)}`,
          role: 'agent',
          text: `Connected "${src.name}"${src.kind === 'mcp' ? ' via the GFSS MCP — index updated with simulated telemetry' : ' — linked as an external source on your canvas'}.`,
          at: Date.now(),
        })
      }
      setConnecting(null)
    }, 1100)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[480px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-edge bg-panel p-4 shadow-pop focus:outline-none">
          <div className="mb-1 flex items-center gap-2">
            <Plug className="size-4 text-bright" />
            <Dialog.Title className="text-sm font-semibold text-text">Connect data</Dialog.Title>
            <Dialog.Description className="sr-only">Add external and MCP data sources to your session</Dialog.Description>
            <Button variant="ghost" size="icon" className="ml-auto" onClick={() => onOpenChange(false)} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>
          <p className="mb-3 text-[12px] text-dim">
            Pull external standards, documents, and mock MCP sources into the canvas. Each connection adds a linked
            node and a note from the copilot.
          </p>

          <div className="space-y-1.5">
            {EXTERNAL_SOURCES.map((src) => {
              const connected = session?.nodes.some((n) => n.data.ref === src.id)
              const busy = connecting === src.id
              return (
                <button
                  key={src.id}
                  onClick={() => connect(src)}
                  disabled={connected || busy}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md border border-edge/60 bg-panel2 px-2.5 py-2 text-left transition-colors',
                    'enabled:hover:border-edge2 enabled:hover:bg-edge/20',
                    connected && 'opacity-50',
                  )}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-bright/10 text-bright">
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : connected ? <Check className="size-3.5 text-teal" /> : KIND_ICON[src.kind]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-text">{src.name}</span>
                    <span className="block truncate text-[10px] text-faint">{src.note}</span>
                  </span>
                  <span className="rounded bg-edge/40 px-1.5 py-0.5 text-[9px] text-faint">
                    {busy ? 'indexing…' : connected ? 'connected' : src.kind}
                  </span>
                </button>
              )
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
