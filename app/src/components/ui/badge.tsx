import * as React from 'react'
import { cn } from '../../lib/utils'

export type BadgeVariant =
  | 'default'
  | 'muted'
  | 'blue'
  | 'amber'
  | 'teal'
  | 'flame'
  | 'violet'
  | 'lime'

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-bright/15 text-bright',
  muted: 'bg-edge/40 text-dim',
  blue: 'bg-blue/30 text-[#9cc3ff]',
  amber: 'bg-amber/15 text-amber',
  teal: 'bg-teal/15 text-teal',
  flame: 'bg-flame/15 text-flame',
  violet: 'bg-violet/15 text-violet',
  lime: 'bg-lime/15 text-lime',
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium leading-none',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  )
}
