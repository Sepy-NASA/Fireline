import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, ArrowLeft, Cable, Check, Database, FileText, FileUp, Loader2, Plug, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { EXTERNAL_SOURCES } from '../../generated/graph'
import { newId } from '../analyze/catalog'
import { Button } from '../../components/ui/button'
import { cn } from '../../lib/utils'
import { MOCK_DOCS, applyDocument, hasGoal, matchMockDoc, type FieldStatus, type MockDoc } from './roverScenario'

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
  const [review, setReview] = useState<{ doc: MockDoc; fileName: string; url: string } | null>(null)
  const [extracting, setExtracting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // release the blob URL of the previewed PDF
  useEffect(() => () => { if (review) URL.revokeObjectURL(review.url) }, [review])

  const handleFile = (file: File) => {
    if (extracting) return
    setError(null)
    if (session && !hasGoal(session)) {
      setError('Define the review goal first (Step 1 on the canvas), then upload the documents.')
      return
    }
    const doc = matchMockDoc(file.name)
    if (!file.name.toLowerCase().endsWith('.pdf') || !doc) {
      setError(`"${file.name}" is not a recognised engineering document. Expected the rover design basis or the cabin materials BOM.`)
      return
    }
    setExtracting(file.name)
    const url = URL.createObjectURL(file)
    setTimeout(() => {
      setReview({ doc, fileName: file.name, url })
      setExtracting(null)
    }, 1400)
  }

  /** Backup for the demo: load the bundled copy of a demo PDF. */
  const loadBundled = async (doc: MockDoc) => {
    const res = await fetch(encodeURI(doc.file))
    const blob = await res.blob()
    handleFile(new File([blob], doc.name, { type: 'application/pdf' }))
  }

  const confirmDoc = () => {
    if (!session || !review) return
    applyDocument(session.id, review.doc, review.doc.fields)
    setReview(null)
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
          text: `Connected "${src.name}"${src.kind === 'mcp' ? ' via the GFSS MCP — index updated with habitat telemetry' : ' — linked as an external source on your canvas'}.`,
          at: Date.now(),
        })
      }
      setConnecting(null)
    }, 1100)
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setReview(null)
          setError(null)
        }
        onOpenChange(o)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] max-w-[96vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-edge bg-panel p-4 shadow-pop focus:outline-none"
          style={{ width: review ? 1180 : 640 }}
        >
          <div className="mb-1 flex items-center gap-2">
            <Plug className="size-4 text-bright" />
            <Dialog.Title className="text-sm font-semibold text-text">Connect data</Dialog.Title>
            <Dialog.Description className="sr-only">Add external and MCP data sources to your session</Dialog.Description>
            <Button variant="ghost" size="icon" className="ml-auto" onClick={() => onOpenChange(false)} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>
          {review ? (
            <DocReview review={review} onBack={() => setReview(null)} onConfirm={confirmDoc} />
          ) : (
            <>
              <p className="mb-2 mt-1 text-[11px] font-semibold text-faint">Engineer documents · upload PDF</p>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                  e.target.value = ''
                }}
              />
              <button
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const f = e.dataTransfer.files?.[0]
                  if (f) handleFile(f)
                }}
                disabled={Boolean(extracting)}
                className={cn(
                  'flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
                  dragOver ? 'border-bright bg-bright/10' : 'border-edge2 bg-panel2 hover:border-bright/60',
                )}
              >
                {extracting ? (
                  <>
                    <Loader2 className="size-6 animate-spin text-bright" />
                    <span className="text-[12.5px] text-text">Reading “{extracting}”…</span>
                    <span className="text-[10.5px] text-faint">extracting pressure, atmosphere, airflow and material fields</span>
                  </>
                ) : (
                  <>
                    <Upload className="size-6 text-bright" />
                    <span className="text-[12.5px] text-text">Drop a PDF here or click to choose a file</span>
                    <span className="text-[10.5px] text-faint">Rover design basis or cabin materials BOM</span>
                  </>
                )}
              </button>
              {error && (
                <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-flame">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {error}
                </p>
              )}
              <div className="mb-1 mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-faint">Recent files:</span>
                {MOCK_DOCS.map((doc) => {
                  const attached = session?.nodes.some((n) => n.id === doc.nodeId)
                  return (
                    <button
                      key={doc.id}
                      onClick={() => loadBundled(doc)}
                      disabled={Boolean(extracting)}
                      className="inline-flex items-center gap-1 rounded border border-edge px-1.5 py-0.5 text-[10.5px] text-dim hover:border-edge2 hover:text-text"
                    >
                      {attached ? <Check className="size-3 text-teal" /> : <FileUp className="size-3" />}
                      {doc.name}
                    </button>
                  )
                })}
              </div>
              <p className="mb-3 text-[10px] leading-snug text-faint">
                Pressure, atmosphere, airflow and material fields are extracted for you to confirm before use.
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

const STATUS_STYLE: Record<FieldStatus, { label: string; cls: string }> = {
  confirmed: { label: 'Stated', cls: 'border-bright/50 bg-bright/10 text-bright' },
  provisional: { label: 'Provisional', cls: 'border-amber/50 bg-amber/10 text-amber' },
  unknown: { label: 'TBD → unknown', cls: 'border-dashed border-faint text-dim' },
}

function DocReview({
  review,
  onBack,
  onConfirm,
}: {
  review: { doc: MockDoc; fileName: string; url: string }
  onBack: () => void
  onConfirm: () => void
}) {
  const { doc, fileName, url } = review
  const unknownCount = doc.fields.filter((f) => f.status === 'unknown' || !f.value).length
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-faint hover:text-text" aria-label="Back">
          <ArrowLeft className="size-4" />
        </button>
        <FileText className="size-4 text-bright" />
        <span className="text-[13px] font-semibold text-text">{fileName}</span>
        <span className="rounded border border-amber/40 px-1.5 py-0.5 text-[10px] text-amber">Engineer-provided document</span>
      </div>
      <div className="grid grid-cols-[1fr_440px] gap-3">
        <div className="overflow-hidden rounded-md border border-edge bg-white">
          <iframe title={`Preview of ${fileName}`} src={`${url}#view=FitH&toolbar=0&navpanes=0`} className="h-[66vh] w-full" />
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex items-start gap-2 rounded-md border border-amber/40 bg-amber/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Extracted from the PDF. Check the values against the preview, then confirm. They become mission inputs on the canvas —
              a value from a document is never treated as a measurement.
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-edge">
            {doc.fields.map((f) => (
              <div key={f.key} className="border-b border-edge px-2.5 py-2 last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] text-dim">{f.label}</span>
                  <span className={cn('rounded border px-1.5 py-px text-[9.5px]', STATUS_STYLE[f.status].cls)}>{STATUS_STYLE[f.status].label}</span>
                </div>
                <p className={cn('text-[13px] font-semibold', f.value ? 'text-text' : 'italic font-normal text-faint')}>{f.value || 'TBD in document'}</p>
                <p className="font-mono text-[9.5px] text-faint">{f.source}</p>
                {f.note && <p className="mt-0.5 text-[10.5px] leading-snug text-faint">{f.note}</p>}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10.5px] text-faint">
              {unknownCount > 0 ? `${unknownCount} field${unknownCount === 1 ? '' : 's'} will stay visibly unknown.` : 'All fields have values.'}
            </p>
            <Button size="sm" onClick={onConfirm}>
              <Check /> Confirm &amp; add to canvas
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
