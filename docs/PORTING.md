# Liquid Glass：AI 接手与移植技术说明

本文供需要复用、改造或移植到 React / Vue 等环境的开发者和 AI 使用。描述的是当前代码，不是尚未实现的组件 SDK。阅读顺序：先看本文的边界和接口，再读相关源码，最后运行测试与浏览器验收。

## 1. 项目目标与必须保留的行为

- 参数滑块为白色平面胶囊，填充条为蓝色；激活时显示透明液态玻璃，结束后恢复白色。
- 胶囊左右端帽和上下边缘均产生对称折射，中间区域尽量不变形；不是整体向某个方向平移背景。
- 参数滑块、开关圆钮、分段指示器的透镜采样下方已绘制的背景、面板、轨道与文字。
- 分段选择器采用可打断弹簧动画，拖动不跳到指针中心，释放后吸附；连续点击能从当前状态转向。
- 控制面板能收为可拖动悬浮球，以水滴拉伸/回弹动画展开；参数节点保持挂载。
- 背景压暗只改变背景遮罩，玻璃自然采样压暗后的背景，不做亮度补偿或挖洞保护。
- 标题栏及其内部控件使用大面板引擎，不被小控件引擎接管。

这是一种基于位移图的视觉模拟，不是物理光线追踪。`backdrop-filter` 只能处理已绘制的合成画面，不能透视不透明物体后面的隐藏内容。

## 2. 模块边界

| 文件 | 当前职责 | 移植时注意 |
| --- | --- | --- |
| `js/liquid-glass-engine.js` | 大面板 SDF/液化位移图、SVG 缓存、兼容入口 | 不将其参数直接覆盖到小控件 |
| `js/small-liquid-glass-engine.js` | 小控件位移图、每个活跃元素的 SVG、页面级透镜 | 与位置、样式、生命周期关联最强 |
| `js/liquid-glass-controls.js` | 参数滑块事件、ARIA、全局参数回调 | 通过 `data-callback` 查找 `window` 函数 |
| `js/segmented-control.js` | 分段弹簧状态、指针捕获、键盘、选择事件 | 位置/宽度写入 DOM，不由框架重复驱动 |
| `js/liquid-glass-buttons.js` | 按钮/下拉委托事件、开关圆钮 | 加载后自动绑定，不是导出的组件工厂 |
| `js/floating-panel.js` | 面板收展、拖动、焦点转移、WAAPI | 自动查找固定 ID 并创建按钮 |
| `js/background-dimmer.js` | `.bg` 的遮罩透明度 | 与玻璃滤镜参数独立 |
| `liquid-glass-slider.css` | 滑块、开关圆钮、分段覆盖样式与透镜层 | 缺少此文件可能有滤镜但看不见正确外观 |
| `floating-panel.css` | 面板/悬浮球状态与内容动画 | 与 `data-collapsed` / `data-morphing` 配套 |

主页面还有大面板参数回调和尺寸/视口刷新代码。仅复制共享引擎，并不会自动获得这些页面级绑定。

## 3. 加载与初始化

当前为 IIFE + `window` 全局接口，未使用 ESM、TypeScript 或构建工具。脚本在页面主体 DOM 之后依次加载：

共享运行时脚本统一存放在根目录的 `js/`。以下引用以根目录的 HTML 为基准；`examples/` 中的页面使用 `../js/`。

```html
<link rel="stylesheet" href="liquid-glass-slider.css">
<link rel="stylesheet" href="floating-panel.css">
<!-- 页面与组件 DOM 必须先存在 -->
<script src="js/small-liquid-glass-engine.js"></script>
<script src="js/liquid-glass-engine.js"></script>
<script src="js/background-dimmer.js"></script>
<script src="js/liquid-glass-controls.js"></script>
<script src="js/segmented-control.js"></script>
<script src="js/liquid-glass-buttons.js"></script>
<script src="js/floating-panel.js"></script>
```

随后主页面调用 `LiquidGlassControls.initSlider`、`SegmentedControl.init` 和大面板参数初始化。两个控制器不是通用的 DOM 自动发现服务。

`js/background-dimmer.js` 自动设置 45% 压暗；按钮脚本自动绑定已有开关并安装文档事件；面板脚本自动查找 `#floatingPanel`。这些脚本不能直接在服务端执行，也不应在每次组件渲染时重新加载。

## 4. 公开接口：哪些真实存在

### 大面板引擎

```js
LiquidGlass.apply(element, enabled, rectScale);
LiquidGlass.refresh();
LiquidGlass.setParameters({ refractionStrength: 1.2, distortion: 0.6 });

// 现有页面依赖的兼容全局入口
applyLiquidGlassEffect(element, enabled, rectScale);
updateElementFilter(element);
refreshAllFilters();
```

- `setParameters` 只更新大引擎内部参数，需再调用 `refresh()` 才刷新现有元素。
- `refresh()` 读取 `body.dataset.liquidGlassTargets` 选择器，缺省为 `.lg, .floating-panel`。
- `apply` / `updateElementFilter` 会根据 `SmallLiquidGlass.isControl` 分流到小引擎；小引擎不使用 `rectScale` 参数。
- `updateElementFilter` 遇到 `data-morphing` 时跳过，避免面板变形时不断生成大贴图。
- 大面板缓存目标为 96 项；仍被使用的滤镜不会强制删除，因此不是绝对内存上限。

### 小控件引擎

```js
SmallLiquidGlass.isControl(element);
SmallLiquidGlass.apply(element, true);   // 进入激活态
SmallLiquidGlass.update(element);       // 仅更新已激活元素
SmallLiquidGlass.refresh();             // 更新所有已激活元素
SmallLiquidGlass.setParameters({ refractionStrength: 3 });
SmallLiquidGlass.setMix(element, 1);     // 1=透明玻璃，0=白色表面
SmallLiquidGlass.apply(element, false);  // 移除本元素透镜与滤镜
```

- `setParameters` 接受有限数字，将强度限制为 0–6，并立即刷新活跃元素。
- `setMix` 只改变已存在的页面级透镜底色，不调整位移强度；内联按钮没有此混合表面。
- `update` 不会激活未启用的元素；不要靠它启动效果。
- `buildMap`、活跃元素 Map、SVG 管理对象都是内部实现，不是可导入 API。测试中的临时导出只发生在隔离 VM 内。
- 没有公开的全局 `destroy()`。

### 控制器

```js
LiquidGlassControls.initSlider(sliderElement);
SegmentedControl.init(segmentedElement);
BackgroundDimmer.set(45); // 百分比 0–100
```

分段根节点会发出冒泡的 `segmentchange` 事件，`event.detail.value` 来自选项的 `data-seg` 或文本。当前控制器没有公开的受控选中值 setter，不能假设存在 `setValue()` / `select()` / `destroy()`。

## 5. DOM 与 CSS 契约

### 参数滑块

```html
<div class="slider" data-min="0" data-max="100" data-value="45"
     data-step="1" data-callback="onExampleValue" aria-label="示例数值">
  <div class="slider-track"><div class="slider-fill"></div></div>
  <div class="slider-thumb"></div>
</div>
<script>
  window.onExampleValue = (value, slider) => { /* 更新业务状态 */ };
  LiquidGlassControls.initSlider(document.querySelector('.slider'));
</script>
```

`.slider` 必须有可测量的宽度，并作为相对定位容器。控制器操作圆钮 `left`、填充条 `width`、`data-value` 和 ARIA 数值。现有数值解析/步进针对示例范围实现；非零起点、整步长大于 1、缺省值等泛化需求应另补验证。

### 分段指示器

```html
<div class="segmented" aria-label="时间范围">
  <div class="seg-indicator"></div>
  <button class="seg-item active" data-seg="day">日</button>
  <button class="seg-item" data-seg="week">周</button>
</div>
```

根节点必须是相对定位容器。控制器读取选项的 `offsetLeft` / `offsetWidth`，设置指示器 `left` / `width` / `transform`。不要让 CSS transition 或框架动画同时驱动这些属性。

`data-segmented-ready` 是当前的重复初始化保护。它不是销毁机制；复制 DOM、替换选项或框架重挂载时要设计明确的初始化与清理流程。

### 开关与面板

开关以 `.switch` 标识，`active` 类表示开启，`aria-checked` 同步状态。按钮脚本移除旧的 `onclick`，插入 `.switch-thumb`，并通过点击处理切换。不要再给同一开关绑定旧版 `toggleSwitch`。

面板脚本依赖 `#floatingPanel`、内部 `.panel-header` 与 `.panel-body`，自动创建 `.panel-toggle` / `.panel-orb`。展开状态由 `data-collapsed` 表示，动画中有 `data-morphing`；收起时 header/body 设置 `inert`，参数 DOM 仍然存在。

## 6. 渲染链与坐标系：移植最容易出错的地方

位移编码使用 R 表示 X、G 表示 Y，B 不参与，A 为不透明；通道约 0.5 表示零位移。SVG `feDisplacementMap` 的 scale 必须与编码时的位移范围配对。强度为 0 时必须确实关闭位移。

小引擎使用平滑强度曲线，避免高值进入“调了却没变化”的硬上限。胶囊使用像素中心采样，使左右、上下对称。普通按钮按圆角矩形边界法线计算位移，不直接套用从中心出发的径向向量。

| 渲染方式 | 元素 | 尺寸来源 | 定位/过滤坐标 |
| --- | --- | --- | --- |
| 页面级透镜 | `.slider-thumb`、`.switch-thumb`、`.seg-indicator` | `getBoundingClientRect()` | fixed 屏幕坐标；透镜自身不重复套用源元素 transform |
| 内联小滤镜 | 普通按钮等 | `offsetWidth` / `offsetHeight` | 元素局部 CSS 像素；滤镜先于 CSS transform |

当前实现没有按 DPR 再乘一遍 Canvas 尺寸。高分辨率贴图优化必须同时处理图像尺寸、SVG 图像映射和 scale，不能只把一个尺寸乘 `devicePixelRatio`。

## 7. 为什么需要页面级透镜

将小滑块直接放在带滤镜的玻璃父元素里，会受到父级背景采样边界影响。当前小引擎为三个滑块类元素执行以下生命周期：

```text
激活源控件
  → 添加 glass-active / small-glass-active
  → 创建 body 下的 .small-glass-lens 与独立 SVG filter
  → 源控件添加 small-glass-source（opacity: 0，保留几何与交互）
  → 每帧跟随源控件屏幕矩形，尺寸/强度改变才重建贴图
  → 结束时删除透镜与 filter，解除尺寸观察，恢复源控件
```

透镜使用 `pointer-events: none` 和 `aria-hidden`，实际事件与焦点保留在源控件上。当前透镜 `z-index` 为 10000；这是示例的层级约定，不是可用于所有产品的通用值。

移植时应指定不受祖先 `filter`、`transform` 或 `opacity` 隔离的 portal 宿主，并与产品的弹窗/菜单层级协调。不能简单把透镜挂回组件内部；也不能通过隐藏或删除源节点破坏焦点与几何测量。

## 8. 动画与资源管理

分段控制器维护当前位置、宽度、缩放、Y 偏移、白色/透明混合值及对应速度。它使用 RAF 积分弹簧；新输入更新目标，不重置当前位置。当前参数为位置/宽度/混合弹簧刚度 400、阻尼 38，缩放为 320 / 27；时间步上限 32ms，并拆成不超过约 8ms 的子步。

面板通过 Web Animations API 在同一个表面上变形，开关圆钮通过 CSS transform 过渡。面板变形过程中暂时禁用其 SVG 位移，只保留基础玻璃链，结束后刷新，减少大量大尺寸贴图生成。

### 当前已经清理的资源

- 小控件结束激活：移除该控件的 SVG filter/透镜，解除其 ResizeObserver，必要时停止透镜跟随 RAF。
- 分段运动收敛：停止动画 RAF并结束透镜；拖动取消、指针捕获丢失、失焦会处理交互状态。
- 面板参数节点不因收起而卸载，避免重建滑块和丢失设置。

### 移植时必须补齐，当前没有统一实现

- 控制器返回可调用的 disposer；移除全局/文档事件、observer、定时器、RAF 和未完成的 WAAPI。
- 单例引擎整体销毁，以及多个实例/多个应用之间的 SVG ID 隔离。
- 开关/按钮脚本和面板脚本的显式初始化与卸载，避免重复插入圆钮或按钮。
- 源控件移出 DOM 或重归类前主动结束效果；不要仅依赖下一帧发现断开。
- 大面板缓存的引用生命周期与卸载后清理。

现有 `initSlider()` 不防重复绑定；`SegmentedControl.init()` 的简单标记也不能解决框架 StrictMode/HMR 的完整生命周期问题。

## 9. 建议的 React / Vue 移植顺序（不是现有 API）

1. 先单独移植 `examples/segmented-control.html` 或一只参数滑块，验证 SVG URL 滤镜在目标环境能显示。
2. 将引擎改为客户端 ESM 工厂，保留算法与双引擎边界，按应用实例管理 SVG/portal 宿主。
3. 让控制器显式接收根元素与回调，返回 `destroy()`；把自动执行的按钮和面板脚本也改为工厂。
4. 在 React 的客户端布局 effect 或 Vue `onMounted` 中初始化；在 effect cleanup / `onBeforeUnmount` 中销毁。SSR 不能在模块顶层访问 `window` / `document`。
5. 通过 ref/事件桥同步业务值，替换 `window[data-callback]`。约定由控制器还是框架驱动 `left` / `width` / `transform`，不要双重写入。
6. 将 portal 样式作为全局样式引入；CSS Modules/scoped CSS 的选择器必须能命中被移出组件子树的透镜。
7. 引擎名称、脚本加载顺序等契约改变后，更新两个展示页与示例，再做视觉验收。

下面只是目标适配器的接口设计示意，仓库当前**不提供**这些函数：

```text
createSmallGlass({ portalHost }) → { apply, update, setParameters, destroy }
mountSlider(root, { engine, onChange }) → { setValue, destroy }
mountSegmented(root, { engine, onChange }) → { select, destroy }
mountFloatingPanel(root, options) → { collapse, expand, destroy }
```

## 10. 常见错误与现有限制

| 现象 | 优先检查 |
| --- | --- |
| 有透明底色但没有折射 | SVG 引用/ID 是否存在；实际 backdrop-filter 是否包含 URL；数据图是否加载；浏览器是否支持该组合 |
| 只有轨道，没有背景/文字形变 | 透镜是否仍在父级 backdrop root 中；实际绘制顺序；背景本来是否已被父面板模糊 |
| 按住后白块仍挡住下层 | `.small-glass-source` 样式是否加载并生效；不要只生成透镜而不隐藏源表面 |
| 折射偏一边或圆钮位置漂移 | CSS 局部尺寸与屏幕尺寸是否混用；缩放/DPR 是否重复计算；像素中心是否对称 |
| 指示器拖动突跳 | 是否用放大后的宽度算布局；是否丢掉按下偏移；旧 CSS transition 是否仍介入 |
| 调大强度没变化 | 是否调错引擎；是否进入硬上限；活跃 filter 是否更新；是否被白色表面遮住 |
| 悬浮球拖完自动展开 | 点击抑制、指针捕获结束、取消路径是否保留 |
| 热更新后多层透镜或重复切换 | 是否重复执行自动绑定脚本；是否缺失 disposer |

当前没有完整的跨浏览器视觉验证、旋转/倾斜元素几何支持、复杂祖先裁剪/遮挡同步、多实例 ID 管理或通用销毁接口。页面级透镜按矩形与统一圆角跟随，不会自动复制祖先的复杂 `clip-path`。移动端缩放、滚动容器裁剪、弹窗层级等需要在目标产品实测。

不要把视觉“更像玻璃”作为删除键盘支持、取消清理或减少动态效果分支的理由。浏览器不支持 SVG 背景折射时，应设计明确的纯色/磨砂退化，并如实告知差异，而不是声称已获得相同效果。

## 11. 验证与移植交接清单

逻辑回归（Node.js 22+，无 npm 安装步骤）：

```sh
node tests/small-engine.test.cjs
node tests/segmented-control.test.cjs
node tests/panel-controls.test.cjs
git diff --check
```

这些测试采用隔离 VM 和模拟 DOM，验证路由、几何、数值对称性、资源回收及交互状态，不能验证实际 SVG 合成与像素输出。

真实浏览器至少检查：

- 同背景/同压暗值下，静止白色与激活透明是否符合约定。
- 让高对比背景、细线和文字经过透镜，确认上下/左右形变，而不是只看到描边。
- 拖动、连续点击、改变控件尺寸/强度、页面滚动时透镜的位置与形状。
- 点击/键盘激活/触摸取消、窗口失焦、快速重复输入、减少动态效果模式。
- 面板收展、拖动球而不展开、参数保留、窄屏可达性与焦点转移。
- 反复挂载/卸载后 observer/监听器/RAF/透镜/SVG 数量是否回到预期。
- 标题栏不进入小控件引擎；两个引擎调参互不串扰；弹窗不被透镜错误覆盖。

交付时列出：目标框架与浏览器、实际改动的 API/DOM/CSS 契约、已运行的逻辑测试、已完成的视觉验证，以及仍未支持的场景。不要将“测试通过”简写为“所有浏览器效果一致”。
