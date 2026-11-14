import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  GraphEdge,
  GraphNode,
  Session,
  View,
  WorkingGroup,
  WorkingItem,
} from '../types'

/* ————————————————————————————————————————————
   Global app state. Persisted to localStorage.
   The canvas + sessions live here so Explore,
   Overview, and Visualize can read the same data.
   ———————————————————————————————————————————— */

interface AppState {
  view: View
  setView: (v: View) => void

  /* sessions */
  sessions: Session[]
  activeSessionId: string | null
  createSession: (name: string, researchStatement: string) => void
  renameSession: (id: string, name: string) => void
  deleteSession: (id: string) => void
  setActiveSession: (id: string) => void
  updateResearchStatement: (id: string, text: string) => void
  addMessage: (sessionId: string, msg: Session['messages'][number]) => void
  setNodes: (sessionId: string, updater: (n: GraphNode[]) => GraphNode[]) => void
  addNode: (sessionId: string, node: GraphNode) => void
  updateNode: (sessionId: string, nodeId: string, patch: Partial<GraphNode>) => void
  removeNode: (sessionId: string, nodeId: string) => void
  setEdges: (sessionId: string, updater: (e: GraphEdge[]) => GraphEdge[]) => void
  addEdge: (sessionId: string, edge: GraphEdge) => void
  removeEdge: (sessionId: string, edgeId: string) => void
  addBranch: (sessionId: string, branch: { name: string; nodeIds: string[]; color: string }) => void
  removeBranch: (sessionId: string, branchId: string) => void

  /* canvas selection */
  selectedNodeId: string | null
  setSelectedNode: (id: string | null) => void
  selectedNodeIds: string[]
  setSelectedNodeIds: (ids: string[]) => void
  focusedBranchId: string | null
  setFocusedBranchId: (id: string | null) => void

  /* transient highlight (agent references) */
  highlightIds: string[]
  setHighlight: (ids: string[], ms?: number) => void

  /* working set (cross-view selection) */
  workingItems: WorkingItem[]
  workingGroups: WorkingGroup[]
  addWorkingItems: (items: WorkingItem[]) => void
  removeWorkingItem: (id: string) => void
  clearWorkingItems: () => void
  addWorkingGroup: (name: string, itemIds?: string[]) => void
  renameWorkingGroup: (id: string, name: string) => void
  removeWorkingGroup: (id: string) => void

  /* ui */
  trayOpen: boolean
  setTrayOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      view: 'analyze',
      setView: (v) => set({ view: v }),

      sessions: [],
      activeSessionId: null,
      createSession: (name, researchStatement) => {
        const id = `ses_${Date.now().toString(36)}`
        const session: Session = {
          id,
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          researchStatement,
          nodes: [],
          edges: [],
          branches: [],
          messages: [],
        }
        set((s) => ({
          sessions: [session, ...s.sessions],
          activeSessionId: id,
        }))
      },
      renameSession: (id, name) =>
        set((s) => ({
          sessions: s.sessions.map((x) => (x.id === id ? { ...x, name, updatedAt: Date.now() } : x)),
        })),
      deleteSession: (id) =>
        set((s) => ({
          sessions: s.sessions.filter((x) => x.id !== id),
          activeSessionId: s.activeSessionId === id ? (s.sessions[0]?.id ?? null) : s.activeSessionId,
        })),
      setActiveSession: (id) => set({ activeSessionId: id }),
      updateResearchStatement: (id, text) =>
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === id ? { ...x, researchStatement: text, updatedAt: Date.now() } : x,
          ),
        })),
      addMessage: (sessionId, msg) =>
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === sessionId
              ? { ...x, messages: [...x.messages, msg], updatedAt: Date.now() }
              : x,
          ),
        })),

      setNodes: (sessionId, updater) =>
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === sessionId
              ? { ...x, nodes: updater(x.nodes), updatedAt: Date.now() }
              : x,
          ),
        })),
      addNode: (sessionId, node) =>
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === sessionId
              ? { ...x, nodes: [...x.nodes, node], updatedAt: Date.now() }
              : x,
          ),
        })),
      updateNode: (sessionId, nodeId, patch) =>
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === sessionId
              ? {
                  ...x,
                  nodes: x.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
                  updatedAt: Date.now(),
                }
              : x,
          ),
        })),
      removeNode: (sessionId, nodeId) =>
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === sessionId
              ? {
                  ...x,
                  nodes: x.nodes.filter((n) => n.id !== nodeId),
                  edges: x.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
                  updatedAt: Date.now(),
                }
              : x,
          ),
        })),

      setEdges: (sessionId, updater) =>
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === sessionId ? { ...x, edges: updater(x.edges), updatedAt: Date.now() } : x,
          ),
        })),
      addEdge: (sessionId, edge) =>
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === sessionId ? { ...x, edges: [...x.edges, edge], updatedAt: Date.now() } : x,
          ),
        })),
      removeEdge: (sessionId, edgeId) =>
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === sessionId
              ? { ...x, edges: x.edges.filter((e) => e.id !== edgeId), updatedAt: Date.now() }
              : x,
          ),
        })),

      addBranch: (sessionId, branch) =>
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === sessionId
              ? {
                  ...x,
                  branches: [...x.branches, { id: `br_${Date.now().toString(36)}`, ...branch }],
                  updatedAt: Date.now(),
                }
              : x,
          ),
        })),
      removeBranch: (sessionId, branchId) =>
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === sessionId ? { ...x, branches: x.branches.filter((b) => b.id !== branchId), updatedAt: Date.now() } : x,
          ),
        })),

      selectedNodeId: null,
      setSelectedNode: (id) => set({ selectedNodeId: id, selectedNodeIds: id ? [id] : [] }),
      selectedNodeIds: [],
      setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
      focusedBranchId: null,
      setFocusedBranchId: (id) => set({ focusedBranchId: id }),

      highlightIds: [],
      setHighlight: (ids, ms = 1600) => {
        set({ highlightIds: ids })
        if (ms > 0) {
          setTimeout(() => set((s) => ({ highlightIds: s.highlightIds.filter((x) => !ids.includes(x)) })), ms)
        }
      },

      workingItems: [],
      workingGroups: [],
      addWorkingItems: (items) =>
        set((s) => {
          const existing = new Set(s.workingItems.map((i) => i.id))
          const fresh = items.filter((i) => !existing.has(i.id))
          return { workingItems: [...s.workingItems, ...fresh] }
        }),
      removeWorkingItem: (id) =>
        set((s) => ({
          workingItems: s.workingItems.filter((i) => i.id !== id),
          workingGroups: s.workingGroups.map((g) => ({
            ...g,
            itemIds: g.itemIds.filter((x) => x !== id),
          })),
        })),
      clearWorkingItems: () => set({ workingItems: [], workingGroups: [] }),
      addWorkingGroup: (name, itemIds) =>
        set((s) => ({
          workingGroups: [
            ...s.workingGroups,
            { id: `wg_${Date.now().toString(36)}`, name, itemIds: itemIds ?? [] },
          ],
        })),
      renameWorkingGroup: (id, name) =>
        set((s) => ({
          workingGroups: s.workingGroups.map((g) => (g.id === id ? { ...g, name } : g)),
        })),
      removeWorkingGroup: (id) =>
        set((s) => ({ workingGroups: s.workingGroups.filter((g) => g.id !== id) })),

      trayOpen: false,
      setTrayOpen: (open) => set({ trayOpen: open }),
    }),
    {
      name: 'fireline',
      partialize: (s) => ({
        sessions: s.sessions,
        activeSessionId: s.activeSessionId,
        workingItems: s.workingItems,
        workingGroups: s.workingGroups,
        view: s.view,
      }),
    },
  ),
)

export const activeSession = (s: AppState): Session | null =>
  s.sessions.find((x) => x.id === s.activeSessionId) ?? null
