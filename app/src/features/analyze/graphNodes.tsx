import { Handle, Position, type NodeProps } from '@xyflow/react'
import { memo, type ReactNode } from 'react'

/* ————————————————————————————————————————————
   Custom node renderers for the Fireline canvas.
   Circular nodes with kind color + label below;
   the research-question anchor renders as a star.
   CSS hover tooltip (group-hover), robust inside
   React Flow's own event layer.
   ———————————————————————————————————————————— */

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

function CircleNode(props: NodeProps) {
  const { data, selected } = props
  const color = (data.color as string) ?? '#4da3ff'
  const kind = data.kind as string
  const isNote = kind === 'note'
  const highlighted = Boolean(data.highlighted)
  const dimmed = Boolean(data.dimmed)
  return (
    <HoverTooltip data={data}>
      <div className={['group relative flex flex-col items-center transition-opacity', dimmed ? 'opacity-30' : ''].join(' ')}>
        <Handle type="target" position={Position.Top} className="!opacity-0" />
        <div
          className={[
            'flex size-20 items-center justify-center rounded-full border-2 transition-all',
            selected ? 'scale-105' : '',
            highlighted ? 'animate-pulse' : '',
          ].join(' ')}
          style={{
            borderColor: highlighted ? '#4da3ff' : color,
            background: isNote ? '#0a0d12' : `color-mix(in oklch, ${color} 14%, #0e1218)`,
            boxShadow: highlighted
              ? `0 0 18px 4px rgba(77,163,255,0.55)`
              : selected
                ? `0 0 0 3px color-mix(in oklch, ${color} 35%, transparent)`
                : undefined,
          }}
        >
          <span className="px-2 text-center text-[11px] font-semibold leading-tight text-text">
            {String(data.label).slice(0, 34)}
          </span>
        </div>
        <Handle type="source" position={Position.Bottom} className="!opacity-0" />
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
      <div className="relative">
        <Handle type="source" position={Position.Bottom} className="!opacity-0" />
        <div className="relative">
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
        </div>
        <div className="mt-1 max-w-[140px] text-center text-[10px] leading-tight text-[#9cc3ff]">
          {String(data.label)}
        </div>
        <Handle type="target" position={Position.Top} className="!opacity-0" />
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
}
