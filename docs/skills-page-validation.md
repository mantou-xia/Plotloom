# 技能页面与本机导入验收

日期：2026-11-19。计划和能力盘点见 [skills-page-layout](plans/skills-page-layout.md)。

## 交付

- 先实现组件，再组合页面：通用 SegmentedControl 在 packages/ui，技能专用 SkillItem 在 apps/web。
- 系统内置/个人安装分段标签、数量、名称和描述搜索、清空搜索、双列/单列列表、加载/空/失败及导入错误状态。个人分类包含 custom/imported。
- 导入打开 Windows 原生文件夹选择器；取消不写库，成功转到个人分类并显示结果。
- 新协议 POST /api/skills/import-folder 接收空对象，返回 {skill: SkillInfo | null}。旧 POST /api/skills/import 删除，带 root 的新请求拒绝；同步迁移试验台目录、回填技能 ID、原测试与文档。
- 项目与技能共用一个选择器实例，跨模块并发返回 FOLDER_PICKER_BUSY。

## 验证

- pnpm.cmd typecheck：通过。
- pnpm.cmd test:ui：29 项通过。
- pnpm.cmd test:demo：10 项通过；目录覆盖仍检查所有路由文件和方法，60 个公开路由与登记一一对应。
- node --test tests/api/skills.test.ts：8 项通过，保留目录导入、二进制、源目录隔离、链接拒绝、版本、重启和聊天加载/停止检查；只替换系统选择端口，服务独立进程运行。
- project-folder-picker、project-registry、skill-folder-picker：3 项通过，覆盖选择取消、失败、不支持、并发、断连及服务关闭。
- web:build、ui:build、demo:build：通过。Vite 对既有大资源包报告体积警告，未扩大本次范围进行拆包。
- tests/ui/skills-browser.js：Chromium 24 项通过。组件键盘/禁用、分类、搜索、空结果、导入取消/失败/成功/等待、禁止重复提交、刷新失败重试、1440px 双列和 760px 单列。页面数据使用浏览器接口夹具，不写用户技能库。
- 桌面和窄屏截图已检查：output/playwright/skills-desktop.png、skills-narrow.png。
- Windows 原生选择器：隔离临时数据服务 4337，接口试验台浏览器将技能请求转发到该服务，未使用伪造响应。真实选择 native-browser-sample 后 200，16/16 响应检查通过；真实取消返回 skill:null，检查通过；选择不合法技能目录返回 400 并展示错误。
- 实测选择耗时 28 秒仍正常返回：修复试验台对技能导入套用普通请求 20 秒超时的问题。产品页面请求本就由 AbortController 管理，无此超时。
- 选择期间中止的 HTTP 清理在独立接口测试验证；确认后的原子导入不因断连回滚，契约说明通过列表核查结果。

## 七条规则核对

1. 只实现本次搜索、分类、导入布局，没有新增编辑/删除页面或预留框架。
2. 前端只依赖公开契约，目录选择和文件读取均在后端；接口独立测试。
3. 组件、导入、状态更新、选择器共享和超时规则有职责/原因注释。
4. 用户确认分段标签与本机文件夹后实施。
5. 用户明确授权删除旧输入路径接口；旧入口与调用文档已迁移，只有移除断言引用旧路径。
6. 分类与条目以背景和间距分层，仅标题下使用中性灰单侧分隔线，未叠加完整边框与阴影。
7. 通用分段组件、样式和独立调试台在组件库；技能业务条目和页面在应用组合。

## 运行说明

## 2026-11-20 一级 Tab 更新验收

- 用户确认不保留旧版，统一替换为 `PrimaryTabs` / `PrimaryTabPanel`；旧组件代码、导出、调试示例引用已清理。
- 样式参考 Uiverse curly-shrimp-52：灰底、等宽选项、白色滑块、0.2 秒移动；按项目规范移除滑块边框。来源与 MIT 声明随组件维护。
- `pnpm typecheck`、`pnpm test:ui`（29 项）、`pnpm web:build`、`pnpm ui:build` 通过。构建仍提示大资源包警告。
- `tests/ui/skills-browser.js` Chromium 28 项通过，含快速切换逐帧尺寸检查、滑块对齐、面板语义、禁用键盘跳过、减少动态效果和原技能页流程。接口使用浏览器夹具，本次未修改后端契约。
- 1440px 与 760px 截图已检查，标签和页面无横向溢出，截图位于 `output/playwright/skills-desktop.png`、`skills-narrow.png`。
- 八条规则核对：仅实现当前 Tab 需求；前后端保持公开协议；关键逻辑有注释；需求已澄清；旧版删除已获确认；Tab 无完整边框嵌套或边框叠阴影；通用组件位于 packages/ui、业务留在应用；选中态不改字重和尺寸，滑块脱离文档流，快速切换不推动标签。

### 既有后端运行说明

验收时现有 4317 后端仍是旧进程，对新接口返回 404。需重启后端加载新路由；本次原生验证使用隔离服务，避免写入现有技能库。原生选择器沿用当前项目 Windows 实现，其他系统返回 501。
