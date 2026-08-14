# 液态玻璃组件库（Liquid Glass UI Kit）

基于 **圆角矩形 SDF 边缘折射** 算法的液态玻璃（Liquid Glass）交互组件库，纯 HTML / CSS / JS 单文件实现，无任何第三方依赖。视觉效果接近 iOS 26 液态玻璃：只让玻璃**边缘发生弯曲**，内部几乎不变形，符合光学折射规律。

## 特性

- **真实边缘折射**：逐像素计算圆角矩形符号距离场（SDF），边缘平滑过渡并径向反向位移，叠加 swirl/flow 液化噪声，生成 Canvas 位移贴图，经 SVG `feImage + feDisplacementMap` 作用于 `backdrop-filter`
- **视口钳制保护**：顶栏、浮动面板等贴边元素自动把取样范围钳制在网页内，避免折射进浏览器 UI；兼容 `visualViewport` 捏合缩放
- **组件完备**：顶栏 / 侧边栏 / 统计卡片 / 按钮（主要、默认、危险、幽灵）/ 图标按钮 / 分段选择器 / 开关 / 滑块 / 下拉 / 标签 / 菜单 / 头像 / 浮动调节面板
- **实时参数调节**：浮动面板 7 个滑块（圆角、模糊、折射强度、液化程度、亮度、高光边缘、滑块放大）实时联动着色器，无需刷新
- **果冻交互动效**：分段指示器、开关圆钮、滑块滑块使用弹跳曲线 `cubic-bezier(0.34, 1.56, 0.64, 1)` 放大回弹
- **性能优化**：位移贴图按尺寸/参数缓存（`filterCache`），仅在尺寸变化时重新生成，日常滚动零额外开销
- **自适应**：`ResizeObserver` 监听尺寸变化、`MutationObserver` 自动绑定新增元素，任意圆角自适应

## 快速开始

```bash
# 直接浏览器打开主文件即可（无需构建、无需服务器）
start Liquid_Glass index.html
```

> 页面背景引用同目录 `bg.png`（缺失时自动回退为深色渐变）。

## 文件说明

| 文件 | 说明 |
|---|---|
| `Liquid-Glass index.html` | 主文件：完整组件库 + 参数面板（约 84KB，单文件） |
| `liquid_glass_style.md` | 样式规范：液态玻璃实现方法、各控件实现规范 |
| `Thanks.txt` | 鸣谢：着色器思路来源 |


## 交互说明

| 控件 | 行为 |
|---|---|
| 分段选择器 | 点击其他项：果冻放大 + 液态玻璃 → 滑动到位 → 恢复白色方块；按住滑块拖动：跟手移动、可随鼠标小幅上下偏移（±10px），松手吸附最近项 |
| 开关 | 切换时圆钮膨胀超调（中程放大 1.15 → 终点 1.2）并进入液态玻璃态 |
| 滑块 | 拖动时滑块果冻放大（倍数绑定"滑块放大"参数），松手回弹 |
| 按钮 / 图标按钮 / 菜单 / 头像 | 按下进入液态玻璃态，松手恢复纯色/玻璃底 |

## 参数面板

| 参数 | 作用域 | 默认 |
|---|---|---|
| 圆角 | 容器圆角 `--radius` | 24px |
| 模糊 | 背景模糊 `--blur` | 16px |
| 折射强度 | 边缘折射幅度 | 1.2 |
| 液化程度 | swirl/flow 噪声强度 | 0.6 |
| 亮度 | 背景亮度 `--bright` | 1.1 |
| 高光边缘 | 内描边宽度 `--edge-width` | 1px |
| 滑块放大 | 果冻动画倍数 `--thumb-scale` | 1.3x |

## 技术原理

1. **位移贴图生成**：对元素每个像素计算圆角矩形 SDF → `smoothStep` 在边缘过渡带产生渐变权重 → 位移方向取径向反方向、幅度 = 权重 × 折射强度，再叠加液化噪声 → 归一化编码进 R/G 通道 → `canvas.toDataURL()`
2. **动态滤镜注入**：为每个玻璃元素创建独立 SVG `<filter>`（`filterUnits="userSpaceOnUse"`），`feImage` 引用贴图 dataURL，`feDisplacementMap` 的 `scale` 设为实际最大位移量
3. **backdrop-filter 链**：`blur(var(--blur)) saturate(180%) brightness(var(--bright)) url(#lg-<id>)`
4. **动态更新**：`ResizeObserver` + `visualViewport` 缩放监听 + 防抖 `refreshAllFilters()`

## 浏览器兼容性

- **Chrome / Edge**：完整效果（注意 backdrop-filter 中仅支持单个 `url()`）
- **Safari**：对 `backdrop-filter` + `feImage` dataURL 支持可能异常，需降级为纯 `blur + saturate` 玻璃
- 保留 `prefers-reduced-motion` 降级入口(未测试)
- **Firefox**:大部分效果不支持，仅磨砂生效

## 鸣谢

着色器基础思路来自 [sunai.net 论坛讨论](https://www.sunai.net/t/topic/1381)，作者 **Wood Chen**（详见 [Thanks.txt](./Thanks.txt)）。
