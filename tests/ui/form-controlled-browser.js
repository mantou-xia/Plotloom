/* 在 Vite 开发版调试台运行：用独立 React 根验证受控字段，完成后移除临时节点。 */
(async () => {
  const resources = performance.getEntriesByType('resource').map(item => item.name);
  const R = (await import(resources.find(url => /deps\/react\.js/.test(url)))).default;
  const RD = (await import(resources.find(url => /deps\/react-dom_client\.js/.test(url)))).default;
  const frame = document.querySelector('iframe').contentWindow;
  const inputUrl = frame.performance.getEntriesByType('resource').map(item => item.name).find(url => /\/form\/input\.tsx/.test(url));
  const base = inputUrl.slice(0, inputUrl.lastIndexOf('/') + 1);
  const names = ['input', 'textarea', 'select', 'checkbox', 'checkbox-group', 'radio-group', 'switch', 'number-input'];
  const modules = await Promise.all(names.map(name => import(`${base}${name}.tsx`)));
  const [Input, Textarea, Select, Checkbox, CheckboxGroup, RadioGroup, Switch, NumberInput] = modules.map((module, index) => module[['Input', 'Textarea', 'Select', 'Checkbox', 'CheckboxGroup', 'RadioGroup', 'Switch', 'NumberInput'][index]]);
  const host = document.createElement('div');
  document.body.append(host);
  const root = RD.createRoot(host);
  let update;
  const options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
  const pause = () => new Promise(resolve => setTimeout(resolve, 160));
  const results = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); results.push(message); };
  function Fixture() {
    const [value, setValue] = R.useState({ text: '初始值', select: 'a', list: ['a'], number: 2, checked: true });
    update = setValue;
    const props = key => ({ name: key, value: value[key], 'aria-label': key, onValueChange: next => setValue(current => ({ ...current, [key]: next })) });
    const checkProps = { checked: value.checked, onCheckedChange: checked => setValue(current => ({ ...current, checked })) };
    return R.createElement('form', null,
      R.createElement(Input, { ...props('text'), clearable: true }),
      R.createElement(Textarea, { ...props('text'), name: 'notes' }),
      R.createElement(Select, { ...props('select'), options }),
      R.createElement(Checkbox, { ...checkProps, name: 'check', label: '复选' }),
      R.createElement(CheckboxGroup, { ...props('list'), options }),
      R.createElement(RadioGroup, { ...props('select'), name: 'radio', options }),
      R.createElement(Switch, { ...checkProps, name: 'switch', label: '开关' }),
      R.createElement(NumberInput, props('number')));
  }
  try {
    root.render(R.createElement(Fixture)); await pause();
    update({ text: '', select: null, list: [], number: 0, checked: false }); await pause();
    const data = () => Array.from(new FormData(host.querySelector('form')).entries());
    const changed = JSON.stringify(data());
    assert(host.querySelector('[name=text]').value === '' && host.querySelector('textarea').value === '', '受控文本接受空字符串');
    assert(host.querySelector('.pl-form-select__trigger').textContent === '请选择', '受控 Select 接受 null');
    assert(host.querySelector('.pl-form-number input:not([type=hidden])').value === '0', '受控数值接受零');
    assert(!data().some(([name]) => ['check', 'switch', 'list', 'radio'].includes(name)), '受控选项接受 false、空数组和 null');
    host.querySelector('form').reset(); await pause();
    assert(JSON.stringify(data()) === changed, '原生 reset 不使受控隐藏字段与视图失配');
    update({ text: '恢复值', select: 'b', list: ['b'], number: null, checked: true }); await pause();
    assert(host.querySelector('[name=text]').value === '恢复值' && host.querySelector('.pl-form-select__trigger').textContent === 'B', '调用方可以重置受控字段');
    assert(host.querySelector('.pl-form-number input:not([type=hidden])').value === '', '受控数值接受 null');
    host.querySelector('[aria-label=清空输入]').click(); await pause();
    assert(host.querySelector('[name=text]').value === '', '受控清空回调更新调用方值');
    return { passed: results.length, results };
  } finally {
    root.unmount(); host.remove();
  }
})()
