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
import { ROOT_TEXT, defineGoal, hasGoal, isRoverSession } from './roverScenario'

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

  // Seed the demo session whenever there is none (first load, storage reset, HMR)
  const seedDemo = () => {
    const demo = buildDemoSession()
    useAppStore.setState((s) => ({
      sessions: [demo, ...s.sessions],
      activeSessionId: demo.id,
      selectedNodeId: null,
      selectedNodeIds: [],
      focusedBranchId: null,
    }))
  }
  useEffect(() => {
    const st = useAppStore.getState()
    if (st.sessions.length === 0) seedDemo()
    else if (!st.sessions.some((x) => x.id === st.activeSessionId)) st.setActiveSession(st.sessions[0].id)
  }, [sessions.length, activeId])

  const sessionRail = useMemo(
    () => (
      <div className="flex w-40 shrink-0 flex-col border-r border-edge bg-panel2">
        <div className="flex h-9 items-center justify-between border-b border-edge px-2.5">
          <span className="text-[11px] font-semibold text-faint">Sessions</span>
          <button
            onClick={() => {
              const fresh = buildFreshSession('Untitled session', '')
              useAppStore.setState((s) => ({
                sessions: [fresh, ...s.sessions],
                activeSessionId: fresh.id,
                selectedNodeId: null,
                selectedNodeIds: [],
                focusedBranchId: null,
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
                selectedNodeId: null,
                selectedNodeIds: [],
                focusedBranchId: null,
              }))
            }}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-edge px-2 py-1.5 text-xs text-dim transition-colors hover:border-edge2 hover:text-text"
          >
            <RefreshCcw className="size-3" /> New review
          </button>
        </div>
      </div>
    ),
    [sessions, activeId, editingName, nameDraft, createSession, renameSession, setActive],
  )

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center">
        <Button onClick={seedDemo}>Start the rover review session</Button>
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
  const goalDefined = hasGoal(session)
  return (
    <div className="relative min-w-0 flex-1">
      <GraphCanvas rightInset={0} />
      {!goalDefined && <GoalStartCard session={session} />}
    </div>
  )
}

/** Step 1 of a review: the canvas starts empty and asks for the goal. */
function GoalStartCard({ session }: { session: Session }) {
  const [draft, setDraft] = useState('')
  const isRover = isRoverSession(session)
  const create = () => {
    if (draft.trim()) defineGoal(session.id, draft)
  }
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
      <div className="w-[520px] max-w-full rounded-lg border border-edge2 bg-panel/95 p-5 shadow-pop backdrop-blur">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-bright">Step 1 · Define the goal</p>
        <p className="mt-1 text-[15px] font-semibold text-text">What should this review answer?</p>
        <p className="mt-1 text-[12px] leading-relaxed text-dim">
          The goal becomes the root of the canvas. Mission inputs and materials come next — from the documents you upload.
        </p>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) create()
          }}
          rows={5}
          placeholder="e.g. Assess the PSI evidence relevant to the rover cabin materials…"
          className="mt-3 w-full resize-none rounded-md border border-edge2 bg-panel2 px-2.5 py-2 text-[13px] leading-relaxed text-text placeholder:text-faint focus:border-bright focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          {isRover ? (
            <button
              onClick={() => setDraft(ROOT_TEXT)}
              className="rounded border border-edge px-2 py-1 text-[11px] text-dim transition-colors hover:border-edge2 hover:text-text"
            >
              Use rover review question
            </button>
          ) : (
            <span />
          )}
          <Button size="sm" disabled={!draft.trim()} onClick={create}>
            Set goal
          </Button>
        </div>
      </div>
    </div>
  )
}
