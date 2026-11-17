# P0：Pi SDK 独立验证

这是 SDK 接入实验，不是应用后端。固定使用 `@earendil-works/pi-coding-agent@1.5.2`；无需启动前端或数据库。

## 安装与本地验证

本次实测环境：Windows、Node.js `24.18.0`、pnpm `11.22.0`。实验直接执行 TypeScript，要求 Node.js ≥ 24；SDK 本身要求 ≥ 22.19.0。

在本目录运行：

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd typecheck
pnpm.cmd test
```

`pnpm test` 使用本机 HTTP 模型替身，经过真实 SDK 的请求、流式事件、工具执行和 JSONL 持久化。生成、继续和停止分别在独立 Node.js 子进程执行。它证明接入与跨进程保存可运行，**不能证明真实模型已经接通或创作质量合格**。

`pnpm-workspace.yaml` 仅声明两个依赖安装脚本的处理方式，不建立应用工作区。已核对 `@google/genai` 的脚本为提示输出，`protobufjs` 的脚本为版本声明检查；两者无需构建，明确跳过以便锁文件安装可重复。

## 真实模型验证

1. 将 `.env.example` 复制为 `.env`，填写明确选定的 `P0_PROVIDER`、`P0_MODEL` 和本机密钥 `P0_API_KEY`。
2. 当前程序使用 SDK 内置模型目录。自定义网关须先确认 Base URL、协议与模型参数，再配置接入；不要把任意兼容网关默认为某一家供应商。
3. 依次执行以下命令；每条命令退出后再执行下一条，确保继续对话来自磁盘记录。

```powershell
pnpm.cmd verify generate
pnpm.cmd verify list
pnpm.cmd verify resume
pnpm.cmd verify abort
```

| 命令 | 验证行为 |
| --- | --- |
| generate | 读 `scene` 资料、输出核对标记和 A/B 候选、结束本轮，保存会话指针 |
| list | 从本机目录列出 SDK 保存的会话；不需要模型凭据 |
| resume | 从指针重开同一会话，用户选择 A 后继续回答，并再次核对资料标记 |
| abort | 新建独立测试会话，收到首个正文增量后调用 SDK 停止，检查中断结果 |

缺配置或断言失败时返回非零退出码，不写入本次成功报告。成功报告保存在 `.p0-data/report-<阶段>.json`，包含执行时间、模型、会话、事件数量和用量；报告是最近一次成功记录，重新验证时须核对时间，不能把旧报告当成本次成功。

生成结果仍需人工检查是否确实提供 A/B 候选、继续的是所选候选、遵守人物知情约束。程序中的核对标记只验证资料被读到/保留，不替代内容验收。

## 接入边界

- `src/session.ts`：显式系统提示、唯一只读工具、独立运行目录、SDK 会话创建/打开。
- `src/verify.ts`：真实模型的分阶段验证入口。
- `src/session.test.ts`、`tests/worker.ts`：本地协议替身与跨进程接入测试。
- `fixtures/scene.md`：合成资料，无用户小说内容。
- `.p0-data/agent`、`workspace`、`sessions`：实验运行数据，与个人 Pi 目录隔离；均不提交到 Git。

不自动加载工作区 AGENTS、技能、扩展或默认编码工具；不复制其他应用的凭据。压缩、有限重试与停止直接使用 SDK；压缩/重试本轮核对配置，不声称已触发真实长上下文或故障重试。

结果与剩余验收见 [P0 验证记录](../../docs/p0-validation.md)，后续接口设计见 [P1 接口草案](../../docs/api/p1-agent.md)。
