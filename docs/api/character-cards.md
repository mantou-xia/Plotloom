# 五栏角色卡接口

角色卡阶段是工作区内的 Markdown 文件，路径位于 `角色卡/<角色名>/`。文件包含不可见的阶段标记，记录开始适用的章节号和作者备注。正文仍可由外部编辑器直接修改，版本由工作区接口计算。

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
  "content": "## 性格特点\n冷硬\n\n## 愿景\n..."
}
```

创建只新增阶段，不覆盖历史。Agent 使用 `save_character_card` 整理作者已确认的信息，展示内容并等待确认后保存。角色卡面板也可以直接创建阶段。

## 读取阶段

`POST /api/workspaces/:workspaceId/character-cards/read`

请求体为 `{ "path": "角色卡/林舟/000004-...md" }`，响应包含 `character`、`chapter`、`note`、`content` 和 `version`。

接口错误包括 `INVALID_REQUEST`、`CHARACTER_CARD_NOT_FOUND`、`WORKSPACE_NOT_FOUND` 和工作区文件读写错误。章节筛选使用 URL 字符串参数，必须是 1 到 999999 的正整数。

