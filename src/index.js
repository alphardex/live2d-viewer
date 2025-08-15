import Live2DViewer from "./live2d-viewer.js";

// 自动注册自定义元素（如果还没有注册的话）
if (!customElements.get("live2d-viewer")) {
  customElements.define("live2d-viewer", Live2DViewer);
}

export default Live2DViewer;
export { Live2DViewer };