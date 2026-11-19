# 通用表单组件验收

日期：2026-11-19。

交付范围：`packages/ui/src/form` 的 Input、Textarea、Select、Checkbox、CheckboxGroup、RadioGroup、Switch、NumberInput、FormField；九个公开导出均注册到组件调试台「表单组件」。本次不修改业务接口、不迁移产品页面。

## 实现与问题修复

- 统一浅灰背景、8px 圆角、三档尺寸和主题焦点反馈。选中标记、开关及下拉弹层使用轻微回弹；减少动态效果时关闭过渡。
- 沿用已安装的 Base UI、Lucide 和 ScrollBox；表单组件不访问应用状态或后端。
- Base UI 的非受控状态不会自动响应原生 reset，因此统一托管值，并在 reset 后更新显示及隐藏输入；取消 reset 时保留现值。
- 受控状态在原生 reset 后也重新同步隐藏输入，避免视觉未勾选但 FormData 中仍存在该值。受控值的业务重置由调用方执行。
- CheckboxGroup 显式将只读状态传给选项。Field.Item 只在 FormField 中使用，独立选项组使用原生标签，避免无 Field.Root 时出错。
- 数值框只在输入自身禁用时整体降透明度，某一侧达到步进边界不会被误判为整个控件禁用。

## 自动检查

| 检查 | 结果 |
| --- | --- |
| `pnpm.cmd typecheck` | 全仓通过 |
| `pnpm.cmd test:ui` | 20/20，通过全部公开组件目录覆盖检查 |
| `pnpm.cmd ui:build` | 通过；现有 TaskComposer 独立资源仍有大于 500kB 的构建提示 |
| `tests/ui/form-browser.js` | 29/29 浏览器断言通过 |
| `tests/ui/form-controlled-browser.js` | 8/8 受控及独立组件断言通过 |
| `git diff --check` | 通过 |

浏览器脚本验证真实 DOM、FormData 与组件交互，不包含在 Node 的 `test:ui` 命令中。首个脚本可针对开发版或构建预览；受控脚本需开发版，用独立 React 根挂载公开组件，结束后移除测试节点。

开发版 `pnpm.cmd ui` 启动后，在仓库根目录运行（已安装 agent-browser）：

```powershell
agent-browser.cmd --session form-check open http://localhost:4320
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; `$OutputEncoding = [System.Text.Encoding]::UTF8; Get-Content -Raw -Encoding UTF8 'tests/ui/form-browser.js' | agent-browser.cmd --session form-check eval --stdin"
agent-browser.cmd --session form-check reload
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; `$OutputEncoding = [System.Text.Encoding]::UTF8; Get-Content -Raw -Encoding UTF8 'tests/ui/form-controlled-browser.js' | agent-browser.cmd --session form-check eval --stdin"
agent-browser.cmd --session form-check close
```

## 浏览器实测

- 输入清空、密码显隐保留值和焦点；Textarea 计数和原生长度限制采用同一规则。标签、说明与错误通过 ID 关联，错误输入有 `aria-invalid`。
- 表单提交包含实际修改值；重置恢复文本、数值、选择、复选组、单选组与开关；preventDefault 阻止重置。禁用字段不提交，辅助按钮也不可操作。
- 单选搜索 Beta 后，ArrowDown + Enter 成功选择并返回触发器焦点；多选提交同名多个值，清空后为空数组；无匹配和空数据均显示空态，禁用项标记正确。
- Checkbox 可用 Space 切换；RadioGroup 可用 ArrowRight 切换。各选项类、数值框与 Select 的只读状态不改值。
- NumberInput 以 0.5 步进，增至 10 后停止；手动输入 99 失焦收敛到 10，清空为空值。必填 Select 为空时阻止提交并聚焦触发器。
- 受控输入接受空字符串、Select/RadioGroup 接受 null、数值接受 0/null、选项接受 false/空数组；调用方可恢复值，原生 reset 后隐藏字段与视图一致。
- 375px 画布下无横向溢出；减少动态效果实测选项标记及开关滑块的 transitionDuration 均为 0s。桌面及窄屏截图：`output/form-components-desktop.png`、`output/form-components-narrow.png`。

## 七条规则核对

1. 仅建设已确认的九个表单组件及调试示例，无额外业务功能。
2. 不依赖后端、Pi SDK、数据库或本机文件。
3. 值管理、重置、字段关联、选项组及弹层容器等关键逻辑有职责和原因注释。
4. 按用户已确认的组件范围实施，无未决需求冲突。
5. 新增组件，未删除或替换现有业务入口。
6. 控件无完整边框嵌套，不使用彩色边框；焦点用阴影，层级用背景和间距。
7. 通用能力在 packages/ui，调试台只展示组件及组合方式，不封装业务整页。

没有公开业务接口变更，因此无需修改接口目录或接口试验台。
