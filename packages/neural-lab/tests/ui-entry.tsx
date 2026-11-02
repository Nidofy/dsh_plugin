import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Workbench } from '../src/workbench.tsx'
import { createApi } from '../src/client-api.ts'
import { ChartFixture, ReadOnlyEditorFixture } from './ui-chart-fixture.tsx'
const root = createRoot(document.getElementById('root')!)
if (new URLSearchParams(location.search).get('component') === 'chart-fixture')
  root.render(createElement(ChartFixture))
else if (new URLSearchParams(location.search).get('component') === 'readonly-editor')
  root.render(createElement(ReadOnlyEditorFixture))
else root.render(createElement(Workbench, { api: createApi() }))
