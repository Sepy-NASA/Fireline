import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnNodeDrag,
  type OnSelectionChangeFunc,
} from '@xyflow/react'
import { useEffect, useMemo, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import { EDGE_LABELS } from './nodeSystem'
import { nodeTypes } from './graphNodes'
import { BranchBar } from './BranchBar'
import type { GraphEdge, GraphNode } from '../../types'

/* ————————————————————————————————————————————
   Graph canvas (neo4j-like). Bridges session
   state (store) ↔ React Flow internal state.
   ———————————————————————————————————————————— */

const NODE_COLORS: Record<string, string> = {
  researchQuestion: '#0b3d91',
  investigation: '#4da3ff',
  safetyArea: '#7a8bff',
  material: '#ffb454',
  hardware: '#7a8bff',
  platform: '#9ad84a',
  environment: '#3ad7a3',
  incident: '#ff6b6b',
  dataset: '#3ad7a3',
  publication: '#8b95a5',
  note: '#e9eef5',
  externalSource: '#9ad84a',
}

export function toFlowNodes(
  sessionNodes: GraphNode[],
  branchNodeIds: Set<string>,
  highlightIds: string[],
): Node[] {
  return sessionNodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    selected: false,
    data: {
      ...n.data,
      color: NODE_COLORS[n.type] ?? '#4da3ff',
      inBranch: branchNodeIds.has(n.id),
      highlighted: highlightIds.includes(n.id),
    },
  }))
}

export function toFlowEdges(sessionEdges: GraphEdge[]): Edge[] {
  return sessionEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: EDGE_LABELS[e.type] ?? (e.label || ''),
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3a4556' },
    style: { stroke: '#3a4556' },
    labelStyle: { fill: '#8b95a5', fontSize: 9 },
    labelBgStyle: { fill: '#0e1218', fillOpacity: 0.85 },
  }))
}

export function GraphCanvas() {
  const sessions = useAppStore((s) => s.sessions)
  const activeId = useAppStore((s) => s.activeSessionId)
  const session = sessions.find((x) => x.id === activeId)

  const setNodes = useAppStore((s) => s.setNodes)
  const setSelected = useAppStore((s) => s.setSelectedNode)
  const highlightIds = useAppStore((s) => s.highlightIds)
  const setSelectedNodeIds = useAppStore((s) => s.setSelectedNodeIds)
  const focusedBranchId = useAppStore((s) => s.focusedBranchId)

  const [nodes, setNodesUi, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdgesUi, onEdgesChange] = useEdgesState<Edge>([])
  const lastSync = useRef<string>('')

  // Sync store → flow when session state changes
  useEffect(() => {
    if (!session) {
      setNodesUi([])
      setEdgesUi([])
      return
    }
    const sig = `${session.id}:${session.nodes.length}:${session.edges.length}:${highlightIds.join(',')}:${focusedBranchId ?? ''}`
    if (lastSync.current === sig) return
    lastSync.current = sig
    const branchIds = new Set(session.branches.flatMap((b) => b.nodeIds))
    const focused = focusedBranchId ? session.branches.find((b) => b.id === focusedBranchId) : undefined
    const dimOthers = Boolean(focused)
    const branchMembers = focused ? new Set(focused.nodeIds) : branchIds
    setNodesUi(
      toFlowNodes(session.nodes, branchMembers, highlightIds).map((n) => ({
        ...n,
        data: {
          ...n.data,
          dimmed: dimOthers && !branchMembers.has(n.id),
        },
      })),
    )
    setEdgesUi(toFlowEdges(session.edges))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.nodes.length, session?.edges.length, highlightIds, focusedBranchId])

  const onNodeClick: NodeMouseHandler = (_, node) => {
    setSelected(node.id)
  }

  const onNodeDragStop: OnNodeDrag = (_, node) => {
    if (!session) return
    setNodes(session.id, (ns) =>
      ns.map((n) => (n.id === node.id ? { ...n, position: node.position } : n)),
    )
  }

  const onSelectionChange: OnSelectionChangeFunc = (params) => {
    setSelectedNodeIds(params.nodes.map((n) => n.id))
  }

  const flowNodes = useMemo(() => nodes, [nodes])
  const flowEdges = useMemo(() => edges, [edges])

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-faint">
        No active session — create one first.
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={() => {
          setSelected(null)
          setSelectedNodeIds([])
        }}
        onSelectionChange={onSelectionChange}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1.1 }}
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.2} color="#10161f" />
        <Controls
          showInteractive={false}
          className="!rounded-md !border !border-edge !bg-panel !shadow-none"
          position="bottom-left"
        />
        <MiniMap
          className="!rounded-md !border !border-edge !bg-panel2"
          nodeColor={(n) => (n.data?.color as string) ?? '#4da3ff'}
          maskColor="rgba(5,7,11,0.75)"
          bgColor="#0a0d12"
          pannable
          zoomable
          position="bottom-right"
        />
      </ReactFlow>
      <BranchBar sessionId={session.id} />
    </div>
  )
}
