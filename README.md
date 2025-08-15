# Live2D Viewer

一个用于在网页中显示 Live2D 动画的自定义 HTML 元素，基于 PIXI.js 和 pixi-live2d-display 构建。

## 依赖

确保你的项目中已安装以下依赖：

```bash
npm install pixi.js@7.4.3 pixi-live2d-display@0.5.0-beta
```

## live2D运行时

还需要额外引入live2D的运行时文件。

```html
<!-- Cubism 2.1 -->
<script src="https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js"></script>
<!-- Cubism 4 -->
<script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"></script>
```

## 安装

```bash
npm install @alphardex/live2d-viewer
```

## 在线体验

地址：https://live2d-viewer-alphardex.netlify.app/

## 使用方法

### 1. 导入组件

```javascript
import "@alphardex/live2d-viewer";
```

### 2. 在 HTML 中使用

```html
<live2d-viewer
  src="/path/to/your/model.model3.json"
  motion="idle"
>
</live2d-viewer>
```

### 3. 通过 JavaScript 控制

```javascript
const viewer = document.querySelector("live2d-viewer");

// 设置动作
viewer.setMotion("happy");

// 设置表情
viewer.setExpression("smile");

// 设置缩放
viewer.setScale(0.5);

// 获取可用动作列表
const motions = viewer.getMotions();
console.log("Available motions:", motions);

// 获取可用表情列表
const expressions = viewer.getExpressions();
console.log("Available expressions:", expressions);
```

## 属性

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `src` | string | - | Live2D 模型文件路径（.model3.json） |
| `motion` | string | "idle" | 初始动作名称 |
| `scale` | number | 0.15 | 模型缩放比例 |
| `auto-interact` | boolean | true | 是否启用自动交互 |

## 方法

### setMotion(motionName)
设置模型动作。

**参数：**
- `motionName` (string): 动作名称

### setExpression(expressionName)
设置模型表情。

**参数：**
- `expressionName` (string): 表情名称

### setScale(scale)
设置模型缩放。

**参数：**
- `scale` (number): 缩放比例

### getMotions()
获取可用动作列表。

**返回：**
- `Array<string>`: 动作名称数组

### getExpressions()
获取可用表情列表。

**返回：**
- `Array<string>`: 表情名称数组

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
