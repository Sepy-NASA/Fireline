import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, ArrowLeft, Cable, Check, Database, FileText, FileUp, Loader2, Plug, X } from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { EXTERNAL_SOURCES } from '../../generated/graph'
import { newId } from '../analyze/catalog'
import { Button } from '../../components/ui/button'
import { cn } from '../../lib/utils'
import { MOCK_DOCS, applyDocument, type ExtractedField, type FieldStatus, type MockDoc } from './roverScenario'

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
  const [reviewDoc, setReviewDoc] = useState<MockDoc | null>(null)
  const [extracting, setExtracting] = useState<string | null>(null)
  const [fields, setFields] = useState<ExtractedField[]>([])

  const openDoc = (doc: MockDoc) => {
    if (extracting) return
    setExtracting(doc.id)
    setTimeout(() => {
      setFields(doc.fields.map((f) => ({ ...f })))
      setReviewDoc(doc)
      setExtracting(null)
    }, 900)
  }

  const confirmDoc = () => {
    if (!session || !reviewDoc) return
    applyDocument(session.id, reviewDoc, fields)
    setReviewDoc(null)
    onOpenChange(false)
  }

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
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) setReviewDoc(null); onOpenChange(o) }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 w-[620px] max-w-[94vw] max-h-[90vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-lg border border-edge bg-panel p-4 shadow-pop focus:outline-none">
          <div className="mb-1 flex items-center gap-2">
            <Plug className="size-4 text-bright" />
            <Dialog.Title className="text-sm font-semibold text-text">Connect data</Dialog.Title>
            <Dialog.Description className="sr-only">Add external and MCP data sources to your session</Dialog.Description>
            <Button variant="ghost" size="icon" className="ml-auto" onClick={() => onOpenChange(false)} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>
          {reviewDoc ? (
            <DocReview doc={reviewDoc} fields={fields} setFields={setFields} onBack={() => setReviewDoc(null)} onConfirm={confirmDoc} />
          ) : (
            <>
              <p className="mb-2 mt-1 text-[11px] font-semibold text-faint">Engineer documents · mock upload</p>
              <div className="mb-1 space-y-1.5">
                {MOCK_DOCS.map((doc) => {
                  const attached = session?.nodes.some((n) => n.id === doc.nodeId)
                  const busy = extracting === doc.id
                  return (
                    <button
                      key={doc.id}
                      onClick={() => openDoc(doc)}
                      disabled={busy}
                      className="flex w-full items-center gap-2.5 rounded-md border border-bright/30 bg-bright/5 px-2.5 py-2 text-left transition-colors hover:border-bright/60"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-bright/15 text-bright">
                        {busy ? <Loader2 className="size-3.5 animate-spin" /> : attached ? <Check className="size-3.5 text-teal" /> : <FileUp className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] text-text">{doc.name}</span>
                        <span className="block truncate text-[10px] text-faint">{doc.summary}</span>
                      </span>
                      <span className="rounded bg-edge/40 px-1.5 py-0.5 text-[9px] text-faint">
                        {busy ? 'extracting…' : attached ? 'attached · review again' : 'pdf · mock'}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="mb-3 text-[10px] leading-snug text-faint">
                Demo fixtures — not NASA source documents. Extraction is simulated; you confirm every value before it is used.
              </p>

              <p className="mb-2 text-[11px] font-semibold text-faint">Other sources</p>
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
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const STATUS_LABEL: Record<FieldStatus, string> = { confirmed: 'Confirmed', provisional: 'Provisional', unknown: 'Unknown' }

function DocReview({
  doc,
  fields,
  setFields,
  onBack,
  onConfirm,
}: {
  doc: MockDoc
  fields: ExtractedField[]
  setFields: (f: ExtractedField[]) => void
  onBack: () => void
  onConfirm: () => void
}) {
  const update = (key: string, patch: Partial<ExtractedField>) =>
    setFields(fields.map((f) => (f.key === key ? { ...f, ...patch } : f)))
  const unknownCount = fields.filter((f) => f.status === 'unknown' || !f.value).length
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-faint hover:text-text" aria-label="Back">
          <ArrowLeft className="size-4" />
        </button>
        <FileText className="size-4 text-bright" />
        <span className="text-[13px] font-semibold text-text">{doc.name}</span>
      </div>
      <div className="flex items-start gap-2 rounded-md border border-amber/40 bg-amber/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Engineer-provided document (mock upload). Fields below are simulated extraction from a seeded fixture — confirm or edit each value.
          A PDF sentence is never treated as an experimental measurement.
        </span>
      </div>
      <div className="overflow-hidden rounded-md border border-edge">
        <div className="grid grid-cols-[150px_1fr_110px] gap-2 bg-panel2 px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-wide text-faint">
          <span>Field · source</span>
          <span>Value</span>
          <span>Status</span>
        </div>
        {fields.map((f) => (
          <div key={f.key} className="grid grid-cols-[150px_1fr_110px] items-start gap-2 border-t border-edge px-2.5 py-2">
            <div>
              <p className="text-[11.5px] text-text">{f.label}</p>
              <p className="font-mono text-[9.5px] text-faint">{f.source}</p>
            </div>
            <div>
              <input
                value={f.value}
                onChange={(e) =>
                  update(f.key, {
                    value: e.target.value,
                    status: e.target.value && f.status === 'unknown' ? 'confirmed' : !e.target.value ? 'unknown' : f.status,
                  })
                }
                placeholder="not stated — leave unknown"
                className={cn(
                  'h-7 w-full rounded border bg-panel2 px-2 text-[12px] text-text placeholder:italic placeholder:text-faint focus:outline-none focus:border-bright',
                  f.status === 'unknown' ? 'border-dashed border-edge2' : 'border-edge',
                )}
              />
              {f.note && <p className="mt-0.5 text-[10px] leading-snug text-faint">{f.note}</p>}
            </div>
            <select
              value={f.status}
              onChange={(e) => update(f.key, { status: e.target.value as FieldStatus })}
              className={cn(
                'h-7 rounded border border-edge bg-panel2 px-1.5 text-[11px] focus:outline-none',
                f.status === 'confirmed' ? 'text-bright' : f.status === 'provisional' ? 'text-amber' : 'text-dim',
              )}
            >
              {(['confirmed', 'provisional', 'unknown'] as FieldStatus[]).map((st) => (
                <option key={st} value={st}>
                  {STATUS_LABEL[st]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10.5px] text-faint">
          {unknownCount > 0 ? `${unknownCount} field${unknownCount === 1 ? '' : 's'} will stay visibly unknown on the canvas.` : 'All fields have values.'}
        </p>
        <Button size="sm" onClick={onConfirm}>
          <Check /> Confirm &amp; add to canvas
        </Button>
      </div>
    </div>
  )
}
