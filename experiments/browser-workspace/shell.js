const status = document.querySelector('#status');
/** 壳只处理明确的用户动作；原生网页视图和自动化由宿主控制。 */
async function command(action, value) {
  try { await window.workspace.command(action, value); }
  catch { status.textContent = '操作未完成，请重试。'; }
}
for (const button of document.querySelectorAll('[data-tab]')) button.onclick = () => command('tab', button.dataset.tab);
for (const action of ['back', 'forward', 'reload']) document.querySelector(`#${action}`).onclick = () => command(action);
document.querySelector('#takeover').onclick = () => command('takeover');
document.querySelector('#navigation').onsubmit = event => { event.preventDefault(); command('navigate', document.querySelector('#address').value); };
window.workspace.subscribe(state => {
  if (state.url) document.querySelector('#address').value = state.url;
  if (state.mode) document.querySelector('#mode').textContent = state.mode === 'agent' ? 'Agent 操作中' : '用户操作中';
  if (state.status) status.textContent = state.status;
  if (state.tab) for (const button of document.querySelectorAll('[data-tab]')) button.setAttribute('aria-pressed', String(button.dataset.tab === state.tab));
  if ('back' in state) document.querySelector('#back').disabled = !state.back;
  if ('forward' in state) document.querySelector('#forward').disabled = !state.forward;
});
