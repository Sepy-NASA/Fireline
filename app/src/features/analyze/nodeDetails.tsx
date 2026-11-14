import type { ReactNode } from 'react'
import { entityForNode } from './catalog'
import { KIND_META } from './nodeSystem'

/* ————————————————————————————————————————————
   Shared node content bits: tooltip lines and a
   unified "details body" used by both the hover
   tooltip and the right-hand details panel.
   ———————————————————————————————————————————— */

export function nodeFacts(node: { kind: string; ref: string; label: string; hint: string }): string[] {
  const entity = entityForNode(node)
  if (entity && 'nTests' in entity) {
    const facts: (string | null)[] = [
      `${entity.nTests} tests`,
      entity.o2Min != null ? `O₂ ${entity.o2Min}–${entity.o2Max} %` : null,
      entity.pMin != null ? `pressure ${entity.pMin}–${entity.pMax} atm` : null,
      entity.moonRelevant ? 'moon-relevant' : null,
      entity.nAnalyzed > 0 ? `${entity.nAnalyzed} analyzed files` : null,
    ]
    return facts.filter((f): f is string => Boolean(f))
  }
  if (entity && 'rows' in entity) {
    return [`${entity.rows} test rows`, `${entity.columns.length} columns`]
  }
  return [node.hint]
}

export function NodeTooltipContent({ node }: { node: { kind: string; ref: string; label: string; hint: string } }) {
  const facts = nodeFacts(node)
  return (
    <div className="max-w-64 space-y-1">
      <p className="text-xs font-semibold text-text">
        <span className={KIND_META[node.kind as keyof typeof KIND_META]?.text ?? 'text-bright'}>
          {KIND_META[node.kind as keyof typeof KIND_META]?.label ?? node.kind}
        </span>
        {' · '}
        {node.label}
      </p>
      <ul className="space-y-0.5">
        {facts.map((f) => (
          <li key={f} className="flex items-center gap-1.5 font-mono text-[11px] text-dim">
            <span className="size-1 rounded-full bg-bright/60" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function NodeDetailsBody({ node }: { node: { kind: string; ref: string; label: string; hint: string } }) {
  const entity = entityForNode(node)
  const meta = KIND_META[node.kind as keyof typeof KIND_META]
  const details: ReactNode[] = []

  if (entity && 'nTests' in entity) {
    details.push(
      <section key="obj">
        <p className="mb-1 text-xs font-semibold text-dim">Objective</p>
        <p className="text-[13px] leading-relaxed text-text">{entity.objective.slice(0, 420)}{entity.objective.length > 420 ? '…' : ''}</p>
      </section>,
    )
  }
  if (entity && 'approach' in entity && entity.approach) {
    details.push(
      <section key="appr">
        <p className="mb-1 text-xs font-semibold text-dim">Approach</p>
        <p className="text-[13px] leading-relaxed text-text">{entity.approach.slice(0, 320)}{entity.approach.length > 320 ? '…' : ''}</p>
      </section>,
    )
  }
  if (entity && 'rows' in entity) {
    details.push(
      <section key="cols">
        <p className="mb-1 text-xs font-semibold text-dim">Columns</p>
        <div className="flex flex-wrap gap-1">
          {entity.columns.map((c) => (
            <span key={c} className="rounded bg-edge/40 px-1.5 py-0.5 font-mono text-[10px] text-dim">
              {c}
            </span>
          ))}
        </div>
      </section>,
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-semibold text-text">{node.label}</p>
        <p className="mt-0.5 text-xs text-dim">{meta?.desc}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {nodeFacts(node).map((f) => (
          <span key={f} className="rounded bg-bright/10 px-2 py-1 font-mono text-[11px] text-bright">
            {f}
          </span>
        ))}
      </div>
      {details}
    </div>
  )
}
