import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useNodesInitialized,
  ReactFlowProvider,
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
import { LANES, isRoverSession } from './roverScenario'
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
  missionParam: '#4da3ff',
  gap: '#ff6b6b',
  conclusion: '#7a8bff',
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
      color: n.data.color ?? NODE_COLORS[n.type] ?? '#4da3ff',
      inBranch: branchNodeIds.has(n.id),
      highlighted: highlightIds.includes(n.id),
    },
  }))
}

/** In the rover demo only the meaningful relations keep a visible label; structure is shown by lanes. */
const KEY_LABEL = /material tested|different fuel|uncovered|only|follow-up/

export function toFlowEdges(sessionEdges: GraphEdge[], compact = false): Edge[] {
  return sessionEdges.map((e) => {
    const full = e.label || EDGE_LABELS[e.type] || ''
    const label = compact && !KEY_LABEL.test(full) ? '' : full
    const context = /different fuel|follow-up/.test(label)
    const material = /material tested/.test(label)
    const gap = /uncovered|only/.test(label)
    const stroke = gap ? '#ff6b6b' : context ? '#a78bfa' : material ? '#ffb454' : '#3a4556'
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label,
      type: 'straight',
      style: { stroke, strokeDasharray: context || gap ? '5 4' : undefined, strokeWidth: material ? 1.6 : 1 },
      labelStyle: { fill: material ? '#ffcf8f' : context ? '#c4b5fd' : '#8b95a5', fontSize: 9 },
      labelBgStyle: { fill: '#0e1218', fillOpacity: 0.9 },
    }
  })
}

const isRover = (session: { id: string }) => isRoverSession(session)

/** Background lane nodes, sized to the members currently on the canvas. */
function laneNodes(session: { id: string; nodes: GraphNode[] }, dimmed: boolean): Node[] {
  if (!isRover(session)) return []
  const W = 112
  const H = 128
  const PAD = 20
  const HEAD = 44
  const out: Node[] = []
  for (const lane of LANES) {
    const members = session.nodes.filter((n) => lane.members.includes(n.id))
    if (members.length === 0) continue
    const minX = Math.min(...members.map((n) => n.position.x)) - PAD
    const minY = Math.min(...members.map((n) => n.position.y)) - PAD - HEAD
    const maxX = Math.max(...members.map((n) => n.position.x + W)) + PAD
    const maxY = Math.max(...members.map((n) => n.position.y + H)) + PAD
    out.push({
      id: lane.id,
      type: 'lane',
      position: { x: minX, y: minY },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1,
      style: { pointerEvents: 'none' },
      data: { title: lane.title, subtitle: lane.subtitle, color: lane.color, width: maxX - minX, height: maxY - minY, dimmed },
    })
  }
  return out
}

const px = (n: number) => `${n}px` as `${number}px`
const fitPadding = (rightInset: number) => ({ top: px(70), bottom: px(40), left: px(40), right: px(rightInset + 40) })

export function GraphCanvas({ rightInset = 0 }: { rightInset?: number }) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner rightInset={rightInset} />
    </ReactFlowProvider>
  )
}

function GraphCanvasInner({ rightInset }: { rightInset: number }) {
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
  const nodeCount = useRef(0)
  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const pendingFit = useRef(false)

  // Signature of everything that should re-render the canvas (not positions)
  const sig = session
    ? [
        session.id,
        session.nodes.map((n) => `${n.id}|${Math.round(n.position.x)},${Math.round(n.position.y)}|${n.data.label}|${n.data.provenance ?? ''}|${n.data.badge ?? ''}|${n.data.value ?? ''}|${n.data.match ?? ''}`).join(';'),
        session.edges.map((e) => `${e.id}|${e.label}`).join(';'),
        session.branches.map((b) => `${b.id}:${b.nodeIds.join(',')}`).join(';'),
        highlightIds.join(','),
        focusedBranchId ?? '',
      ].join('#')
    : ''

  // Sync store → flow when session state changes
  useEffect(() => {
    if (!session) {
      setNodesUi([])
      setEdgesUi([])
      return
    }
    if (lastSync.current === sig) return
    const prevSession = lastSync.current.split('#')[0]
    lastSync.current = sig
    const branchIds = new Set(session.branches.flatMap((b) => b.nodeIds))
    const focused = focusedBranchId ? session.branches.find((b) => b.id === focusedBranchId) : undefined
    const dimOthers = Boolean(focused)
    const branchMembers = focused ? new Set(focused.nodeIds) : branchIds
    setNodesUi((prev) => {
      const prevSelected = new Set(prevSession === session.id ? prev.filter((p) => p.selected).map((p) => p.id) : [])
      return [...laneNodes(session, dimOthers), ...toFlowNodes(session.nodes, branchMembers, highlightIds).map((n) => ({
        ...n,
        selected: prevSelected.has(n.id),
        data: {
          ...n.data,
          dimmed: dimOthers && !branchMembers.has(n.id),
        },
      }))]
    })
    setEdgesUi(
      toFlowEdges(session.edges, isRover(session)).map((e) =>
        dimOthers && !(branchMembers.has(e.source) && branchMembers.has(e.target))
          ? { ...e, style: { ...e.style, opacity: 0.12 }, labelStyle: { ...e.labelStyle, opacity: 0.15 }, labelBgStyle: { fillOpacity: 0 } }
          : e,
      ),
    )
    if (prevSession !== session.id || session.nodes.length !== nodeCount.current) {
      nodeCount.current = session.nodes.length
      pendingFit.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  // Fit once React Flow has measured the (new) nodes
  useEffect(() => {
    if (!pendingFit.current || !nodesInitialized || nodes.length === 0) return
    pendingFit.current = false
    // fit twice: new nodes can report "initialized" a frame before their final size
    const fit = () => fitView({ padding: fitPadding(rightInset), duration: 400, maxZoom: 1.05 })
    setTimeout(fit, 120)
    setTimeout(fit, 600)
  }, [nodesInitialized, nodes, fitView, rightInset])

  // Re-fit when the context card opens / closes
  const lastInset = useRef(rightInset)
  useEffect(() => {
    if (lastInset.current === rightInset) return
    lastInset.current = rightInset
    fitView({ padding: fitPadding(rightInset), duration: 400, maxZoom: 1.05 })
  }, [rightInset, fitView])

  const onNodeClick: NodeMouseHandler = (event, node) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      // multi-select (for branches): toggle this node in the selection
      const st = useAppStore.getState()
      const cur = new Set(st.selectedNodeIds.length ? st.selectedNodeIds : st.selectedNodeId ? [st.selectedNodeId] : [])
      if (cur.has(node.id)) cur.delete(node.id)
      else cur.add(node.id)
      useAppStore.setState({ selectedNodeIds: [...cur], selectedNodeId: node.id })
      return
    }
    setSelected(node.id)
  }

  // Mirror the store's multi-selection onto the canvas (ring on every selected node)
  const selectedNodeIds = useAppStore((s) => s.selectedNodeIds)
  useEffect(() => {
    const ids = new Set(selectedNodeIds)
    if (!nodes.some((n) => Boolean(n.data.multi) !== ids.has(n.id))) return
    setNodesUi((ns) => ns.map((n) => (Boolean(n.data.multi) === ids.has(n.id) ? n : { ...n, data: { ...n.data, multi: ids.has(n.id) } })))
  }, [selectedNodeIds, nodes, setNodesUi])

  const onNodeDragStop: OnNodeDrag = (_, node) => {
    if (!session) return
    setNodes(session.id, (ns) =>
      ns.map((n) => (n.id === node.id ? { ...n, position: node.position } : n)),
    )
  }

  // Box selection (Shift + drag) feeds the same multi-selection
  const onSelectionChange: OnSelectionChangeFunc = (params) => {
    if (params.nodes.length > 1) setSelectedNodeIds(params.nodes.map((n) => n.id))
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
        multiSelectionKeyCode={null}
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'straight' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.2} color="#10161f" />
        <Controls
          showInteractive={false}
          className="!rounded-md !border !border-edge !bg-panel !shadow-none"
          position="bottom-left"
        />
        <MiniMap
          className="!rounded-md !border !border-edge !bg-panel2"
          nodeColor={(n) => (n.type === 'lane' ? 'transparent' : ((n.data?.color as string) ?? '#4da3ff'))}
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
