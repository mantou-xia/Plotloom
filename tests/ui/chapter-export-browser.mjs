import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** 用正式界面验收连续创作。模型替身只提供工具决策，保存、下载及文件字节均走真实入口。 */
export default async function verifyChapterExport(page, origin, bookRoot) {
  const title = '归舟导出验收';
  const draft = '# 第四章 **归舟**\n\n“明早开船。”\n“好。”';
  const final = draft.replace('明早开船。', '等潮退了再走。');
  const plain = '第四章 归舟\n\n“等潮退了再走。”\n“好。”';
  const button = name => page.getByRole('button', { name, exact: true });
  const send = async (text, steps) => {
    const composer = page.getByRole('textbox', { name: '尽管问...' });
    await composer.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.insertText(text + '\nWRITE:' + JSON.stringify({ steps }));
    await button('发送').click();
  };
  const answer = async (label, yes) => {
    const form = page.getByRole('form', { name: label });
    await form.getByRole('radio').nth(yes ? 0 : 1).check();
    await form.getByRole('button', { name: '发送' }).click();
    await form.waitFor({ state: 'hidden' });
  };
  const idle = () => page.waitForFunction(() => !document.querySelector('[aria-label="停止任务"]'));
  const downloads = [];
  page.on('download', download => downloads.push(download));
  await mkdir(bookRoot);
  await page.goto(origin + '/#page=novels');
  await page.getByRole('main').getByRole('button', { name: '新建小说', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '新建小说' });
  await dialog.getByLabel('小说名称').fill(title);
  await dialog.getByLabel('本机文件夹').fill(bookRoot);
  await button('创建并开始对话').click();
  await page.getByRole('heading', { name: '继续创作《' + title + '》' }).waitFor();
  for (const number of ['一', '二', '三']) await writeFile(join(bookRoot, '正文章节', '第' + number + '章.md'), '林舟在码头等潮。');
  await send('写第四章：承接前三章，林舟决定开船。', [
    { name: 'write_chapter_part', args: { part: 1, content: draft } },
    { name: 'review_writing', args: { status: 'clear', issues: [] } },
    { name: 'deliver_chapter', args: { partCount: 1, reason: '交付第四章' } },
  ]);
  const approve = page.getByRole('button', { name: '允许一次', exact: true });
  const legacy = page.getByRole('form', { name: /新建正文/ });
  await approve.or(legacy).first().waitFor();
  if (await approve.isVisible()) await approve.click();
  else await answer(/新建正文/, true);
  const panel = page.getByRole('region', { name: '正文章节工作区' });
  await panel.getByRole('heading', { name: '第四章 归舟' }).waitFor();
  const files = await readdir(join(bookRoot, '正文章节'));
  const chapters = files.filter(name => /^第(?:四|4)章.*\.md$/.test(name));
  assert.equal(chapters.length, 1);
  const path = '正文章节/' + chapters[0];
  await panel.getByRole('tab', { name: '编辑', exact: true }).click();
  const editor = panel.getByRole('textbox', { name: '文稿正文' });
  await editor.focus();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(final);
  await panel.getByText('已保存', { exact: true }).waitFor();
  assert.equal(await readFile(join(bookRoot, path), 'utf8'), final);
  await panel.getByRole('button', { name: '定稿选项' }).click();
  const manual = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: '导出 TXT' }).click();
  const first = await manual;
  assert.equal(first.suggestedFilename(), chapters[0].slice(0, -3) + '.txt');
  assert.deepEqual(await readFile(await first.path()), Buffer.from(plain));
  const steps = [{ name: 'manuscript_workspace', args: { action: 'export_txt', path } }];
  await send('取消这次测试导出', steps);
  await answer(/下载本章最新保存稿为 TXT/, false);
  await idle();
  assert.equal(downloads.length, 1);
  await send('请导出第四章 TXT', steps);
  const automatic = page.waitForEvent('download');
  await answer(/下载本章最新保存稿为 TXT/, true);
  const second = await automatic;
  assert.equal(second.suggestedFilename(), first.suggestedFilename());
  assert.deepEqual(await readFile(await second.path()), Buffer.from(plain));
  await page.reload();
  await page.getByRole('region', { name: '聊天', exact: true }).waitFor();
  await idle();
  assert.equal(downloads.length, 2);
  return { title, path, filename: first.suggestedFilename(), bytes: Buffer.byteLength(plain) };
}
