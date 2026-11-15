import { Handle, Position, type NodeProps } from '@xyflow/react'
import { memo, type ReactNode } from 'react'

/* ————————————————————————————————————————————
   Custom node renderers for the Fireline canvas.
   Circular nodes with kind color + label below;
   the research-question anchor renders as a star.
   CSS hover tooltip (group-hover), robust inside
   React Flow's own event layer.
   ———————————————————————————————————————————— */

/* Handles sit at the shape centre so edges run centre-to-centre (neo4j style). */
const CENTER_CIRCLE = { top: 40, left: '50%', transform: 'translate(-50%, -50%)' }
const CENTER_STAR = { top: 38, left: '50%', transform: 'translate(-50%, -50%)' }

function HoverTooltip({ data, children }: { data: NodeProps['data']; children: ReactNode }) {
  const hint = data?.hint as string | undefined
  if (!hint) return <>{children}</>
  return (
    <div className="group/tip relative">
      {children}
      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-56 -translate-x-1/2 rounded-md border border-edge bg-panel px-2.5 py-1.5 text-[11px] leading-snug text-dim opacity-0 shadow-pop transition-opacity duration-150 group-hover/tip:opacity-100">
        {hint}
      </div>
    </div>
  )
}

const PROV_SHORT: Record<string, { text: string; cls: string }> = {
  measured: { text: 'MEASURED · PSI', cls: 'text-teal border-teal/40' },
  engineer: { text: 'ENGINEER INPUT', cls: 'text-bright border-bright/40' },
  provisional: { text: 'PROVISIONAL', cls: 'text-amber border-amber/40' },
  unknown: { text: 'UNKNOWN', cls: 'text-dim border-dashed border-faint' },
  agent: { text: 'AGENT · OPEN ISSUE', cls: 'text-flame border-flame/40' },
  context: { text: 'CONTEXT ONLY', cls: 'text-[#c4b5fd] border-[#a78bfa]/40' },
}

function CircleNode(props: NodeProps) {
  const { data } = props
  const selected = props.selected || Boolean(data.multi)
  const color = (data.color as string) ?? '#4da3ff'
  const kind = data.kind as string
  const isNote = kind === 'note'
  const highlighted = Boolean(data.highlighted)
  const dimmed = Boolean(data.dimmed)
  const inBranch = Boolean(data.inBranch)
  const provenance = data.provenance as string | undefined
  const badge = data.badge as string | undefined
  const unknown = provenance === 'unknown'
  const provisional = provenance === 'provisional'
  const prov = provenance ? PROV_SHORT[provenance] : undefined
  return (
    <HoverTooltip data={data}>
      <div className={['group relative flex w-28 flex-col items-center transition-opacity', dimmed ? 'opacity-25' : ''].join(' ')}>
        <Handle type="target" position={Position.Top} className="!opacity-0" style={CENTER_CIRCLE} />
        <div
          className={[
            'flex size-20 items-center justify-center rounded-full border-2 transition-all',
            unknown || provisional ? 'border-dashed' : '',
            selected ? 'scale-105' : '',
            highlighted ? 'animate-pulse' : '',
          ].join(' ')}
          style={{
            borderColor: highlighted ? '#4da3ff' : unknown ? '#5b6472' : color,
            background: isNote || unknown ? '#0a0d12' : `color-mix(in oklch, ${color} 14%, #0e1218)`,
            boxShadow: highlighted
              ? `0 0 18px 4px rgba(77,163,255,0.55)`
              : selected
                ? `0 0 0 3px color-mix(in oklch, ${color} 35%, transparent)`
                : inBranch
                  ? `0 0 0 2px rgba(255,180,84,0.35)`
                  : undefined,
          }}
        >
          <span className={['px-2 text-center text-[10.5px] font-semibold leading-tight', unknown ? 'text-dim' : 'text-text'].join(' ')}>
            {String(data.label).slice(0, 48)}
          </span>
        </div>
        {(prov || badge) && (
          <div className="mt-1 flex flex-col items-center gap-0.5">
            {prov && (
              <span className={['rounded-sm border px-1 font-mono text-[7.5px] leading-[12px] tracking-wide', prov.cls].join(' ')}>
                {prov.text}
              </span>
            )}
            {badge && <span className="max-w-28 text-center text-[9px] leading-tight text-dim">{badge}</span>}
          </div>
        )}
        <Handle type="source" position={Position.Bottom} className="!opacity-0" style={CENTER_CIRCLE} />
      </div>
    </HoverTooltip>
  )
}

function NoteNode(props: NodeProps) {
  const { data, selected } = props
  return (
    <HoverTooltip data={data}>
      <div className="relative">
        <Handle type="target" position={Position.Top} className="!opacity-0" />
        <div
          className={[
            'max-w-[180px] rounded-md border border-dashed border-text/50 bg-panel px-2.5 py-1.5 text-xs text-text shadow-pop',
            selected ? 'outline-2 outline-bright' : '',
          ].join(' ')}
        >
          {String(data.label)}
        </div>
        <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      </div>
    </HoverTooltip>
  )
}

/** Star learning: the session anchor. */
function StarNode(props: NodeProps) {
  const { data, selected, id } = props
  const points = starPoints(6, 34, 17)
  const gradId = `star-grad-${id}`
  return (
    <HoverTooltip data={data}>
      <div className={['relative flex w-[180px] flex-col items-center transition-opacity', data.dimmed ? 'opacity-25' : ''].join(' ')}>
        <Handle type="source" position={Position.Bottom} className="!opacity-0" style={CENTER_STAR} />
        <svg width="76" height="76" viewBox="0 0 76 76">
          <path
            d={points}
            fill={`url(#${gradId})`}
            stroke={selected ? '#4da3ff' : '#0b3d91'}
            strokeWidth={selected ? 3 : 2}
            className="drop-shadow-[0_0_10px_rgba(77,163,255,0.35)]"
          />
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1a5cb8" />
              <stop offset="100%" stopColor="#0b3d91" />
            </linearGradient>
          </defs>
        </svg>
        <div className="mt-1 text-center text-[11px] font-semibold leading-tight text-[#9cc3ff]">{String(data.label)}</div>
        <span className="mt-0.5 rounded-sm border border-[#0b3d91] px-1 font-mono text-[7.5px] leading-[12px] tracking-wide text-[#9cc3ff]">
          RESEARCH QUESTION
        </span>
        <Handle type="target" position={Position.Top} className="!opacity-0" style={CENTER_STAR} />
      </div>
    </HoverTooltip>
  )
}

function starPoints(n: number, outer: number, inner: number): string {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI / n) * i - Math.PI / 2
    pts.push(`${38 + r * Math.cos(a)},${38 + r * Math.sin(a)}`)
  }
  return `M ${pts.join(' L ')} Z`
}

/** Background lane grouping nodes of one evidence type. */
function LaneNode(props: NodeProps) {
  const { data } = props
  const color = data.color as string
  return (
    <div
      className={['rounded-xl border border-dashed transition-opacity', data.dimmed ? 'opacity-30' : ''].join(' ')}
      style={{
        width: data.width as number,
        height: data.height as number,
        borderColor: `color-mix(in oklch, ${color} 45%, transparent)`,
        background: `color-mix(in oklch, ${color} 6%, transparent)`,
      }}
    >
      <div className="flex flex-col px-3 pt-2 leading-tight">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>
          {String(data.title)}
        </span>
        <span className="mt-0.5 text-[10px] text-faint">{String(data.subtitle)}</span>
      </div>
    </div>
  )
}

/* Node type → renderer registry (React Flow type name = node kind). */
export const nodeTypes = {
  researchQuestion: memo(StarNode),
  investigation: memo(CircleNode),
  safetyArea: memo(CircleNode),
  material: memo(CircleNode),
  hardware: memo(CircleNode),
  platform: memo(CircleNode),
  environment: memo(CircleNode),
  incident: memo(CircleNode),
  dataset: memo(CircleNode),
  publication: memo(CircleNode),
  note: memo(NoteNode),
  externalSource: memo(CircleNode),
  lane: memo(LaneNode),
  missionParam: memo(CircleNode),
  gap: memo(CircleNode),
}
