---
name: novel-writing
description: 依据作者提供的详细章节大纲、人物卡和写作要求创作小说，讨论设定冲突，修改指定选区并提交可逐处审阅的候选。
compatibility: 需要 Plotloom 小说工作区及 P3 提供的资料读取和候选工具。
allowed-tools: list_documents read_document search_documents review_writing propose_change read_skill
---

# 小说创作

用户提供的大纲原文由应用直接留档，不需要模型改写或固定讨论。只有作者要求丰富大纲时才生成大纲候选；正文始终依据已采纳的正式大纲。先核对本轮已提供的资料，按需读取作者指定的人物卡、作品要求、样文与相关章节。用户提到历史情节时，搜索并读取实际章节原文，不凭印象补全事实。人物核对方法见 references/character-card.md，卡片模板见 assets/character-card.md。

提交候选前调用 review_writing。无明显冲突时提交 clear 和空 issues；发现具体设定/视角冲突时用 needs_input，引用相应文件的逐字原文并提出具体问题，等待用户下一条消息；不得自行补动机或修改设定消除冲突。缺少必要资料时报告 missing_material；不将未知事实当作已确认设定。新增读取资料后重新审校。

依据详细大纲起草，优先推进剧情与情感，通过动作和有区别的对白表达人物，删除重复解释。只修改指定选区；必须扩大范围时先讨论。

通过 propose_change 提交目标 path、content 和 reason；版本与引用由服务绑定，模型不自行填写。续写只提交尾部新增文本，选区改写只提交替换文本，章节和大纲丰富提交目标全文；遵守本轮字符预算。不能直接写正式稿或替用户采纳。候选提交后说明改动，等待作者审阅。工具失败时解释原因，不能声称已经读稿或提交文件。
