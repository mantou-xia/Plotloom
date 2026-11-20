# 来源

参考组件：LeiBox Thinking Step Particle Morph。

- 文档：https://leibox.pantoria.cn/docs/animations/thinking-particles
- React 源码包：https://leibox.pantoria.cn/ai/packages/thinking-particles/react.json
- 设计参考：Shridhar，https://x.com/shridharathi/status/2113255894423158914/video/1
- 获取日期：2026-11-19。

`original/` 保存本站提供的完整源码及内含声明，不作为运行入口。目录未授予统一许可证，保留源文件中的许可及设计署名。

`particle-renderer.js` 提取原版实体几何、深度光栅、Bayer 黑白网点与粒子过渡；去除自动步骤剧情，由调用方驱动形态。增加书页、笔和文件夹几何，并使快速切换从实际绘制位置继续。组件不使用原版演示回答、计时或整页结构。

现使用粒子绘制；增加各形态持续运动与旋转聚散球体，均属于本项目扩展。

2026-11-20 参考原版九宫格脉冲图标与水平拖动旋转、方向键及 Home 交互；按本组件缩放换算拖动距离，清理指针监听。最终回答阶段隐藏整个视觉头部，内容折叠由调用方实现，不沿用原版整体过程展开逻辑。
