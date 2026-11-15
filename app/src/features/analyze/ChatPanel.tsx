import { Bot, CornerDownLeft, ExternalLink, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import type { ChatMessage, Session, View } from '../../types'
import { ScrollArea } from '../../components/ui/scroll-area'
import {
  OFFERS,
  branchReply,
  detectionReply,
  evidenceReply,
  goalFirstReply,
  hasGoal,
  helpReply,
  nextActionsReply,
  safetyVerdictReply,
  suppressionReply,
  type ScriptedReply,
} from './roverScenario'

/* ————————————————————————————————————————————
   Left sidebar: chat with the simulated agent.
   Deterministic, scripted for the lunar-rover
   demo scenario (see roverScenario.ts).
   ———————————————————————————————————————————— */

const INTENTS: { match: RegExp; run: (sessionId: string) => ScriptedReply }[] = [
  { match: /\b(safe|unsafe)\b|probabilit|risk (score|match|percent)|certif|\bqualif/i, run: () => safetyVerdictReply() },
  { match: /suppress|\bflex\b|extinguish/i, run: suppressionReply },
  { match: /smoke|detect|alarm|\bdust\b|\bdaft\b/i, run: detectionReply },
  { match: /\bbranch\b/i, run: branchReply },
  { match: /\bnext\b|propose|close the gap|what remains/i, run: nextActionsReply },
  { match: /closest|evidence|pmma|acrylic|cotton|sibal|saffire|material|\bfind\b/i, run: evidenceReply },
]

/** Fixed "agent is thinking" time added to every reply (ms). */
export const THINKING_MS = 2000

/** Demo prompts — clicking fills the input so the presenter just presses Enter. */
const QUICK_PROMPTS: { label: string; text: string }[] = [
  {
    label: 'Find closest PSI evidence',
    text: 'Find the closest PSI evidence for PMMA and cotton-fiberglass. Compare its oxygen, flow, geometry, and results with this rover design. Add the best evidence and show what is not covered.',
  },
  { label: 'Create evidence-gap branch', text: 'Create the 30% O₂ rover material evidence branch.' },
  { label: 'Propose next actions', text: 'Propose the next engineering actions to close the gap.' },
  { label: 'Suppression follow-up', text: 'Add a suppression follow-up branch.' },
]

export function ChatPanel({ session }: { session: Session }) {
  const addMessage = useAppStore((s) => s.addMessage)
  const setView = useAppStore((s) => s.setView)
  const setSelected = useAppStore((s) => s.setSelectedNode)
  const setHighlight = useAppStore((s) => s.setHighlight)

  const [draft, setDraft] = useState('')
  const typing = useAppStore((s) => s.agentThinking)
  const setTyping = useAppStore((s) => s.setAgentThinking)
  const streamingMsgId = useAppStore((s) => s.streamingMsgId)
  const setStreamingMsgId = useAppStore((s) => s.setStreamingMsgId)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    const el = scrollRef.current
    const viewport = el?.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null
    if (viewport) viewport.scrollTop = viewport.scrollHeight
    else if (el) el.scrollTop = el.scrollHeight
  }
  useEffect(scrollToBottom, [session.messages.length, typing])

  // A stream that was interrupted (e.g. view switch) must not keep the input locked
  useEffect(() => {
    if (streamingMsgId && !session.messages.some((m) => m.id === streamingMsgId)) setStreamingMsgId(null)
  }, [streamingMsgId, session.messages, setStreamingMsgId])
  const busy = typing || Boolean(streamingMsgId)

  const runAction = (action: ScriptedReply) => {
    setTyping(true)
    // visible "thinking" before the reply starts streaming
    setTimeout(() => {
      action.apply?.()
      const id = `m_${Date.now().toString(36)}`
      setStreamingMsgId(id)
      addMessage(session.id, {
        id,
        role: 'agent',
        text: action.text,
        at: Date.now(),
        chips: action.chips,
        hrefs: action.hrefs,
        links: action.links,
      })
      if (action.highlight?.length) setHighlight(action.highlight, 2200)
      if (action.select) setSelected(action.select)
      setTyping(false)
    }, THINKING_MS)
  }

  const submit = () => {
    const q = draft.trim()
    if (!q || busy) return
    setDraft('')
    addMessage(session.id, { id: `m_${Date.now().toString(36)}`, role: 'user', text: q, at: Date.now() })
    if (!hasGoal(session)) return runAction(goalFirstReply())
    const intent = INTENTS.find((i) => i.match.test(q))
    runAction(intent ? intent.run(session.id) : helpReply())
  }

  return (
    <div className="flex w-[330px] shrink-0 flex-col border-r border-edge bg-panel">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-edge px-3">
        <Sparkles className="size-3.5 text-bright" />
        <span className="text-xs font-semibold text-text">Tracer — research copilot</span>
        <span className="ml-auto rounded bg-edge/50 px-1.5 py-0.5 text-[9px] text-faint">mock agent</span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div ref={scrollRef} className="flex flex-col gap-3 p-3">
          {session.messages.map((m) => (
            <Message
              key={m.id}
              m={m}
              setSelected={setSelected}
              setView={setView}
              session={session}
              streaming={m.id === streamingMsgId}
              onProgress={scrollToBottom}
              onDone={() => setStreamingMsgId(null)}
            />
          ))}
          {typing && !streamingMsgId && (
            <div className="flex items-center gap-2 text-xs text-faint">
              <span className="flex gap-0.5">
                <TypingDot delay={0} />
                <TypingDot delay={120} />
                <TypingDot delay={240} />
              </span>
              Tracer is searching the PSI index…
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="shrink-0 space-y-1.5 border-t border-edge p-3">
        <div className="flex flex-wrap gap-1">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => setDraft(p.text)}
              className="rounded border border-edge bg-panel2 px-1.5 py-0.5 text-[10px] text-faint transition-colors hover:border-edge2 hover:text-text"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-1.5 rounded-md border border-edge bg-panel2 px-2 py-1.5 focus-within:border-edge2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Ask about the evidence…"
            rows={3}
            className="min-h-8 w-full resize-none bg-transparent text-sm text-text placeholder:text-faint focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={!draft.trim() || busy}
            className="mb-0.5 text-bright transition-opacity disabled:opacity-30"
            aria-label="Send message"
          >
            <CornerDownLeft className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function TypingDot({ delay }: { delay: number }) {
  return <span className="size-1.5 animate-bounce rounded-full bg-bright" style={{ animationDelay: `${delay}ms` }} />
}

function Message({
  m,
  setSelected,
  setView,
  session,
  streaming = false,
  onProgress,
  onDone,
}: {
  m: ChatMessage
  setSelected: (id: string | null) => void
  setView: (v: View) => void
  session: Session
  streaming?: boolean
  onProgress?: () => void
  onDone?: () => void
}) {
  const isAgent = m.role === 'agent'
  return (
    <div className={isAgent ? 'space-y-2' : ''}>
      <div className={['flex items-start gap-2', isAgent ? '' : 'flex-row-reverse'].join(' ')}>
        {isAgent && (
          <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm bg-bright/15">
            <Bot className="size-3 text-bright" />
          </div>
        )}
        <div
          className={[
            'max-w-[92%] whitespace-pre-wrap text-[12.5px] leading-relaxed',
            isAgent ? 'text-text' : 'rounded-md border border-edge bg-panel2 px-2.5 py-1.5 text-text',
          ].join(' ')}
        >
          {streaming ? <StreamingText text={m.text} onProgress={onProgress} onDone={onDone} /> : m.text}
        </div>
      </div>
      {streaming ? null : (
        <>

      {m.chips && m.chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-7">
          {m.chips.map((c) => {
            const onCanvas = session.nodes.some((n) => n.id === c.nodeId)
            const offer = OFFERS[c.nodeId]
            return (
              <button
                key={c.nodeId}
                onClick={() => {
                  if (!onCanvas && offer) offer(session.id)
                  setSelected(c.nodeId)
                  useAppStore.getState().setHighlight([c.nodeId], 1400)
                }}
                disabled={!onCanvas && !offer}
                className={[
                  'rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-40',
                  onCanvas
                    ? 'border-bright/50 bg-bright/10 text-bright hover:bg-bright/20'
                    : 'border-dashed border-edge2 bg-panel2 text-dim hover:text-text',
                ].join(' ')}
                title={onCanvas ? 'Select on canvas' : offer ? 'Add to canvas as a separate follow-up' : 'Not on canvas'}
              >
                {onCanvas ? '◉ ' : '+ '}
                {c.label}
              </button>
            )
          })}
        </div>
      )}

      {m.hrefs && m.hrefs.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 pl-7">
          {m.hrefs.map((h) => (
            <a
              key={h.href + h.label}
              href={h.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-teal hover:underline"
            >
              {h.label} <ExternalLink className="size-3" />
            </a>
          ))}
        </div>
      )}

      {m.links && m.links.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-7">
          {m.links.map((l) => (
            <button
              key={l.label}
              onClick={() => {
                if (l.view === 'visualize') useAppStore.getState().setVizPreset('figures')
                setView(l.view)
              }} className="text-xs text-teal hover:underline">
              {l.label} →
            </button>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  )
}

/** Types the agent reply out progressively, like a streaming LLM response. */
function StreamingText({ text, onProgress, onDone }: { text: string; onProgress?: () => void; onDone?: () => void }) {
  const [n, setN] = useState(0)
  const done = useRef(false)
  useEffect(() => {
    // ~3.5 s for the longest replies, never slower than ~180 chars/s
    const step = Math.max(3, Math.ceil(text.length / 220))
    const t = setInterval(() => {
      setN((c) => {
        const next = Math.min(text.length, c + step)
        if (next >= text.length) clearInterval(t)
        return next
      })
    }, 16)
    return () => clearInterval(t)
  }, [text])
  useEffect(() => {
    onProgress?.()
    if (n >= text.length && !done.current) {
      done.current = true
      onDone?.()
    }
  }, [n, text.length, onProgress, onDone])
  return (
    <>
      {text.slice(0, n)}
      <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-bright/80" />
    </>
  )
}
