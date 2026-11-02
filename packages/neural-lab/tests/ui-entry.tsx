import { createElement } from 'react'
import {createRoot} from 'react-dom/client'
import {Workbench} from '../src/workbench.tsx'
import {createApi} from '../src/client-api.ts'
createRoot(document.getElementById('root')!).render(createElement(Workbench,{api:createApi()}))
