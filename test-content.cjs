const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false, args: [] });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 收集控制台日志
  const logs = [];
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    logs.push(`[ERROR] ${err.message}`);
  });

  // 创建一个模拟文章页面
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head><title>测试文章 - ADHD阅读器</title></head>
    <body>
      <article>
        <h1>ADHD专注阅读器测试文章</h1>
        <p>这是第一段内容。ADHD用户在阅读长文章时经常感到困难，因为注意力难以集中。这个扩展就是为了解决这个问题而设计的。通过科学的方法和工具，我们可以让阅读变得更加轻松愉快。</p>
        <p>这是第二段内容。通过分段阅读和引导线，我们可以帮助ADHD用户更好地理解和记忆所阅读的内容。每个段落都是独立的小单元，降低了认知负荷。</p>
        <p>这是第三段内容。AI摘要功能可以快速概括文章要点，关键词高亮帮助用户抓住重点。这些功能都是为ADHD用户量身定制的。</p>
        <p>这是第四段内容。我们相信每个人都应该有平等的机会来获取和理解信息。ADHD专注阅读器就是为此而生的。</p>
      </article>
    </body>
    </html>
  `);

  console.log('=== 页面已加载 ===');

  // 读取content.js
  const contentCode = fs.readFileSync(path.join(__dirname, 'dist/content/content.js'), 'utf8');
  console.log(`=== content.js 大小: ${(contentCode.length / 1024).toFixed(1)} KB ===`);

  // 注入content.js
  console.log('=== 开始注入 content.js ===');
  try {
    await page.addScriptTag({ content: contentCode });
    console.log('=== content.js 注入成功 ===');
  } catch (err) {
    console.error('=== content.js 注入失败 ===', err.message);
    await browser.close();
    return;
  }

  // 等待一下
  await page.waitForTimeout(1000);

  // 打印收集到的日志
  console.log('\n=== 页面控制台日志 ===');
  for (const log of logs) {
    console.log(log);
  }
  console.log('===================\n');

  // 检查overlay是否出现
  const hasOverlay = await page.evaluate(() => {
    return document.querySelector('#adhd-reader-root') !== null;
  });
  console.log('Overlay 已创建:', hasOverlay);

  if (hasOverlay) {
    console.log('\n✅ SUCCESS: Content script 正常工作！');
    console.log('浏览器将保持打开5秒供你查看...');
    await page.waitForTimeout(5000);
  } else {
    console.log('\n❌ FAIL: Overlay 未创建');
    console.log('浏览器将保持打开10秒供你调试...');
    await page.waitForTimeout(10000);
  }

  await browser.close();
})();
