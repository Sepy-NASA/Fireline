import { GitBranch, Plus } from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { cn } from '../../lib/utils'

/* ————————————————————————————————————————————
   Branch toolbar — floats over the canvas.
   Lists branches, lets the user focus one, and
   creates a branch from the current selection.
   ———————————————————————————————————————————— */

export function BranchBar({ sessionId }: { sessionId: string }) {
  const sessions = useAppStore((s) => s.sessions)
  const session = sessions.find((x) => x.id === sessionId)
  const addBranch = useAppStore((s) => s.addBranch)
  const removeBranch = useAppStore((s) => s.removeBranch)
  const focusedBranchId = useAppStore((s) => s.focusedBranchId)
  const setFocused = useAppStore((s) => s.setFocusedBranchId)
  const selectedIds = useAppStore((s) => s.selectedNodeIds)
  const selectedNodeId = useAppStore((s) => s.selectedNodeId)
  const setSelected = useAppStore((s) => s.setSelectedNode)

  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  if (!session) return null

  const branchCandidates = new Set([
    ...selectedIds,
    ...(selectedNodeId ? [selectedNodeId] : []),
  ])

  const create = () => {
    const ids = [...branchCandidates]
    if (ids.length < 2) return
    addBranch(session.id, { name: name.trim() || '30% O₂ rover material evidence', nodeIds: ids, color: '#ffb454' })
    setName('')
    setNaming(false)
    const created = useAppStore.getState().sessions.find((x) => x.id === session.id)?.branches.at(-1)
    if (created) {
      setSelected(null)
      setFocused(created.id)
    }
  }

  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md border border-edge bg-panel/95 px-1.5 py-1 shadow-pop backdrop-blur">
      <GitBranch className="size-3.5 text-dim" />
      {session.branches.map((b) => (
        <button
          key={b.id}
          onClick={() => {
            setSelected(null)
            setFocused(focusedBranchId === b.id ? null : b.id)
          }}
          onDoubleClick={() => removeBranch(session.id, b.id)}
          title="Click to focus · double-click to delete"
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors',
            focusedBranchId === b.id ? 'bg-bright/15 text-bright' : 'text-dim hover:text-text',
          )}
          style={focusedBranchId !== b.id ? { borderLeft: `2px solid ${b.color}` } : undefined}
        >
          <span className="size-1.5 rounded-full" style={{ background: b.color }} />
          {b.name}
          <span className="font-mono text-[10px] text-faint">{b.nodeIds.length}</span>
        </button>
      ))}

      {!naming ? (
        <Button
          variant="ghost"
          size="sm"
          className="ml-1 text-faint"
          disabled={branchCandidates.size < 2}
          onClick={() => setNaming(true)}
          title={branchCandidates.size < 2 ? 'Select at least two nodes (⌘/Ctrl-click or Shift-drag) to create a branch' : 'Create a branch from the current selection'}
        >
          <Plus /> Branch
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            onBlur={() => setTimeout(() => setNaming(false), 200)}
            placeholder="30% O₂ rover material evidence"
            className="h-6 w-52 px-1.5 text-[11px]"
          />
          <Button size="sm" className="h-6 px-2 text-[11px]" onMouseDown={(e) => e.preventDefault()} onClick={create}>
            Save
          </Button>
        </div>
      )}
    </div>
  )
}
