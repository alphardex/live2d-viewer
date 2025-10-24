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
    this._isReady = false;

    this.baseWindowWidth = 1920;
    this.baseWindowHeight = 1080;
    
    // 呼吸动画控制（默认关闭）
    this._breathEnabled = false;

    // 显隐控制（默认显示）
    this._show = true;
  }

  static get observedAttributes() {
    return ["src", "motion", "scale", "auto-interact", "x", "y", "breath-enabled", "expression", "show"];
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
    } else if (name === "breath-enabled") {
      this.updateBreathState();
    } else if (name === "show") {
      this.updateShowState();
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
    const breathEnabled = this.getAttribute("breath-enabled") === "true";

    if (!src) {
      this.shadowRoot.innerHTML =
        '<div style="color: red;">Error: src attribute is required</div>';
      return;
    }

    this._breathEnabled = breathEnabled;

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
    this._isReady = false;

    const src = this.getAttribute("src");
    const motion = this.getAttribute("motion") || "idle";
    const scale = parseFloat(this.getAttribute("scale")) || 0.5;
    const autoInteract = this.getAttribute("auto-interact") === "true";
    const expression = this.getAttribute("expression");

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

        // 设置呼吸动画
        this.setupBreathAnimation();

        // 初始显隐状态
        const showAttr = this.getAttribute("show");
        const shouldShow = showAttr === null ? true : (showAttr !== "false");
        this._show = shouldShow;
        this.modelContainer.visible = shouldShow;

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

        // 如果有表情，先设置表情
        if (expression && this.model && this.model.internalModel) {
          this.setExpression(expression);
        }

        // 设置初始缩放
        this.setScale(scale);

        // 等待一帧确保模型尺寸已计算
        await new Promise(resolve => requestAnimationFrame(resolve));

        // 更新位置
        this.updatePosition();

        console.log(`Model loaded successfully for element:`, this);
        this._isReady = true;
        try {
          this.dispatchEvent(new CustomEvent("model-loaded", {
            detail: {
              src,
              motions: this.getMotions(),
              expressions: this.getExpressions(),
              width: this.modelContainer?.width,
              height: this.modelContainer?.height
            },
            bubbles: true,
            composed: true
          }));
        } catch (e) {
          console.warn("Failed to dispatch model-loaded event:", e);
        }
      }
    } catch (error) {
      console.error("Failed to load Live2D model:", error);
      this.shadowRoot.innerHTML = `<div style="color: red;">Error loading Live2D model: ${error.message}</div>`;
      try {
        this.dispatchEvent(new CustomEvent("model-error", {
          detail: { src, message: error?.message || String(error) },
          bubbles: true,
          composed: true
        }));
      } catch (e) {
        console.warn("Failed to dispatch model-error event:", e);
      }
    } finally {
      this._isLoading = false;
    }
  }

  // 设置呼吸动画
  setupBreathAnimation() {
    if (!this.model || !this.model.internalModel) return;
    
    try {
      const internalModel = this.model.internalModel;
      
      if (this._breathEnabled && internalModel.breath && internalModel.breath.setParameters) {
        // 启用呼吸动画
        internalModel.breath.setParameters([
          // 这些参数需要根据具体模型调整
          // 格式：参数ID, 偏移量, 峰值, 周期, 重量
          { id: internalModel.coreModel.getParameterId('ParamAngleX'), offset: 0.0, peak: 15.0, cycle: 6.5345, weight: 0.5 },
          { id: internalModel.coreModel.getParameterId('ParamAngleY'), offset: 0.0, peak: 8.0, cycle: 3.5345, weight: 0.5 },
          { id: internalModel.coreModel.getParameterId('ParamAngleZ'), offset: 0.0, peak: 10.0, cycle: 5.5345, weight: 0.5 },
          { id: internalModel.coreModel.getParameterId('ParamBodyAngleX'), offset: 0.0, peak: 4.0, cycle: 15.5345, weight: 0.5 },
          { id: internalModel.coreModel.getParameterId('ParamBreath'), offset: 0.0, peak: 0.5, cycle: 3.2345, weight: 0.5 },
        ]);
        console.log('Breath animation enabled with parameters');
      } else if (!this._breathEnabled && internalModel.breath) {
        // 禁用呼吸动画 - 清空参数
        internalModel.breath.setParameters([]);
        console.log('Breath animation disabled');
      }
    } catch (error) {
      console.warn('Failed to setup breath animation:', error);
    }
  }

  // 显隐控制
  updateShowState() {
    const showAttr = this.getAttribute("show");
    const shouldShow = showAttr === null ? true : (showAttr !== "false");
    if (this._show === shouldShow) return;
    this._show = shouldShow;
    if (this.modelContainer) {
      this.modelContainer.visible = shouldShow;
    }
  }

  setShow(show = true) {
    this.setAttribute('show', show.toString());
  }
  show() { this.setShow(true); }
  hide() { this.setShow(false); }
  toggleShow() { this.setShow(!this._show); }

  // 更新呼吸动画状态
  updateBreathState() {
    const breathEnabled = this.getAttribute("breath-enabled") === "true";
    
    if (this._breathEnabled !== breathEnabled) {
      this._breathEnabled = breathEnabled;
      
      if (this.model) {
        this.setupBreathAnimation();
      }
    }
  }

  // 处理窗口大小变化
  handleWindowResize() {
    if (!this.modelContainer || !this.model) return;

    // 重新计算缩放和位置
    this.updateScale();
    this.updatePosition();
  }

  // 更新缩放 - 基于窗口尺寸的相对缩放
  updateScale() {
    if (!this.modelContainer || !this.model) return;

    const baseScale = parseFloat(this.getAttribute("scale")) || 0.15;

    const widthRatio = window.innerWidth / this.baseWindowWidth;
    const heightRatio = window.innerHeight / this.baseWindowHeight;
    const scaleFactor = Math.min(widthRatio, heightRatio);
    const actualScale = baseScale * scaleFactor;

    // 设置缩放
    this.modelContainer.scale.set(actualScale, actualScale);
  }

  // 修正定位逻辑 - 考虑模型自身尺寸
  updatePosition() {
    if (!this.modelContainer || !this.model) return;

    const x = parseFloat(this.getAttribute("x")) || 0.5;
    const y = parseFloat(this.getAttribute("y")) || 0.5;

    const modelWidth = this.modelContainer.width;
    const modelHeight = this.modelContainer.height;

    const targetX = window.innerWidth * x;
    const targetY = window.innerHeight * y;

    // 计算位置：目标位置 - 模型尺寸的一半（让中心点对准目标位置）
    this.modelContainer.position.set(
      targetX - (modelWidth / 2),
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
    const expression = this.getAttribute("expression");

    if (motion && this.model && this.model.internalModel) {
      this.setMotion(motion);
    }

    if (expression && this.model && this.model.internalModel) {
      this.setExpression(expression);
    }

    // 缩放改变时更新
    this.updateScale();
    this.updatePosition();
  }

  // 设置缩放
  setScale(scale) {
    if (this.modelContainer && this.model) {
      this.setAttribute('scale', scale.toString());
      this.updateScale();
      this.updatePosition();
    }
  }

  // 公共方法：控制呼吸动画
  enableBreathAnimation(enable = true) {
    this.setAttribute('breath-enabled', enable.toString());
  }

  disableBreathAnimation() {
    this.enableBreathAnimation(false);
  }

  toggleBreathAnimation() {
    this.enableBreathAnimation(!this._breathEnabled);
  }

  isBreathAnimationEnabled() {
    return this._breathEnabled;
  }

  // 模型是否已加载完成
  isModelLoaded() {
    return this._isReady === true;
  }

  // 返回一个在模型加载完成时 resolve 的 Promise
  waitForLoad() {
    if (this._isReady) return Promise.resolve();
    return new Promise((resolve) => {
      const onLoaded = () => resolve();
      this.addEventListener("model-loaded", onLoaded, { once: true });
    });
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
    this._breathEnabled = false;
    this._isReady = false;
  }

  disconnectedCallback() {
    this._isDestroyed = true;
    this.cleanupModel();
  }

  // 其他公共方法
  async setMotion(motionName, options = {}) {
    if (this.model && this.model.internalModel) {
      const { force = true } = options;
      try {
        if (force) {
          const mm = this.model.internalModel.motionManager;
          try {
            if (mm && typeof mm.stopAllMotions === 'function') {
              mm.stopAllMotions();
            } else if (mm && typeof mm.stopAllMotion === 'function') {
              mm.stopAllMotion();
            } else if (mm && typeof mm.stopAll === 'function') {
              mm.stopAll();
            }
          } catch (e) {
            console.warn('Failed to stop current motions:', e);
          }
        }
        await this.model.motion(motionName);
      } catch (error) {
        console.warn(`Failed to set motion '${motionName}':`, error);
      }
    }
  }

  // 手动中断所有正在播放的动作
  stopAllMotions() {
    try {
      const mm = this.model?.internalModel?.motionManager;
      if (mm?.stopAllMotions) mm.stopAllMotions();
      else if (mm?.stopAllMotion) mm.stopAllMotion();
      else if (mm?.stopAll) mm.stopAll();
    } catch (e) {
      console.warn('Failed to stop motions:', e);
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