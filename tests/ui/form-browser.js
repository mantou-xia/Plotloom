/* 在已打开组件调试台的浏览器中执行；验证真实控件与 FormData，而非匹配实现源码。 */
(async () => {
  const results = [];
  const wait = () => new Promise(resolve => setTimeout(resolve, 180));
  const assert = (condition, message) => { if (!condition) throw new Error(message); results.push(message); };
  const frame = () => document.querySelector('iframe').contentDocument;
  const data = () => Array.from(new (frame().defaultView.FormData)(frame().querySelector('form')).entries());
  const navigate = async name => {
    Array.from(document.querySelectorAll('nav button')).find(button => new RegExp(`^${name}\\d`).test(button.textContent)).click();
    await wait();
  };
  const sample = async value => {
    const select = document.querySelector('#example-state');
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await wait();
  };
  const fill = async (element, value) => {
    const win = element.ownerDocument.defaultView;
    const prototype = element.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new win.Event('input', { bubbles: true }));
    await wait();
  };
  await navigate('Input');
  let d = frame();
  await fill(d.querySelector('input[name=value]'), '回归验证');
  assert(data()[0][1] === '回归验证', 'Input 值更新后进入 FormData');
  d.querySelector('[aria-label=清空输入]').click(); await wait();
  assert(d.activeElement === d.querySelector('input[name=value]') && data()[0][1] === '', 'Input 清空并返回焦点');
  d.querySelector('[type=reset]').click(); await wait();
  assert(data()[0][1] === '示例文本', 'Input 重置恢复初始值');
  await sample('password'); d = frame();
  d.querySelector('[aria-label=显示密码]').click(); await wait();
  assert(d.querySelector('input[name=value]').type === 'text', '密码显隐生效');
  await sample('error'); d = frame();
  const input = d.querySelector('input[name=value]');
  const described = input.getAttribute('aria-describedby').split(' ').map(id => d.getElementById(id)?.textContent).join(' ');
  assert(input.getAttribute('aria-invalid') === 'true' && described.includes('请检查'), '错误信息与输入框正确关联');

  await navigate('FormField'); d = frame();
  const initial = JSON.stringify(data());
  await fill(d.querySelector('textarea'), '更新多行文字');
  assert(d.querySelector('.pl-form-count').textContent === '6 / 80', 'Textarea 字数与内容同步');
  d.querySelector('[aria-label=增加数值]').click();
  d.querySelectorAll('[role=checkbox]')[1].click();
  d.querySelectorAll('[role=radio]')[1].click();
  d.querySelector('[role=switch]').click(); await wait();
  assert(JSON.stringify(data()) !== initial, '组合字段真实交互改变提交值');
  const cancel = event => event.preventDefault();
  d.querySelector('form').addEventListener('reset', cancel);
  d.querySelector('[type=reset]').click(); await wait();
  assert(JSON.stringify(data()) !== initial, '取消 reset 时保留现值');
  d.querySelector('form').removeEventListener('reset', cancel);
  d.querySelector('[type=reset]').click(); await wait();
  assert(JSON.stringify(data()) === initial, '文本、数值、复选组、单选组、开关统一恢复');
  assert(d.querySelectorAll('[role=checkbox]')[1].getAttribute('aria-checked') === 'false' && d.querySelector('[role=switch]').getAttribute('aria-checked') === 'true', '重置后视觉状态与提交值一致');
  await sample('disabled');
  assert(data().length === 0, '禁用字段不进入 FormData');
  assert(Array.from(frame().querySelectorAll('.pl-form-action')).every(button => button.disabled), '禁用字段同步禁用辅助按钮');

  for (const name of ['Checkbox', 'CheckboxGroup', 'RadioGroup', 'Switch', 'NumberInput', 'Select']) {
    await navigate(name); await sample('readonly'); d = frame();
    const before = JSON.stringify(data());
    d.querySelector('[role=checkbox], [role=radio], [role=switch], .pl-form-select__trigger, [aria-label=增加数值]')?.click(); await wait();
    assert(JSON.stringify(data()) === before, `${name} 只读交互不改值`);
  }
  await navigate('NumberInput'); d = frame();
  for (let i = 0; i < 20; i++) { d.querySelector('[aria-label=增加数值]').click(); await wait(); }
  assert(data()[0][1] === '10' && d.querySelector('[aria-label=增加数值]').disabled, 'NumberInput 步进不超过上界');
  assert(d.defaultView.getComputedStyle(d.querySelector('.pl-form-control')).opacity === '1', '达到范围边界不会误禁用整个数值框');
  d.querySelector('[type=reset]').click(); await wait();
  d.querySelector('[aria-label=增加数值]').click(); await wait();
  assert(data()[0][1] === '2.5', 'NumberInput 小数步进准确');

  await navigate('Select'); d = frame();
  d.querySelector('.pl-form-select__trigger').click(); await wait();
  await fill(d.querySelector('.pl-form-select__search input'), '不存在');
  assert(d.querySelector('.pl-form-select__empty').textContent.includes('没有匹配'), 'Select 搜索无结果显示空态');
  await fill(d.querySelector('.pl-form-select__search input'), 'Beta');
  assert(d.querySelectorAll('[role=option]').length === 1, 'Select 按标签筛选');
  d.querySelector('[role=option]').click(); await wait();
  assert(data()[0][1] === 'beta', 'Select 单选提交字符串');
  d.querySelector('[type=reset]').click(); await wait();
  assert(data()[0][1] === 'alpha', 'Select 单选 reset 恢复初始值');
  await sample('multiple'); d = frame();
  d.querySelector('.pl-form-select__trigger').click(); await wait();
  Array.from(d.querySelectorAll('[role=option]')).find(node => node.textContent === '选项 Beta').click(); await wait();
  assert(data().map(pair => pair[1]).join() === 'alpha,beta', 'Select 多选以同名字段提交多个值');
  d.querySelector('.pl-form-select__trigger').click(); await wait();
  d.querySelector('[aria-label=清空选择]').click(); await wait();
  assert(data().length === 0, 'Select 多选清空为空数组');
  d.querySelector('[type=reset]').click(); await wait();
  assert(data()[0][1] === 'alpha', 'Select 多选重置恢复默认项');
  await sample('empty'); d = frame();
  d.querySelector('.pl-form-select__trigger').click(); await wait();
  assert(d.querySelectorAll('[role=option]').length === 0 && d.querySelector('.pl-form-select__empty').textContent.includes('没有匹配'), 'Select 空数据可正常展开');
  return { passed: results.length, results };
})()
