/** Navigation adapter for retained 0.6 behavior assertions against the frozen UI-v1 hierarchy. */
export function villageUI(page) {
  const raw = name => page.getByRole('button',{name,exact:true}).click()
  const tab = async name => { const item=page.getByRole('tab',{name,exact:true}); if(await item.getAttribute('aria-selected')!=='true')await item.click() }
  const settled=()=>page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return !s.reasons.includes('commit-pending')&&!s.error})
  const click = async original => {
    let name=({'编辑我的小院':'开始布置','撤销上一步':'撤销','确认我的布置':'保存布置','确认布局':'保存布置','保存装饰':'保存布置','取消我的布置':'取消'}[original]??original)
    if(name==='开始布置'){await tab('布置');await raw('家具')}
    if(name==='请一位朋友入住') {await tab('居民');await raw('安排入住');await page.getByLabel('入住 Claude',{exact:true}).click();await settled();await tab('心愿');await raw('一起活动');return}
    if(name==='全员入住'||name==='仅留当前'){await tab('居民');if(!await page.getByRole('button',{name,exact:true}).isVisible())await raw('安排入住')}
    if(['长椅小谈','分享一页书','聊聊花草','交换小点子','安静地坐一会儿','邀请同桌'].includes(name)){await tab('心愿');await raw('一起活动')}
    if(['展开小院','收起小院','小院设置','拍照','关闭小院','视角'].includes(name)&&!await page.getByRole('button',{name,exact:true}).isVisible())await raw('更多')
    if(name.endsWith(' · 模板')){const details=page.locator('.village-edit-options details');if(await details.getAttribute('open')===null)await details.locator('summary').click()}
    if(name.includes(' · 替代锚点')||name.includes(' · 原位')){const id=({'书桌':'work','餐桌':'eat','长椅':'bench','生活角落':'corner'})[name.split(' · ')[0]];await page.getByLabel('选中家具',{exact:true}).selectOption(id);const details=page.locator('.village-edit-options details');if(await details.getAttribute('open')!==null)await details.locator('summary').click()}
    await raw(name)
    if(original==='编辑我的小院')await page.locator('.village-edit-options details summary').click()
  }
  return {click,tab,settled}
}
