import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { launchBrowser, pkg } from './browser-runtime.mjs'

const local = createRequire(import.meta.url)
const react = dirname(local.resolve('react/package.json'))
const dom = dirname(local.resolve('react-dom/package.json'))
const build = join(pkg, '.build')
await mkdir(build, {recursive:true})
const stage = await mkdtemp(join(build, 'browser-'))
process.env.DSH_HOME = join(stage, 'home')
const dataRoot = join(stage, 'profile/ai-infra-lab')
const { Context, Service } = await import('@deepseek-ai/cordis')
const host = await import('../lib/index.js')
const ctx = new Context()
class Connection extends Service { constructor(ctx) { super(ctx, 'connection') } }

// Only the Desktop slot shell is supplied by the fixture. Components, React, network
// requests, grading, SQLite, and run event streams use their production implementations.
const shell = `<!doctype html><meta charset="utf-8"><title>AI Infra Lab</title>
<style>html,body,#root{height:100%;margin:0}</style><div id="root"></div>
<script src="/react.js"></script><script src="/dom.js"></script><script src="/jsx.js"></script>
<script>window.__ModuleLoader__={load(entry){window.entry=entry}};</script>
<script src="/client.js"></script><script>
document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
const modules={'react':React,'react-dom':ReactDOM,'react/jsx-runtime':window.jsxRuntime};
const plugin=entry.factory(id=>{if(!(id in modules))throw Error('Missing browser module '+id);return modules[id]});
plugin.apply({effect:fn=>fn(),locale:{register:()=>()=>{},bind:()=>()=>''},layout:{},
 slots:{inject:(name,fn)=>fn(),register:(meta,component)=>{
   if(meta.name==='main')ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(component,meta.inject()));
   return ()=>{};
 }}});
</script>`
const assets = new Map([
  ['/', ['text/html', shell]], ['/favicon.ico', ['image/x-icon', '']],
  ['/client.js', ['text/javascript', await readFile(join(pkg,'lib/client.js'))]],
  ['/react.js', ['text/javascript', await readFile(join(react,'umd/react.production.min.js'))]],
  ['/dom.js', ['text/javascript', await readFile(join(dom,'umd/react-dom.production.min.js'))]],
  ['/jsx.js', ['text/javascript', 'window.jsxRuntime={};(function(exports,require){\n'+
    await readFile(join(react,'cjs/react-jsx-runtime.production.min.js'),'utf8')+
    '\n})(window.jsxRuntime,id=>{if(id==="react")return React;throw Error(id)});']],
])
const server = createServer((req,res) => {
  const asset = assets.get(req.url)
  if (asset) { res.writeHead(200,{'content-type':asset[0]+'; charset=utf-8'}); res.end(asset[1]); return }
  void ctx.waterfall('connection/request',req,res,async()=>{res.writeHead(404);res.end()})
    .catch(error=>{res.writeHead(500);res.end(String(error))})
})

const visualSelector = {
  'bit-layout':'.ail-bit-grid', roofline:'svg', 'gpu-coalescing':'.ail-lane-grid',
  'memory-waterfall':'.ail-memory-stack','pipeline-schedule':'svg',
  'serving-scheduler':'svg','capacity-planner':'progress',
}

async function openLesson(page, lesson, lang) {
  const nav = page.locator('.ail-lesson-item').filter({has:page.getByText(lesson.id,{exact:true})})
  await nav.click()
  await page.locator('.ail-main-tabs [role=tab]').first().click()
  await page.locator('.ail-lesson-header h2').filter({hasText:lesson.title[lang]}).waitFor()
}
async function activity(page, lesson, exercise, lang) {
  await openLesson(page,lesson,lang)
  await page.locator('.ail-main-tabs [role=tab]').nth(1).click()
  const title = lesson.exercises.find(ex=>ex.id===exercise).title[lang]
  await page.locator('.ail-ex-tabs [role=tab]').filter({hasText:title}).click()
  await page.locator('.ail-ex-title').filter({hasText:title}).waitFor()
}
function luminance(color) {
  const [r,g,b] = color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255)
    .map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4)
  return r*0.2126+g*0.7152+b*0.0722
}
let browser
try {
  const engine = await host.Engine.open(dataRoot, 'dsh-ai-infra-lab-cpu:0.1')
  try {
    for (const [id, config] of [['B05-code',{}],['D05-code',{world_size:2}],['D05-code',{world_size:4}]]) {
      const ex=engine.exercise(id)
      const run=await engine.start(id, ex.reference,config,'Compare the measured bytes or collective calls.')
      const result=await engine.waitRun(run.id)
      assert.equal(result.check_status,'passed',id+' '+(result.reason ?? result.log))
    }
  } finally { await engine.close() }
  await ctx.plugin(Connection)
  await ctx.plugin(host,host.Config({dataRoot}))
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const origin='http://127.0.0.1:'+server.address().port
  const rpc=async(method,...args)=>{
    const response=await fetch(origin+'/api/ai-infra-lab/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,args})})
    assert.equal(response.status,200)
    return response.json()
  }
  const {catalog} = await rpc('overview')
  const widgets=catalog.lessons.filter(l=>l.simulatorWidget)
  assert.equal(new Set(widgets.map(l=>l.simulatorWidget)).size,7)
  browser=await launchBrowser()
  const errors=[], records=[], themes={}, titles=new Map()
  let submissions=0, trafficBytes, ranks
  for (const dpr of [1,2]) for (const theme of ['light','dark']) for (const lang of ['zh','en']) {
    const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:dpr,colorScheme:theme,locale:lang==='zh'?'en-US':'zh-CN'})
    try {
      const page=await context.newPage()
      page.setDefaultTimeout(10000)
      page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
      page.on('pageerror',e=>errors.push(String(e)))
      await page.goto(origin)
      await page.locator('.ail-locale-switch').getByRole('button',{name:lang==='zh'?'中文':'EN',exact:true}).click()
      for (const lesson of widgets) {
        await openLesson(page,lesson,lang)
        const panel=page.locator('.ail-lesson-stack section.ail-explorer, .ail-lesson-stack section.ail-sim-card')
        await panel.scrollIntoViewIfNeeded()
        const metrics=await panel.evaluate((el,selector)=>{
          const rect=el.getBoundingClientRect(), root=document.documentElement, app=el.closest('main')
          const css=getComputedStyle(app)
          const graphic=el.querySelector(selector).getBoundingClientRect()
          return {width:rect.width,height:rect.height,graphic:[graphic.width,graphic.height],dpr:devicePixelRatio,viewport:[innerWidth,innerHeight],
            pageOverflow:root.scrollWidth-root.clientWidth,theme:root.dataset.theme,fg:css.color,bg:css.backgroundColor,
            title:el.querySelector('h3').textContent.trim(),text:el.innerText,
            labels:[...el.querySelectorAll('[aria-label]')].map(n=>n.getAttribute('aria-label')).join('\n')}
        },visualSelector[lesson.simulatorWidget])
        assert.deepEqual(metrics.viewport,[1280,800])
        assert.equal(metrics.theme,theme)
        assert.equal(metrics.dpr,dpr)
        assert.equal(metrics.pageOverflow,0,lesson.id+' horizontal overflow')
        assert.ok(metrics.width>200 && metrics.height>40,lesson.id+' collapsed')
        assert.ok(metrics.graphic.every(n=>n>0),lesson.id+' chart collapsed inside its panel')
        const bright=luminance(metrics.bg),dark=luminance(metrics.fg)
        const contrast=(Math.max(bright,dark)+0.05)/(Math.min(bright,dark)+0.05)
        assert.ok(contrast>=4.5,theme+' body text contrast '+contrast)
        themes[theme]={fg:metrics.fg,bg:metrics.bg,contrast}
        if(lang==='en') {
          assert.doesNotMatch(metrics.text+'\n'+metrics.labels,/\p{Script=Han}/u,lesson.id+' English widget')
          assert.notEqual(metrics.title,titles.get(lesson.id))
          const lessonText=await page.locator('.ail-lesson-stack').innerText()
          assert.doesNotMatch(lessonText,/\p{Script=Han}/u,lesson.id+' English lecture and controls')
        } else {
          assert.match(metrics.title,/\p{Script=Han}/u)
          titles.set(lesson.id,metrics.title)
          const lessonText=await page.locator('.ail-lesson-stack').innerText()
          assert.ok(lessonText.includes(lesson.summary.zh) && !lessonText.includes(lesson.summary.en),lesson.id+' localized summary')
          // Technical tokens (FP32, GPipe, etc.) are shared. Full English sentences are not.
          assert.doesNotMatch(metrics.text,/\b(?:[A-Za-z]{3,} ){4,}[A-Za-z]{3,}\b/,lesson.id+' Chinese widget')
        }
        if (lesson.id[0]!=='A') {
          const presets=panel.locator('.ail-presets button')
          assert.equal(await presets.count(),3)
          await presets.nth(1).click()
          assert.equal(await presets.nth(1).getAttribute('aria-pressed'),'true')
          if(lesson.id==='X01') {
            await presets.first().click()
            assert.equal(await panel.locator('.ail-capacity-budget').getAttribute('data-over'),'true')
            await presets.nth(1).click()
            assert.equal(await panel.locator('.ail-capacity-budget').getAttribute('data-over'),'false')
          }
        }
        records.push({widget:lesson.simulatorWidget,dpr,theme,lang,width:metrics.width,height:metrics.height,graphic:metrics.graphic,overflow:metrics.pageOverflow})
      }
      await activity(page,widgets.at(-1),'X01-design',lang)
      const explanation=lang==='zh'?'我把权重和 KV 字节按卡拆开，再用剩余带宽核对吞吐。':'I separate weights and KV bytes per card before bounding throughput by bandwidth.'
      await page.locator('.ail-explanation-label textarea').fill(explanation+' '+theme+dpr)
      const reply=page.waitForResponse(r=>r.url().endsWith('/rpc') && r.request().postDataJSON()?.method==='answer')
      await page.getByRole('button',{name:lang==='zh'?'提交机制解释':'Submit Explanation',exact:true}).click()
      assert.equal((await (await reply).json()).status,'inconclusive')
      const neutral=page.locator('.ail-feedback-neutral')
      await neutral.waitFor()
      assert.match(await neutral.innerText(),lang==='zh'?/已保存分析记录/:/Analysis saved/)
      assert.equal(await page.locator('.ail-feedback-fail').count(),0)
      submissions++
      if(dpr===1 && theme==='light') {
        await activity(page,catalog.lessons.find(l=>l.id==='B05'),'B05-code',lang)
        await page.locator('.ail-traffic').waitFor()
        assert.equal(await page.locator('.ail-traffic-row').count(),4)
        trafficBytes=await page.locator('.ail-traffic-row').evaluateAll(rows=>rows.map(row=>
          [...row.querySelectorAll('.ail-traffic-series > span[aria-label]')].map(span=>Number(span.textContent.replace(/[, B]/g,'')))))
        // The final graded FP32 matrices have shapes [32,48] and [48,16]; the tile edge is 16.
        assert.deepEqual(trafficBytes,[[196608,12288],[2048,2048],[0,196608],[0,12288]])
        if(lang==='zh') {
          assert.equal(await page.locator('.ail-comparison').count(),0)
          await page.getByRole('button',{name:'载入该次运行代码'}).click()
          await page.locator('.ail-prediction-box textarea').fill('尺寸相同，预计朴素和分块分别重复上一次的字节数。')
          await page.getByRole('button',{name:/运行验证/}).click()
          await page.locator('.ail-comparison').waitFor({timeout:60000})
          assert.equal(await page.locator('.ail-comparison select').first().locator('option').count(),2)
          assert.match(await page.locator('.ail-comparison').innerText(),/1×/)
        }
        await activity(page,catalog.lessons.find(l=>l.id==='D05'),'D05-code',lang)
        await page.locator('.ail-chart svg').first().waitFor()
        ranks=(await page.locator('.ail-chart svg').first().locator('g > text').allTextContents())
        assert.deepEqual(ranks,['Rank 0','Rank 1','Rank 2','Rank 3'])
        const selects=page.locator('.ail-comparison select')
        const original=await selects.first().inputValue(), other=await selects.last().inputValue()
        assert.notEqual(original,other)
        await selects.first().selectOption(other)
        assert.equal(await selects.last().inputValue(),original)
        const sizes=await page.locator('.ail-comparison tr').filter({has:page.getByRole('rowheader',{name:'world_size',exact:true})}).innerText()
        assert.match(sizes,/4\s+2/)
        assert.match(await page.locator('.ail-comparison').innerText(),/×/)
      }
      assert.deepEqual(errors,[])
      console.log('PASS browser',dpr+'x',theme,lang,'7 widgets and a saved neutral explanation')
    } finally { await context.close() }
  }
  assert.notEqual(themes.light.bg,themes.dark.bg)
  const archive=JSON.parse(await rpc('exportData'))
  assert.equal(archive.answers.filter(a=>a.exerciseId==='X01-design' && a.status==='inconclusive').length,submissions)
  await writeFile(join(build,'browser-v'+catalog.version+'.json'),JSON.stringify({browser:browser.version(),viewport:[1280,800],themes,submissions,trafficBytes,ranks,errors,records},null,2))
} finally {
  await browser?.close()
  if(server.listening) { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)) }
  await ctx.fiber.dispose()
  await rm(stage,{recursive:true,force:true})
}
