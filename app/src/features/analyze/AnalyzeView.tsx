import { useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCcw } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { ChatPanel } from './ChatPanel'
import { GraphCanvas } from './GraphCanvas'
import { RightPanel } from './RightPanel'
import { buildDemoSession, buildFreshSession } from './sessionSeed'
import { Button } from '../../components/ui/button'
import { cn } from '../../lib/utils'
import type { Session } from '../../types'

/* ————————————————————————————————————————————
   Analyze workspace. Three-column layout per
   wireframe: left chat · center canvas (+ context
   card) · right palette/details. Session rail on
   the far left.
   ———————————————————————————————————————————— */

export function AnalyzeView() {
  const sessions = useAppStore((s) => s.sessions)
  const activeId = useAppStore((s) => s.activeSessionId)
  const createSession = useAppStore((s) => s.createSession)
  const setActive = useAppStore((s) => s.setActiveSession)
  const renameSession = useAppStore((s) => s.renameSession)

  const session = sessions.find((x) => x.id === activeId)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')

  // Seed a demo session on first load (idempotent — guards against double-run)
  useEffect(() => {
    if (useAppStore.getState().sessions.length === 0) {
      const demo = buildDemoSession()
      useAppStore.setState((s) => ({
        sessions: [demo, ...s.sessions],
        activeSessionId: demo.id,
      }))
    }
  }, [])

  const sessionRail = useMemo(
    () => (
      <div className="flex w-44 shrink-0 flex-col border-r border-edge bg-panel2">
        <div className="flex h-9 items-center justify-between border-b border-edge px-2.5">
          <span className="text-[11px] font-semibold text-faint">Sessions</span>
          <button
            onClick={() => {
              const fresh = buildFreshSession('Untitled session', '')
              useAppStore.setState((s) => ({
                sessions: [fresh, ...s.sessions],
                activeSessionId: fresh.id,
              }))
            }}
            className="text-bright hover:opacity-80"
            aria-label="New session"
            title="New session"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {sessions.map((s) => (
            <div key={s.id}>
              {editingName === s.id ? (
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={() => {
                    if (nameDraft.trim()) renameSession(s.id, nameDraft.trim())
                    setEditingName(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (nameDraft.trim()) renameSession(s.id, nameDraft.trim())
                      setEditingName(null)
                    }
                  }}
                  className="h-7 w-full rounded border border-bright bg-panel px-1.5 text-xs text-text focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => setActive(s.id)}
                  onDoubleClick={() => {
                    setEditingName(s.id)
                    setNameDraft(s.name)
                  }}
                  className={cn(
                    'w-full rounded-md px-2 py-1.5 text-left text-xs leading-snug transition-colors',
                    s.id === activeId ? 'bg-bright/15 text-bright' : 'text-dim hover:bg-edge/30 hover:text-text',
                  )}
                >
                  {s.name}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-edge p-1.5">
          <button
            onClick={() => {
              const demo = buildDemoSession()
              useAppStore.setState((s) => ({
                sessions: [demo, ...s.sessions],
                activeSessionId: demo.id,
              }))
            }}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-edge px-2 py-1.5 text-xs text-dim transition-colors hover:border-edge2 hover:text-text"
          >
            <RefreshCcw className="size-3" /> Reset demo
          </button>
        </div>
      </div>
    ),
    [sessions, activeId, editingName, nameDraft, createSession, renameSession, setActive],
  )

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center">
        <Button onClick={() => createSession('Untitled session', '')}>Start a session</Button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0">
      {sessionRail}
      <ChatPanel session={session} />
      <CenterPane session={session} />
      <RightPanel />
    </div>
  )
}

function CenterPane({ session }: { session: Session }) {
  const [showContext, setShowContext] = useState(true)
  return (
    <div className="relative min-w-0 flex-1">
      <GraphCanvas />
      {showContext && (
        <div className="absolute left-3 top-1/2 z-10 w-60 -translate-y-1/2 rounded-md border border-edge bg-panel/95 p-3 shadow-pop backdrop-blur">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-faint">Session context</span>
            <button
              onClick={() => setShowContext(false)}
              className="text-faint hover:text-text"
              aria-label="Dismiss context card"
            >
              ×
            </button>
          </div>
          <div className="space-y-2.5 text-[12px] leading-relaxed text-dim">
            <div>
              <p className="mb-0.5 font-semibold text-text">Goal</p>
              <p>{session.researchStatement}</p>
            </div>
            <div>
              <p className="mb-0.5 font-semibold text-text">Characteristics</p>
              <p>
                {session.nodes.length} nodes · {session.edges.length} links ·{' '}
                {session.branches.length} branch{session.branches.length === 1 ? '' : 'es'}
              </p>
            </div>
            <div>
              <p className="mb-0.5 font-semibold text-text">Context</p>
              <p>PSI combustion index, linked to Explore &amp; the working set.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
