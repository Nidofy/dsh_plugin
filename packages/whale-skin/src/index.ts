import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import { readFile } from 'node:fs/promises'
export const name = 'nidofy-whale-skin'
export const inject = ['connection']
const allowed = new Set(['day.webp','night.webp','companion.webp'])
export function apply(ctx: Context) {
  const lifetime = new AbortController()
  ctx.effect(()=>()=>lifetime.abort())
  ctx.on('connection/request', async (request,response,next)=>{
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/nidofy-whale-skin/')) return next()
    const file = url.pathname.slice('/api/nidofy-whale-skin/'.length)
    if (!allowed.has(file) || !['GET','HEAD'].includes(request.method ?? '')) {response.writeHead(404);response.end();return}
    try {
      const bytes = await readFile(new URL('../assets/'+file,import.meta.url),{signal:lifetime.signal})
      response.setHeader('content-type','image/webp');response.setHeader('cache-control','no-cache')
      response.end(request.method==='HEAD'?undefined:bytes)
    } catch { if(!response.destroyed){response.writeHead(404);response.end()} }
  })
}
