// Offline art preview check, not production game integration.
const { chromium }=require(process.env.ART_PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'previews/browser');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.ART_CHROMIUM_PATH});const page=await browser.newPage({viewport:{width:1200,height:1100},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>errors.push(r.url()));
 await page.goto(pathToFileURL(path.join(root,'preview.html')).href);await page.locator('.stage img').first().waitFor();await page.evaluate(()=>Promise.all([...document.images].map(im=>im.decode())));
 const rows=[];
 for(const [w,h] of [[340,720],[580,720],[1080,760]]){
   await page.selectOption('#size',`${w}×${h}`);await page.evaluate(()=>{$('door').value='0';draw();});await page.locator('#viewport').screenshot({path:path.join(out,`${w}x${h}-closed.png`)});
   await page.evaluate(()=>{$('door').value='100';draw();});await page.locator('#viewport').screenshot({path:path.join(out,`${w}x${h}-open.png`)});
   // Two distinct solid diagnostics behind the hole prove transparency in browser compositing.
   for(const [name,color] of [['blue','rgb(13, 97, 173)'],['pink','rgb(219, 43, 111)']]){
     await page.evaluate(color=>{$('world').style.background=color;},color);
     await page.locator('#viewport').screenshot({path:path.join(out,`${w}x${h}-reveal-${name}.png`)});
   }
   await page.evaluate(()=>{$('world').style.background='';});
   rows.push(await page.evaluate(()=>({size:$('size').value,decoded:[...document.images].every(x=>x.complete&&x.naturalWidth>0),doorTransforms:[...$('perspective').children].map(x=>getComputedStyle(x).transform),stage:[parseFloat($('stage').style.width),parseFloat($('stage').style.height)]})));
 }
 await page.selectOption('#size','580×720');await page.evaluate(()=>{$('door').value='40';draw();});await page.locator('#viewport').screenshot({path:path.join(out,'half-open.png')});
 await page.evaluate(()=>{draw(.91)});await page.locator('#viewport').screenshot({path:path.join(out,'cross.png')});
 await page.evaluate(()=>{stop();});await page.click('#play');await page.waitForFunction(()=>!playing,{},{timeout:10000});rows.push({animationCompleted:true});
 const result={status:errors.length?'FAIL':'PASS',scope:'Local standalone art preview in headless Chromium, DPR1; no real DSH runtime',errors,rows};
 await fs.writeFile(path.join(out,'validation.json'),JSON.stringify(result,null,2)+'\n');await browser.close();console.log(JSON.stringify(result));if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
