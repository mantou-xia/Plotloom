# 五栏角色卡接口

角色卡阶段是工作区内的 Markdown 文件，路径位于 `角色卡/<角色名>/`。文件包含不可见的阶段标记，记录开始适用的章节号、作者备注和可选的正文证据。正文仍可由外部编辑器直接修改，版本由工作区接口计算。

## 查询阶段

`GET /api/workspaces/:workspaceId/character-cards?chapter=4`

- `cards` 返回符合筛选条件的全部历史阶段。每项包含 `createdAt`（ISO 8601），用于管理页按创建时间倒序展示。由外部加入且没有历史的卡片，使用首次观察时间。
- `applicable` 返回每个角色在目标章节之前最新的阶段。省略 `chapter` 时返回每个角色的最新阶段。
- 可追加 `character` 精确查询角色名称。

## 创建阶段

`POST /api/workspaces/:workspaceId/character-cards`

```json
{
  "character": "林舟",
  "chapter": 4,
  "note": "黑化、失去双亲",
  "evidence": { "path": "正文章节/第四章.md", "quote": "他把旧信折好，收进火盆。" },
  "content": "## 性格特点\n冷硬\n\n## 愿景\n..."
}
```

创建只新增阶段，不覆盖历史。Agent 建卡使用 `save_character_card`，交稿后的角色变化使用 `propose_character_change`。后者展示本章适用的原卡、证据段和建议新阶段。作者点击接受时，后端在同一次保存操作中复核证据段与适用角色卡。角色卡面板也可以直接创建阶段。变化阶段保存的证据会随历史卡返回。

## 读取阶段

`POST /api/workspaces/:workspaceId/character-cards/read`

请求体为 `{ "path": "角色卡/林舟/000004-...md" }`，响应包含 `character`、`chapter`、`note`、`content` 和 `version`。

接口错误包括 `INVALID_REQUEST`、`CHARACTER_CARD_NOT_FOUND`、`WORKSPACE_NOT_FOUND` 和工作区文件读写错误。章节筛选使用 URL 字符串参数，必须是 1 到 999999 的正整数。同章内以创建时间决定最新阶段。提供 evidence 的创建请求要求对应章节已经保存，引文须唯一定位一个 Markdown 自然段（以空行分隔）。

聊天工具返回 `needs_review` 时附最新正文，Agent 重新判断并在有依据时再次发起确认。只改其他段落时原确认仍可生效。等待期间适用角色卡变更会返回 `REFERENCE_CONFLICT`。重写候选须先完成正文审阅并有采纳的改动，再回到同一本书的原聊天继续复核。

## 交稿后提醒建卡

在小说聊天发送消息或使用试验台“提醒为关键人物建卡”示例。工具 `suggest_character_card` 以人物称呼、章节号、建卡理由和章节原句查验正式稿，疑似别称可附 `possibleIdentity`。已有当章适用卡返回 `already_exists`，已有后期卡则提示补早期阶段。工具首次询问时忽略提前传入的 `content`。作者在 `user_answer_required` 中选择建卡后返回 `draft_requested`，Agent 再传同一证据和五栏 `content` 请求保存。跳过的决定按书籍、人物和证据段保留；确认时证据变化返回 `needs_review`。沿用小说聊天的停止接口和结束事件。
