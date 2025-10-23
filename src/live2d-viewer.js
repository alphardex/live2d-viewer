import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display";

// expose PIXI to window so that this plugin is able to
// reference window.PIXI.Ticker to automatically update Live2D models
window.PIXI = PIXI;

class Live2DViewer extends HTMLElement {
  constructor() {
    super();
    this.app = null;
    this.model = null;
    this.attachShadow({ mode: "open" });
  }

  static get observedAttributes() {
    return ["src", "motion", "scale", "auto-interact", "x", "y"];
  }

  connectedCallback() {
    this.render();
  }

  async render() {
    // 清理之前的内容
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.shadowRoot.innerHTML = "";

    const src = this.getAttribute("src");
    const motion = this.getAttribute("motion") || "idle";
    const scale = parseFloat(this.getAttribute("scale")) || 0.15;
    const autoInteract = this.getAttribute("auto-interact") === "true";
    const x = parseFloat(this.getAttribute("x")) || 0;
    const y = parseFloat(this.getAttribute("y")) || 0;
    this.x = x;
    this.y = y;

    if (!src) {
      this.shadowRoot.innerHTML =
        '<div style="color: red;">Error: src attribute is required</div>';
      return;
    }

    // 创建容器
    const container = document.createElement("div");
    this.container = container;
    container.style.cssText = `
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
    `;
    this.shadowRoot.appendChild(container);

    await this.renderLive2D({ src, motion, scale, autoInteract });

    // 监听窗口大小变化
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(this);
  }

  async renderLive2D({
    src,
    motion = this.getAttribute("motion"),
    scale = this.getAttribute("scale") || 0.15,
    autoInteract = this.getAttribute("auto-interact") === "true",
  }) {
    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }
    // 清理model相关引用
    this.model = null;
    this.modelContainer = null;

    try {
      // 创建PIXI应用，使用独立的canvas和WebGL上下文
      this.app = new PIXI.Application({
        width: this.clientWidth || 400,
        height: this.clientHeight || 400,
        backgroundColor: 0x000000,
        backgroundAlpha: 0,
        antialias: true,
        powerPreference: "high-performance",
      });
      this.container.appendChild(this.app.view);

      // 加载Live2D模型，添加更好的资源管理
      this.model = await Live2DModel.from(src, {
        autoInteract,
      });

      if (this.model) {
        // 创建容器来包装model
        this.modelContainer = new PIXI.Container();
        this.modelContainer.addChild(this.model);
        this.app.stage.addChild(this.modelContainer);

        // 设置动画
        if (motion && this.model.internalModel) {
          try {
            this.model.motion(motion);
          } catch (error) {
            console.warn(
              `Motion '${motion}' not found or failed to play:`,
              error
            );
            // 尝试播放默认动画
            try {
              this.model.motion("idle");
            } catch (fallbackError) {
              console.warn("Failed to play fallback motion:", fallbackError);
            }
          }
        }

        // 设置缩放和位置
        this.modelContainer.scale.set(scale, scale);
        this.centerModel();
      }
    } catch (error) {
      console.error("Failed to load Live2D model:", error);
      this.shadowRoot.innerHTML = `<div style="color: red;">Error loading Live2D model: ${error.message}</div>`;
    }
  }

  centerModel() {
    if (!this.modelContainer || !this.app || !this.model) return;

    this.modelContainer.position.set(
      (this.app.screen.width - this.modelContainer.width) * 0.5,
      (this.app.screen.height - this.modelContainer.height) * 0.5
    );
    this.model.position.set(
      this.clientWidth * this.x,
      this.clientHeight * this.y
    );
  }

  handleResize() {
    if (!this.app || !this.model || !this.modelContainer) return;

    this.app.renderer.resize(this.clientWidth || 400, this.clientHeight || 400);
    this.centerModel();
  }

  disconnectedCallback() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.app) {
      this.app.destroy(true);
    }
  }

  // 公共方法
  setMotion(motionName) {
    if (this.model && this.model.internalModel) {
      try {
        this.model.motion(motionName);
      } catch (error) {
        console.warn(`Failed to set motion '${motionName}':`, error);
      }
    }
  }

  getMotions() {
    if (this.model && this.model.internalModel) {
      try {
        // 尝试获取可用的动作列表
        const motionManager = this.model.internalModel.motionManager;
        if (motionManager && motionManager.definitions) {
          return Object.keys(motionManager.definitions);
        }
      } catch (error) {
        console.warn("Failed to get motions:", error);
      }
    }
    return [];
  }

  setScale(scale) {
    if (this.modelContainer && this.app && this.model) {
      this.modelContainer.scale.set(scale, scale);
      this.centerModel();
    }
  }

  // 触发表情
  setExpression(expressionName) {
    if (this.model && this.model.internalModel) {
      try {
        this.model.expression(expressionName);
      } catch (error) {
        console.warn(`Failed to set expression '${expressionName}':`, error);
      }
    }
  }

  // 获取可用表情列表
  getExpressions() {
    if (this.model && this.model.internalModel) {
      try {
        const expressionManager = this.model.internalModel.motionManager.expressionManager;
        if (expressionManager && expressionManager.definitions) {
          return expressionManager.definitions.map((item) => item.name);
        }
      } catch (error) {
        console.warn("Failed to get expressions:", error);
      }
    }
    return [];
  }
}

// 注册自定义元素
customElements.define("live2d-viewer", Live2DViewer);

export default Live2DViewer;
export { Live2DViewer };
