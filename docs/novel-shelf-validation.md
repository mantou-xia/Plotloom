# 小说书架验收

2026-11-22

小说管理页按「置顶小说」和「全部小说」展示封面。置顶作品同时出现在两处，点击封面进入单本小说工作台。两个区使用同一排序条件，默认最近创建，可切换最早创建或书名。排序偏好保存在当前浏览器。

每本书按稳定 ID 获得一个默认封面。封面按钮可预览并应用任一内置封面，置顶和封面通过公开工作区接口保存到小说登记信息。历史登记缺少相关字段时，按未置顶和默认封面展示。

## 验证结果

- Edge 使用四本隔离测试小说，验证置顶与取消置顶、两个区同步显示、快速切换封面选项、保存时原卡片尺寸及位置稳定、刷新后恢复设置、本地排序和打开单本工作台。检查 1440 像素和 540 像素视口。
- 接口试验台通过实际请求验证保存置顶和封面返回 200，响应字段检查通过。提交未知封面返回 400 `INVALID_REQUEST`。
- 独立 HTTP 与试验台目录回归共 20 项通过，包含跨进程重启、局部更新、非法输入和未知工作区。全仓类型检查、产品 Web 与接口试验台构建通过。
- 封面和操作控件使用固定尺寸，保存反馈复用浮动提示。后端独立校验封面 ID，复用工作区串行持久化。页面使用现有布局、按钮、选择器与弹窗。

## 封面素材

以下照片随应用打包为裁切后的 WebP，使用 [Unsplash License](https://unsplash.com/license)。

- 雾山，Roberto Shumski，[Misty forest valley with mountains in background](https://unsplash.com/photos/misty-forest-valley-with-mountains-in-background-oYEGPZebzGw)
- 沙丘，Dan Meyers，[Brown desert](https://unsplash.com/photos/brown-desert-g-FQ32ZDESk)
- 潮汐，Griffin Wooldridge，[Aerial view of ocean waves](https://unsplash.com/photos/aerial-view-of-ocean-waves-MPyd0skrRtQ)
- 星河，Luca Calderone，[The night sky is filled with stars and the milky](https://unsplash.com/photos/the-night-sky-is-filled-with-stars-and-the-milky-xp7IByu7OvA)
