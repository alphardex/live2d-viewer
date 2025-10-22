import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display";

// 全局 Pixi 应用管理器
class Live2DGlobalManager {
  static instance = null;
  static app = null;
  static stage = null;
  static models = new Map();
  static containers = new Map();
  static isInitialized = false;
  static initializationPromise = null;

  // 初始化全局 Pixi 应用
  static async initialize() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.isInitialized) {
      return Promise.resolve();
    }

    this.initializationPromise = new Promise((resolve, reject) => {
      try {
        this.app = new PIXI.Application({
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: 0x000000,
          backgroundAlpha: 0,
          antialias: true,
          powerPreference: "high-performance",
          resizeTo: window,
        });

        this.app.view.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: -1;
        `;

        if (!document.body.contains(this.app.view)) {
          document.body.appendChild(this.app.view);
        }

        this.stage = this.app.stage;
        this.isInitialized = true;
        this.initializationPromise = null;

        // 监听窗口大小变化
        this.setupResizeHandler();

        console.log('Global Pixi Application initialized');
        resolve();
      } catch (error) {
        this.initializationPromise = null;
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  // 设置窗口大小变化监听
  static setupResizeHandler() {
    const handleResize = () => {
      // 更新所有模型的缩放和位置
      this.models.forEach((model, element) => {
        if (element.handleWindowResize) {
          element.handleWindowResize();
        }
      });
    };

    // 使用防抖避免频繁触发
    const debouncedResize = this.debounce(handleResize, 100);
    window.addEventListener('resize', debouncedResize);
  }

  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // 注册模型
  static registerModel(element, model, container) {
    if (this.models.has(element)) {
      console.warn('Model already registered for element:', element);
      return;
    }

    this.models.set(element, model);
    this.containers.set(element, container);

    if (!container.parent) {
      this.stage.addChild(container);
    }

    console.log(`Model registered for element:`, element);
  }

  // 注销模型
  static unregisterModel(element) {
    const container = this.containers.get(element);
    const model = this.models.get(element);

    if (container && this.stage && container.parent === this.stage) {
      this.stage.removeChild(container);
    }

    if (model && !model.destroyed) {
      model.destroy({ children: true, texture: true, baseTexture: true });
    }

    this.models.delete(element);
    this.containers.delete(element);
  }

  static hasModel(element) {
    return this.models.has(element);
  }
}

window.PIXI = PIXI;

class Live2DViewerMulti extends HTMLElement {
  constructor() {
    super();
    this.model = null;
    this.modelContainer = null;
    this.attachShadow({ mode: "open" });
    this._isDestroyed = false;
    this._isLoading = false;
    this._hasRendered = false;

    this.baseWindowWidth = 1920;
    this.baseWindowHeight = 1080;

    // 添加翻转状态
    this._isFlipped = false;
  }

  static get observedAttributes() {
    return ["src", "motion", "scale", "auto-interact", "x", "y", "flip"];
  }

  connectedCallback() {
    if (this._hasRendered) {
      return;
    }
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.isConnected) {
      return;
    }

    if (name === "src") {
      this.reloadModel();
    } else if (name === "flip") {
      this.updateFlipState();
    } else if (this.model) {
      this.updateModelState();
    }
  }

  async render() {
    if (this._isDestroyed || this._hasRendered) {
      return;
    }

    this._hasRendered = true;
    this.shadowRoot.innerHTML = "";

    const src = this.getAttribute("src");

    if (!src) {
      this.shadowRoot.innerHTML =
        '<div style="color: red;">Error: src attribute is required</div>';
      return;
    }

    const container = document.createElement("div");
    this.container = container;
    container.style.cssText = `
      display: none;
    `;
    this.shadowRoot.appendChild(container);

    this.style.cssText = `
      display: none;
    `;

    try {
      await Live2DGlobalManager.initialize();
      await this.loadModel();
    } catch (error) {
      console.error("Failed to initialize Live2D:", error);
      this.shadowRoot.innerHTML = `<div style="color: red;">Error: ${error.message}</div>`;
    }
  }

  async loadModel() {
    if (this._isLoading || Live2DGlobalManager.hasModel(this)) {
      return;
    }

    this._isLoading = true;

    const src = this.getAttribute("src");
    const motion = this.getAttribute("motion") || "idle";
    const scale = parseFloat(this.getAttribute("scale")) || 0.15;
    const autoInteract = this.getAttribute("auto-interact") !== "false";
    const flip = this.getAttribute("flip") === "true";

    try {
      console.log(`Loading model: ${src}`);

      this.cleanupModel();

      this.model = await Live2DModel.from(src, {
        autoInteract,
      });

      if (this.model) {
        this.modelContainer = new PIXI.Container();
        this.modelContainer.addChild(this.model);

        Live2DGlobalManager.registerModel(this, this.model, this.modelContainer);

        // 设置翻转状态
        this._isFlipped = flip;
        this.applyFlip();

        if (motion && this.model.internalModel) {
          try {
            await this.model.motion(motion);
          } catch (error) {
            console.warn(`Motion '${motion}' not found:`, error);
            try {
              await this.model.motion("idle");
            } catch (fallbackError) {
              console.warn("Failed to play fallback motion:", fallbackError);
            }
          }
        }

        // 设置初始缩放
        this.setScale(scale);

        // 等待一帧确保模型尺寸已计算
        await new Promise(resolve => requestAnimationFrame(resolve));

        // 更新位置
        this.updatePosition();

        console.log(`Model loaded successfully for element:`, this);
      }
    } catch (error) {
      console.error("Failed to load Live2D model:", error);
      this.shadowRoot.innerHTML = `<div style="color: red;">Error loading Live2D model: ${error.message}</div>`;
    } finally {
      this._isLoading = false;
    }
  }

  // 应用水平翻转
  applyFlip() {
    if (!this.modelContainer) return;

    if (this._isFlipped) {
      // 水平翻转：scale.x 设为负值
      this.modelContainer.scale.x = -Math.abs(this.modelContainer.scale.x);
    } else {
      // 恢复正常：scale.x 设为正值
      this.modelContainer.scale.x = Math.abs(this.modelContainer.scale.x);
    }
  }

  // 更新翻转状态
  updateFlipState() {
    const flip = this.getAttribute("flip") === "true";
    if (this._isFlipped !== flip) {
      this._isFlipped = flip;
      this.applyFlip();
      this.updatePosition(); // 翻转后可能需要重新定位
    }
  }

  // 处理窗口大小变化
  handleWindowResize() {
    if (!this.modelContainer || !this.model) return;

    // 重新计算缩放和位置
    this.updateScale();
    this.updatePosition();
  }

  // 更新缩放 - 考虑翻转状态
  updateScale() {
    if (!this.modelContainer || !this.model) return;

    const baseScale = parseFloat(this.getAttribute("scale")) || 0.15;

    const widthRatio = window.innerWidth / this.baseWindowWidth;
    const heightRatio = window.innerHeight / this.baseWindowHeight;
    const scaleFactor = Math.min(widthRatio, heightRatio);
    const actualScale = baseScale * scaleFactor;

    // 设置缩放，保持翻转状态
    if (this._isFlipped) {
      this.modelContainer.scale.set(-actualScale, actualScale);
    } else {
      this.modelContainer.scale.set(actualScale, actualScale);
    }
  }

  // 修正定位逻辑 - 考虑翻转状态
  updatePosition() {
    if (!this.modelContainer || !this.model) return;

    const x = parseFloat(this.getAttribute("x")) || 0.5;
    const y = parseFloat(this.getAttribute("y")) || 0.5;

    const modelWidth = this.modelContainer.width;
    const modelHeight = this.modelContainer.height;

    const targetX = window.innerWidth * x;
    const targetY = window.innerHeight * y;

    // 如果翻转了，需要调整水平位置
    let finalX = targetX - (modelWidth / 2);

    // 因为翻转后模型的锚点还在左上角，所以位置需要调整
    if (this._isFlipped) {
      finalX = targetX + (modelWidth / 2);
    }

    this.modelContainer.position.set(
      finalX,
      targetY - (modelHeight / 2)
    );
  }

  async reloadModel() {
    if (this._isLoading) {
      console.warn('Model is already loading, skipping reload');
      return;
    }
    await this.loadModel();
  }

  updateModelState() {
    const motion = this.getAttribute("motion");

    if (motion && this.model && this.model.internalModel) {
      this.setMotion(motion);
    }

    // 缩放改变时更新
    this.updateScale();
    this.updatePosition();
  }

  // 设置缩放（考虑翻转状态）
  setScale(scale) {
    if (this.modelContainer && this.model) {
      this.setAttribute('scale', scale.toString());
      this.updateScale();
      this.updatePosition();
    }
  }

  // 新增：翻转模型（公共方法）
  flip(flip = true) {
    this._isFlipped = flip;
    this.setAttribute('flip', flip.toString());
    this.applyFlip();
    this.updatePosition();
  }

  // 新增：切换翻转状态
  toggleFlip() {
    this.flip(!this._isFlipped);
  }

  // 新增：获取翻转状态
  isFlipped() {
    return this._isFlipped;
  }

  cleanupModel() {
    Live2DGlobalManager.unregisterModel(this);

    if (this.model && !this.model.destroyed) {
      try {
        this.model.destroy({ children: true, texture: true, baseTexture: true });
      } catch (e) {
        console.warn('Error destroying model:', e);
      }
    }

    this.model = null;
    this.modelContainer = null;
    this._isFlipped = false;
  }

  disconnectedCallback() {
    this._isDestroyed = true;
    this.cleanupModel();
  }

  // 其他公共方法保持不变...
  async setMotion(motionName) {
    if (this.model && this.model.internalModel) {
      try {
        await this.model.motion(motionName);
      } catch (error) {
        console.warn(`Failed to set motion '${motionName}':`, error);
      }
    }
  }

  getMotions() {
    if (this.model && this.model.internalModel) {
      try {
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

  setExpression(expressionName) {
    if (this.model && this.model.internalModel) {
      try {
        this.model.expression(expressionName);
      } catch (error) {
        console.warn(`Failed to set expression '${expressionName}':`, error);
      }
    }
  }

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

  static getGlobalStatus() {
    return {
      isInitialized: Live2DGlobalManager.isInitialized,
      modelCount: Live2DGlobalManager.models.size,
      models: Array.from(Live2DGlobalManager.models.keys())
    };
  }
}

if (!customElements.get("live2d-viewer-multi")) {
  customElements.define("live2d-viewer-multi", Live2DViewerMulti);
}

export { Live2DGlobalManager };
export default Live2DViewerMulti;