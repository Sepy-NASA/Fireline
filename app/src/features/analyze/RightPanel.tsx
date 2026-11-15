import { Database, ListPlus, Trash2, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { KIND_META, PALETTE_GROUPS } from './nodeSystem'
import { catalogForKind, entityForNode, newId } from './catalog'
import { NodeDetailsBody } from './nodeDetails'
import { AddDataDialog } from './AddDataDialog'
import { BranchSummary, ScenarioNodeDetails, hasScenarioDetails } from './scenarioDetails'
import { Button } from '../../components/ui/button'
import { ScrollArea } from '../../components/ui/scroll-area'
import type { GraphEdge, GraphNode, NodeKind, Session } from '../../types'

/* ————————————————————————————————————————————
   Right sidebar. Default mode: "add to canvas"
   palette. When a node is selected: details panel.
   Bottom: prominent "Add data" action (mock
   connections / upload).
   ———————————————————————————————————————————— */

export function RightPanel() {
  const selectedNodeId = useAppStore((s) => s.selectedNodeId)
  const setSelected = useAppStore((s) => s.setSelectedNode)
  const sessions = useAppStore((s) => s.sessions)
  const activeId = useAppStore((s) => s.activeSessionId)
  const session = sessions.find((x) => x.id === activeId)
  const addNode = useAppStore((s) => s.addNode)
  const addEdge = useAppStore((s) => s.addEdge)
  const removeNode = useAppStore((s) => s.removeNode)
  const addWorkingItems = useAppStore((s) => s.addWorkingItems)
  const [addDataOpen, setAddDataOpen] = useState(false)

  const selectedNode = session?.nodes.find((n) => n.id === selectedNodeId) ?? null
  const focusedBranchId = useAppStore((s) => s.focusedBranchId)
  const setFocusedBranch = useAppStore((s) => s.setFocusedBranchId)
  const focusedBranch = session?.branches.find((b) => b.id === focusedBranchId) ?? null

  const addToWorkingSet = (node: { data: { kind: string; ref: string; label: string } }) => {
    const entity = entityForNode(node.data)
    if (entity && 'rows' in entity) {
      addWorkingItems([
        {
          id: `ws_${node.data.ref}`,
          type: 'dataset',
          ref: node.data.ref,
          label: node.data.label,
          sub: `${entity.rows} test rows`,
          tags: ['dataset', ...(entity.columns.slice(0, 2))],
        },
      ])
    } else if (entity) {
      addWorkingItems([
        {
          id: `ws_${node.data.ref}`,
          type: 'investigation',
          ref: node.data.ref,
          label: node.data.label,
          sub: entity.accession,
          tags: [entity.safetyArea],
        },
      ])
    }
  }

  if (!session) {
    return (
      <aside className="flex w-[340px] shrink-0 flex-col border-l border-edge bg-panel">
        <div className="p-4 text-sm text-faint">Create or open a session to start analyzing.</div>
      </aside>
    )
  }

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-edge bg-panel">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-edge px-3">
        {selectedNode ? (
          <>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-bright hover:underline"
            >
              ← back
            </button>
            <span className="text-xs font-semibold text-text">Node details</span>
          </>
        ) : focusedBranch ? (
          <>
            <button onClick={() => setFocusedBranch(null)} className="text-xs text-bright hover:underline">
              ← back
            </button>
            <span className="text-xs font-semibold text-text">Branch summary</span>
          </>
        ) : (
          <span className="text-xs font-semibold text-text">Add to canvas</span>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {selectedNode ? (
          <div className="flex flex-col gap-3 p-3">
            {hasScenarioDetails(selectedNode) ? (
              <ScenarioNodeDetails node={selectedNode} session={session} onOpenAddData={() => setAddDataOpen(true)} />
            ) : (
              <NodeDetailsBody node={selectedNode.data} />
            )}
            <div className="mt-1 space-y-2 border-t border-edge pt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => removeNode(session.id, selectedNode.id)}
              >
                <Trash2 /> Remove from canvas
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => addToWorkingSet(selectedNode)}
              >
                <Database /> Add to working set
              </Button>
            </div>
          </div>
        ) : focusedBranch ? (
          <BranchSummary session={session} branch={focusedBranch} />
        ) : (
          <Palette session={session} addNode={addNode} addEdge={addEdge} />
        )}
      </ScrollArea>

      <div className="shrink-0 space-y-2 border-t border-edge p-3">
        <button
          onClick={() => setAddDataOpen(true)}
          className="h-9 w-full rounded-md bg-bright text-sm font-semibold text-ink transition-colors hover:bg-bright/85"
        >
          <span className="inline-flex items-center gap-1.5">
            <Upload className="size-3.5" /> Add data / documents
          </span>
        </button>
        <p className="text-center text-[11px] text-faint">
          Upload engineer PDFs · PSI · standards · MCP
        </p>
      </div>
      <AddDataDialog open={addDataOpen} onOpenChange={setAddDataOpen} />
    </aside>
  )
}

function Palette({
  session,
  addNode,
  addEdge,
}: {
  session: Session
  addNode: (sessionId: string, node: GraphNode) => void
  addEdge: (sessionId: string, edge: GraphEdge) => void
}) {
  const [q, setQ] = useState('')
  const existing = useMemo(() => new Set(session.nodes.map((n) => n.data.ref)), [session.nodes])
  const isInCanvas = (ref: string) => existing.has(ref)

  const groups = useMemo(() => {
    return PALETTE_GROUPS.map((g) => ({
      ...g,
      entries: g.kinds.flatMap((k) => {
        const list = catalogForKind(k)
        if (!q) return list
        const needle = q.toLowerCase()
        return list.filter((e) => e.label.toLowerCase().includes(needle))
      }),
    })).filter((g) => g.entries.length > 0)
  }, [q])

  const addEntry = (kind: string, ref: string, label: string, hint: string) => {
    if (isInCanvas(ref)) return
    const id = newId(kind as NodeKind, ref)
    addNode(session.id, {
      id,
      type: kind as NodeKind,
      position: { x: 320 + Math.random() * 420, y: 120 + Math.random() * 300 },
      data: { kind: kind as NodeKind, ref, label, hint },
    })
    // connect to nearest research question if present
    const anchor = session.nodes.find((n) => n.type === 'researchQuestion')
    if (anchor) {
      addEdge(session.id, {
        id: `e_${Date.now().toString(36)}`,
        source: anchor.id,
        target: id,
        label: 'relates to',
        type: 'RELATES_TO',
      })
    }
  }

  return (
    <div className="space-y-4 p-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search node types…"
        className="h-8 w-full rounded-md border border-edge bg-panel2 px-2.5 text-sm text-text placeholder:text-faint focus:outline-2 focus:outline-bright"
        aria-label="Search node types"
      />

      {groups.map((g) => (
        <section key={g.title}>
          <p className="mb-1.5 text-[11px] font-semibold text-faint">{g.title}</p>
          <ul className="space-y-1">
            {g.entries.map((e) => {
              const inCanvas = isInCanvas(e.ref)
              const meta = KIND_META[e.kind]
              return (
                <li key={e.stableId}>
                  <button
                    onClick={() =>
                      inCanvas ? undefined : addEntry(e.kind, e.ref, e.label, e.hint)
                    }
                    disabled={inCanvas}
                    title={e.hint}
                    className="flex w-full items-center gap-2 rounded-md border border-edge/60 px-2 py-1.5 text-left transition-colors enabled:hover:border-edge2 enabled:hover:bg-edge/20 disabled:opacity-40"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: meta.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-text">{e.label}</span>
                      {e.hint && (
                        <span className="block truncate text-[11px] text-faint">{e.hint}</span>
                      )}
                    </span>
                    {inCanvas ? (
                      <span className="text-[10px] text-teal">added</span>
                    ) : (
                      <ListPlus className="size-3.5 text-faint" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <p className="text-[11px] leading-relaxed text-faint">
        Tip: hover the graph to preview facts. Select a node to open its details.
      </p>
    </div>
  )
}
