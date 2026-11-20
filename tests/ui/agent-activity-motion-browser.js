// Playwright CLI：验证实体区域持续运动，不用背景散点变化冒充形态动画。
async (page) => {
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.getByRole('button', { name: 'AgentActivityHeader 10' }).click();
  const preview = page.frames().find(frame => frame.url().includes('preview=1'));
  const result = await preview.evaluate(async () => {
    const { createActivityRenderer } = await import('/@fs/D:/git-depository/Plotloom/packages/ui/src/agent-activity/particle-renderer.js');
    const names=['magnifier','cube','bricks','robot','gift','book','pencil','folder','sphere'];
    const checks=[];
    for(let index=0;index<names.length;index++){
      const canvas=document.createElement('canvas');
      const paint=createActivityRenderer(canvas);
      const sample=(time,reduced=false)=>{
        paint(index,10,time,reduced,'#222');
        const dpr=Math.min(devicePixelRatio,2);
        return canvas.getContext('2d').getImageData(160*dpr,140*dpr,240*dpr,240*dpr).data;
      };
      const a=sample(8),b=sample(9.1);
      let diff=0;for(let i=3;i<a.length;i+=4)if(a[i]!==b[i])diff++;
      if(diff<500)throw new Error(`${names[index]} 实体持续运动不足：${diff}`);
      const c=sample(8,true),d=sample(9.1,true);
      if(c.some((value,i)=>value!==d[i]))throw new Error(`${names[index]} 减少动态效果不稳定`);
      checks.push({shape:names[index],changedPixels:diff});
    }
    return checks;
  });
  if(await page.getByRole('combobox',{name:'渲染效果',exact:true}).count())throw new Error('ASCII 控件残留');
  await page.locator('#example-state').selectOption('unknown');
  const frame=page.frameLocator('iframe');
  await frame.locator('canvas[data-shape="sphere"]').waitFor();
  await page.waitForTimeout(1200);
  await frame.locator('.pl-agent-activity').screenshot({path:'output/playwright/agent-activity-sphere.png'});
  for(const shape of ['book','folder','gift']){
    await page.getByRole('combobox',{name:'粒子形态',exact:true}).selectOption(shape);
    await page.waitForTimeout(1300);
    await frame.locator('.pl-agent-activity').screenshot({path:`output/playwright/agent-motion-${shape}.png`});
  }
  return {assertions:20,motion:result};
}
