import type { Overview, SimulatorWidgetKind } from '../types.ts'
import { BitLayoutExplorer } from './BitLayoutExplorer.tsx'
import type { ExplorerProps } from './ExplorerPanel.tsx'
import { GpuCoalescingExplorer } from './GpuCoalescingExplorer.tsx'
import { MemoryWaterfallExplorer } from './MemoryWaterfallExplorer.tsx'
import { PipelineScheduleExplorer } from './PipelineScheduleExplorer.tsx'
import { CapacityPlannerExplorer } from './CapacityPlannerExplorer.tsx'
import { ServingSchedulerExplorer } from './ServingSchedulerExplorer.tsx'
import { RooflineExplorer } from './RooflineExplorer.tsx'

export function LessonExplorer({ widget, measuredPoints, ...props }: ExplorerProps &
  { widget: SimulatorWidgetKind; measuredPoints: Overview['measuredRooflinePoints'] }) {
  switch (widget) {
    case 'roofline': return <RooflineExplorer {...props} measuredPoints={measuredPoints} />
    case 'memory-waterfall': return <MemoryWaterfallExplorer {...props} />
    case 'pipeline-schedule': return <PipelineScheduleExplorer {...props} />
    case 'capacity-planner': return <CapacityPlannerExplorer {...props} />
    case 'serving-scheduler': return <ServingSchedulerExplorer {...props} />
    case 'bit-layout': return <BitLayoutExplorer {...props} />
    case 'gpu-coalescing': return <GpuCoalescingExplorer {...props} />
  }
}
