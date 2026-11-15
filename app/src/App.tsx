import { Flame } from 'lucide-react'
import { lazy, Suspense, useEffect } from 'react'
import { TooltipProvider } from './components/ui/tooltip'
import { AnalyzeView } from './features/analyze/AnalyzeView'
import { ExploreView } from './features/explore/ExploreView'
import { VisualizeView } from './features/visualize/VisualizeView'
import { WorkingSetTray } from './components/layout/WorkingSetTray'
import { useAppStore } from './store/appStore'
import type { View } from './types'
import { cn } from './lib/utils'

// lazy-load the WebGL/three.js view so it does not bloat the initial bundle
const FlameVrView = lazy(() =>
  import('./features/vr/FlameVrView').then((m) => ({ default: m.FlameVrView })),
)

const BOOKMARKS: { view: View; label: string }[] = [
  { view: 'analyze', label: 'Analyze' },
  { view: 'explore', label: 'Explore' },
  { view: 'visualize', label: 'Visualize' },
  { view: 'vr', label: 'Flame VR' },
]

export default function App() {
  const rawView = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const workingItems = useAppStore((s) => s.workingItems)
  const setTrayOpen = useAppStore((s) => s.setTrayOpen)

  // guard against stale persisted values from removed views
  const view: View =
    rawView === 'analyze' || rawView === 'explore' || rawView === 'visualize' || rawView === 'vr'
      ? rawView
      : 'analyze'

  useEffect(() => {
    document.title = 'Fireline — microgravity combustion workspace'
  }, [])

  // deep-link: open a view directly via the location hash (e.g. #vr)
  useEffect(() => {
    const h = location.hash.replace(/^#\/?/, '')
    if (h === 'analyze' || h === 'explore' || h === 'visualize' || h === 'vr') setView(h)
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col bg-ink text-text">
        {/* top navigation — left-aligned bookmarks */}
        <header className="flex h-11 shrink-0 items-stretch border-b border-edge px-3">
          <div className="flex items-center gap-2 pr-5">
            <div className="flex size-6 items-center justify-center rounded-sm bg-blue">
              <Flame className="size-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">Fireline</span>
            <span className="ml-1 hidden text-xs text-faint lg:inline">
              microgravity combustion workspace
            </span>
          </div>

          <nav role="tablist" aria-label="Workspace views" className="flex items-end gap-1">
            {BOOKMARKS.map((b) => (
              <button
                key={b.view}
                role="tab"
                aria-selected={view === b.view}
                onClick={() => setView(b.view)}
                className={cn(
                  'relative h-11 px-4 text-sm transition-colors',
                  view === b.view
                    ? 'text-text'
                    : 'text-dim hover:text-text',
                )}
              >
                {b.label}
                {view === b.view && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-bright" aria-hidden />
                )}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setTrayOpen(true)}
              className="flex h-7 items-center gap-1.5 rounded-md border border-edge px-2.5 text-xs text-dim transition-colors hover:border-edge2 hover:text-text"
            >
              Working set
              <span className="tnum rounded bg-bright/15 px-1 font-mono text-[11px] leading-4 text-bright">
                {workingItems.length}
              </span>
            </button>
          </div>
        </header>

        {/* view content */}
        <main className="min-h-0 flex-1">
          {view === 'analyze' && <AnalyzeView />}
          {view === 'explore' && <ExploreView />}
          {view === 'visualize' && <VisualizeView />}
          {view === 'vr' && (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-faint">
                  Loading 3D renderer…
                </div>
              }
            >
              <FlameVrView />
            </Suspense>
          )}
        </main>

        <WorkingSetTray />
      </div>
    </TooltipProvider>
  )
}
