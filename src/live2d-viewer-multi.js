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
    
    // 基准窗口尺寸，用于计算相对缩放
    this.baseWindowWidth = 1920; // 假设设计基准是 1920px 宽度
    this.baseWindowHeight = 1080; // 假设设计基准是 1080px 高度
  }

  static get observedAttributes() {
    return ["src", "motion", "scale", "auto-interact", "x", "y"];
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
    
    // 计算基于窗口宽高的缩放因子
    const widthRatio = window.innerWidth / this.baseWindowWidth;
    const heightRatio = window.innerHeight / this.baseWindowHeight;
    
    // 使用较小的缩放因子确保模型完全可见
    const scaleFactor = Math.min(widthRatio, heightRatio);
    
    // 应用相对缩放
    const actualScale = baseScale * scaleFactor;
    
    this.modelContainer.scale.set(actualScale, actualScale);
    
    console.log('Scale updated:', {
      baseScale,
      widthRatio,
      heightRatio,
      scaleFactor,
      actualScale,
      windowSize: { width: window.innerWidth, height: window.innerHeight }
    });
  }

  // 修正定位逻辑
  updatePosition() {
    if (!this.modelContainer || !this.model) return;

    const x = parseFloat(this.getAttribute("x")) || 0.5;
    const y = parseFloat(this.getAttribute("y")) || 0.5;

    // 获取模型的实际尺寸（考虑缩放）
    const modelWidth = this.modelContainer.width;
    const modelHeight = this.modelContainer.height;

    // 计算位置：目标位置 - 模型尺寸的一半（让中心点对准目标位置）
    const targetX = window.innerWidth * x;
    const targetY = window.innerHeight * y;

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
    
    if (motion && this.model && this.model.internalModel) {
      this.setMotion(motion);
    }
    
    // 缩放改变时更新
    this.updateScale();
    this.updatePosition();
  }

  // 设置缩放（公共方法）
  setScale(scale) {
    if (this.modelContainer && this.model) {
      // 设置基础缩放值
      this.setAttribute('scale', scale.toString());
      // 更新实际缩放
      this.updateScale();
      this.updatePosition();
    }
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