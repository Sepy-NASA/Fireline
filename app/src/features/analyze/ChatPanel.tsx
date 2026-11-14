import { Bot, CornerDownLeft, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import type { ChatMessage, Session } from '../../types'
import { catalogForKind, entityForNode, entryForStableId, newId } from './catalog'
import { ScrollArea } from '../../components/ui/scroll-area'

/* ————————————————————————————————————————————
   Left sidebar: chat with the simulated agent.
   Intents add nodes to the canvas, attach chips,
   and highlight referenced nodes.
   ———————————————————————————————————————————— */

interface AgentAction {
  text: string
  chips?: { stableId: string; label: string }[]
  addRefs?: { kind: string; ref: string }[]
  highlight?: string[]
}

const INTENTS: { match: RegExp; run: (q: string) => AgentAction }[] = [
  {
    match: /moon|lunar|habitat|atmosphere|oxygen.+base/i,
    run: () => ({
      text:
        'For a lunar-base atmosphere (≥ 30 % O₂, ≤ 10.2 psia) the high-oxygen evidence is thin but pointed. CFI-G tested inverse flames up to 85 % O₂ — the only dataset past 40 %. ACME BRE explicitly targeted candidate exploration atmospheres (14.7 / 10.2 / 8.2 psia at 21 / 26.5 / 34 %). Flame Design covers elevated O₂ too. I added those three to the canvas and linked them to the lunar environment.',
      addRefs: [
        { kind: 'investigation', ref: 'PSI-159' },
        { kind: 'investigation', ref: 'PSI-20' },
        { kind: 'investigation', ref: 'PSI-10' },
      ],
      chips: [
        { stableId: 'n_investigation_PSI-159', label: 'CFI-G' },
        { stableId: 'n_investigation_PSI-20', label: 'ACME BRE' },
        { stableId: 'n_investigation_PSI-10', label: 'Flame Design' },
      ],
      highlight: ['n_investigation_PSI-159', 'n_investigation_PSI-20'],
    }),
  },
  {
    match: /suppress|extinguish|co2|helium|suppression|put out|fight/i,
    run: () => ({
      text:
        'Suppression data lives in the droplet studies. FLEX (PSI-69) ran 274 tests across methanol and heptane with CO₂ up to 0.7 and He up to 0.45 mole fraction; 186 tests ended in extinction, 61 in disruption. FLEX-2 and CFI extend this into cool flames. I pulled FLEX onto the canvas — select it to read the outcome distribution.',
      addRefs: [{ kind: 'investigation', ref: 'PSI-69' }],
      chips: [
        { stableId: 'n_investigation_PSI-69', label: 'FLEX' },
        { stableId: 'n_investigation_PSI-68', label: 'FLEX-2' },
      ],
      highlight: ['n_investigation_PSI-69'],
    }),
  },
  {
    match: /smoke|detect|sensor|alarm|aerosol/i,
    run: () => ({
      text:
        'Detection hinges on smoke-particle size in low gravity. SAME and SAME-R measured how microgravity grows larger, slower-moving particles that may not trip 1g-calibrated detectors. DAFT showed the P-Trak distinguishes dust from smoke — directly relevant to lunar-surface false alarms. Added the detection cluster for you.',
      addRefs: [
        { kind: 'investigation', ref: 'PSI-102' },
        { kind: 'investigation', ref: 'PSI-101' },
        { kind: 'investigation', ref: 'PSI-47' },
      ],
      chips: [
        { stableId: 'n_investigation_PSI-102', label: 'SAME' },
        { stableId: 'n_investigation_PSI-101', label: 'SAME-R' },
        { stableId: 'n_investigation_PSI-47', label: 'DAFT' },
      ],
      highlight: ['n_investigation_PSI-102', 'n_investigation_PSI-101'],
    }),
  },
  {
    match: /material|flammab|solid|fabric|polymer|plastic/i,
    run: () => ({
      text:
        'Material flammability is the prevention backbone. BASS and BASS-II mapped ignition and spread limits for PMMA film and fabrics down to 13.6 % O₂. Saffire-I/II/III burned realistic SIBAL fabric and PMMA slabs at ~21.5 % O₂ in a full-size Cygnus module — the closest thing to a real cabin fire. Added BASS-II and Saffire-I.',
      addRefs: [
        { kind: 'investigation', ref: 'PSI-25' },
        { kind: 'investigation', ref: 'PSI-26' },
        { kind: 'investigation', ref: 'PSI-98' },
      ],
      chips: [
        { stableId: 'n_investigation_PSI-25', label: 'BASS-II' },
        { stableId: 'n_investigation_PSI-98', label: 'Saffire-I' },
        { stableId: 'n_investigation_PSI-26', label: 'BASS' },
      ],
      highlight: ['n_investigation_PSI-25', 'n_investigation_PSI-98'],
    }),
  },
  {
    match: /rank|relevant|top|best|which.*investigat|compare/i,
    run: () => ({
      text:
        'Ranked by my relevance model (direct safety need, moon-condition coverage, structured test count, analyzed files, publications), the top investigations are: FLEX, CFI-G, Saffire-I, Flame Design, BASS-II, and SAME-R. The top two (FLEX, CFI-G) are also the ones with the strongest structured outcome data.',
      addRefs: [
        { kind: 'investigation', ref: 'PSI-69' },
        { kind: 'investigation', ref: 'PSI-159' },
        { kind: 'investigation', ref: 'PSI-25' },
      ],
      chips: [
        { stableId: 'n_investigation_PSI-69', label: 'FLEX' },
        { stableId: 'n_investigation_PSI-159', label: 'CFI-G' },
        { stableId: 'n_investigation_PSI-25', label: 'BASS-II' },
      ],
      highlight: ['n_investigation_PSI-69'],
    }),
  },
  {
    match: /hello|hi|hey|help|start|what can/i,
    run: () => ({
      text:
        'I can explore the PSI combustion index with you. Try: "which investigations matter for a Moon base?", "what suppresses methanol?", "rank the suppression studies", or "map smoke detection". I add relevant nodes to the canvas and link them into your session.',
    }),
  },
]

function defaultReply(q: string): AgentAction {
  const inv = catalogForKind('investigation')
  const top = [...inv]
    .sort((a, b) => {
      const ai = entityForNode({ kind: 'investigation', ref: a.ref }) as { relevance?: number } | undefined
      const bi = entityForNode({ kind: 'investigation', ref: b.ref }) as { relevance?: number } | undefined
      return (bi?.relevance ?? 0) - (ai?.relevance ?? 0)
    })
    .slice(0, 3)
  return {
    text:
      `Here is what the index returns for "${q.slice(0, 60)}". The most relevant investigations by my scoring are ` +
      top.map((e) => e.label).join(', ') +
      '. Add any of them to the canvas, or refine your question — try "moon", "suppress", "smoke", "materials", or "rank".',
    chips: top.map((e) => ({ stableId: e.stableId, label: e.label })),
  }
}

export function ChatPanel({ session }: { session: Session }) {
  const addMessage = useAppStore((s) => s.addMessage)
  const setNodes = useAppStore((s) => s.setNodes)
  const addEdge = useAppStore((s) => s.addEdge)
  const setView = useAppStore((s) => s.setView)
  const setSelected = useAppStore((s) => s.setSelectedNode)

  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const setHighlight = useAppStore((s) => s.setHighlight)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [session.messages.length, typing])

  const runAction = (action: AgentAction) => {
    setTyping(true)
    const duration = Math.min(900 + action.text.length * 3, 1800)
    setTimeout(() => {
      // apply canvas mutations
      const addedIds: string[] = []
      const refToId = new Map<string, string>()
      session.nodes.forEach((n) => refToId.set(n.data.ref, n.id))
      for (const ref of action.addRefs ?? []) {
        const entry = catalogForKind(ref.kind as never).find((e) => e.ref === ref.ref)
        if (!entry) continue
        if (session.nodes.some((n) => n.data.ref === entry.ref)) continue
        const id = newId(entry.kind, entry.ref)
        setNodes(session.id, (ns) => [
          ...ns,
          {
            id,
            type: entry.kind,
            position: { x: 300 + Math.random() * 400, y: 100 + Math.random() * 320 },
            data: { kind: entry.kind, ref: entry.ref, label: entry.label, hint: entry.hint },
          },
        ])
        addedIds.push(id)
        refToId.set(entry.ref, id)
        const anchor = session.nodes.find((n) => n.type === 'researchQuestion')
        if (anchor) {
          addEdge(session.id, {
            id: `e_${Date.now().toString(36)}_${id}`,
            source: anchor.id,
            target: id,
            label: 'relates to',
            type: 'RELATES_TO',
          })
        }
      }
      const chips = (action.chips ?? []).map((c) => {
        const entry = entryForStableId(c.stableId)
        return { nodeId: entry?.stableId ?? c.stableId, label: c.label }
      })
      addMessage(session.id, {
        id: `m_${Date.now().toString(36)}`,
        role: 'agent',
        text: action.text,
        at: Date.now(),
        chips: chips.length ? chips : undefined,
        links: [{ view: 'explore', label: 'Open in Explore', ref: undefined }],
      })
      // resolve highlight refs to real node ids (added or pre-existing)
      if (action.highlight?.length) {
        const ids = action.highlight
          .map((ref) => {
            // highlight entries may be stable ids or refs
            if (ref.startsWith('n_')) {
              const entry = entryForStableId(ref)
              return entry ? refToId.get(entry.ref) ?? ref : ref
            }
            return refToId.get(ref) ?? ref
          })
          .filter((id): id is string => Boolean(id))
        setHighlight(ids, 1800)
      }
      if (addedIds.length) setSelected(addedIds[addedIds.length - 1])
      setTyping(false)
    }, duration)
  }

  const submit = () => {
    const q = draft.trim()
    if (!q || typing) return
    setDraft('')
    addMessage(session.id, {
      id: `m_${Date.now().toString(36)}`,
      role: 'user',
      text: q,
      at: Date.now(),
    })
    const intent = INTENTS.find((i) => i.match.test(q))
    runAction(intent ? intent.run(q) : defaultReply(q))
  }

  return (
    <div className="flex w-[300px] shrink-0 flex-col border-r border-edge bg-panel">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-edge px-3">
        <Sparkles className="size-3.5 text-bright" />
        <span className="text-xs font-semibold text-text">Tracer — research copilot</span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div ref={scrollRef} className="flex flex-col gap-3 p-3">
          {session.messages.map((m) => (
            <Message key={m.id} m={m} setSelected={setSelected} setView={setView} session={session} />
          ))}
          {typing && (
            <div className="flex items-center gap-2 text-xs text-faint">
              <span className="flex gap-0.5">
                <TypingDot delay={0} />
                <TypingDot delay={120} />
                <TypingDot delay={240} />
              </span>
              Tracer is thinking…
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="shrink-0 space-y-1.5 border-t border-edge p-3">
        <div className="flex flex-wrap gap-1">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => { setDraft(p); }}
              className="rounded border border-edge bg-panel2 px-1.5 py-0.5 text-[10px] text-faint transition-colors hover:border-edge2 hover:text-text"
            >
              {p}
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
            placeholder="Ask about the data, or add nodes…"
            rows={2}
            className="min-h-8 w-full resize-none bg-transparent text-sm text-text placeholder:text-faint focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={!draft.trim() || typing}
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

const QUICK_PROMPTS = [
  'Moon base materials',
  'Suppression agents',
  'Map smoke detection',
  'Rank the studies',
]

function TypingDot({ delay }: { delay: number }) {
  return (
    <span
      className="size-1.5 animate-bounce rounded-full bg-bright"
      style={{ animationDelay: `${delay}ms` }}
    />
  )
}

function Message({
  m,
  setSelected,
  setView,
  session,
}: {
  m: ChatMessage
  setSelected: (id: string | null) => void
  setView: (v: 'explore' | 'analyze' | 'visualize') => void
  session: Session
}) {
  const isAgent = m.role === 'agent'
  return (
    <div className={isAgent ? 'space-y-2' : ''}>
      <div
        className={[
          'flex items-start gap-2',
          isAgent ? '' : 'flex-row-reverse',
        ].join(' ')}
      >
        {isAgent && (
          <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm bg-bright/15">
            <Bot className="size-3 text-bright" />
          </div>
        )}
        <div
          className={[
            'max-w-[92%] whitespace-pre-wrap text-[13px] leading-relaxed',
            isAgent ? 'text-text' : 'rounded-md border border-edge bg-panel2 px-2.5 py-1.5 text-text',
          ].join(' ')}
        >
          {m.text}
        </div>
      </div>

      {m.chips && m.chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-7">
          {m.chips.map((c) => {
            const onCanvas = session.nodes.some((n) => n.id === c.nodeId)
            return (
              <button
                key={c.nodeId}
                onClick={() => {
                  const node = session.nodes.find((n) => n.id === c.nodeId)
                  if (node) setSelected(node.id)
                }}
                className={[
                  'rounded-md border px-2 py-1 text-xs transition-colors',
                  onCanvas
                    ? 'border-bright/50 bg-bright/10 text-bright hover:bg-bright/20'
                    : 'border-edge bg-panel2 text-dim hover:border-edge2 hover:text-text',
                ].join(' ')}
              >
                {onCanvas ? '◉ ' : '+ '}
                {c.label}
              </button>
            )
          })}
        </div>
      )}

      {m.links && m.links.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-7">
          {m.links.map((l) => (
            <button
              key={l.label}
              onClick={() => setView(l.view)}
              className="text-xs text-teal hover:underline"
            >
              {l.label} →
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
