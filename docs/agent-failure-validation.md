# Agent 失败与恢复验收

日期：2026-11-20。

## 范围与结果

使用隔离数据目录和确定性模型协议替身。正式 HTTP、SSE、Pi SDK、工具、存储及页面走实际实现；聊天记录加载失败由 Playwright 拦截为 503。没有修改日常聊天数据或模型配置，没有对真实供应商制造故障。

- `node --test tests/api/agent.test.ts tests/api/controls.test.ts tests/api/basic-agent.test.ts`：30 项通过。
- `tests/ui/agent-failures-browser.js`：8 项页面行为检查通过。
- `tests/ui/basic-agent-recovery-browser.js`：3 项通过（加载失败重试、生成中刷新、刷新后停止）。
- 空态图标改为项目 Lucide `Logs`；组件库 typecheck 通过。

| 场景 | 结果 |
| --- | --- |
| 模型鉴权错误 | 返回可公开错误，原始凭据和内部错误不泄漏；页面提供重试 |
| 持续故障后手动重试 | 仍然失败，历史保留；随后正常请求可成功 |
| 模型 503 暂时异常 | 自动重试后完成 |
| 自动重试耗尽 | 两次重试、三次尝试后失败；只发一次最终事件 |
| 工具参数错误、浏览器不支持的 URL | 工具节点标记失败，历史可查询；模型可说明失败后正常结束整轮 |
| 重试等待、生成开始、浏览器等待时停止 | 中断生效、恢复 idle；停止后的请求可继续 |
| 客户端 SSE 断流 | 后端继续执行，重新查询获得结果 |
| 生成中刷新 | 恢复当前过程，仍可停止 |
| 服务强制退出或正常关闭 | 重开后保留中断状态，可继续对话 |
| 上下文压缩失败或取消 | 保留历史、错误脱敏，后续可继续 |
| 缺少凭据或模型、非法参数、忙时并发 | 明确拒绝，已有历史可读，配置不被错误修改 |
| 页面聊天记录查询失败 | 提供重新查询按钮，恢复后正常使用 |

## 截图

- 模型失败：`output/playwright/agent-failure-model.png`
- 失败后继续成功：`output/playwright/agent-failure-recovered.png`
- 自动重试成功：`output/playwright/agent-failure-auto-retry.png`
- 重试耗尽：`output/playwright/agent-failure-exhausted.png`
- 浏览器工具失败：`output/playwright/agent-failure-tool.png`
- 重试等待时停止：`output/playwright/agent-failure-stopped.png`
- 加载失败：`output/playwright/agent-failure-load.png`

页面截图中的 FAIL、RETRY、WRITE 等文本是隔离模型替身的测试指令。工具失败与整轮失败分开判断：工具失败后模型仍可正常结束，并不表示工具操作成功。恢复截图保留先前失败历史，新的最后一轮已成功；短时旧错误 toast 不代表新请求失败。

## 复验与限制

使用 `tests/ui/basic-agent-server.ts` 启动 4432 服务和 4435 本地表单，前端通过 `PLOTLOOM_WEB_API_TARGET=http://127.0.0.1:4432` 启动到 4433，再运行上述两个 Playwright CLI 脚本。自动重试成功场景的尝试次数由协议替身记录，复跑该脚本前重启隔离测试服务。

未覆盖真实供应商宕机、系统网络断开、磁盘耗尽、操作系统权限故障及任意第三方网页异常。本轮已测场景未发现阻塞性的失败或恢复问题；不据此宣称所有失败类型已覆盖。

没有变更公开业务接口。八条规则核对：仅执行失败验收与指定图标调整；前后端仍通过公开契约；测试关键逻辑有注释；自动验收方式已确认；无旧接口替换；图标无新增边框或阴影；图标维护于组件库；图标尺寸保持原样，不改状态布局。代码未提交或合并。
