declare module '@alphardex/live2d-viewer' {
  export class Live2DViewer extends HTMLElement {
    constructor();
    
    // 属性
    static get observedAttributes(): string[];
    
    // 生命周期方法
    connectedCallback(): void;
    disconnectedCallback(): void;
    
    // 公共方法
    /**
     * 设置模型动作
     * @param motionName 动作名称
     */
    setMotion(motionName: string): void;
    
    /**
     * 获取可用动作列表
     * @returns 动作名称数组
     */
    getMotions(): string[];
    
    /**
     * 设置模型缩放
     * @param scale 缩放比例
     */
    setScale(scale: number): void;
    
    /**
     * 设置是否启用自动交互
     * @param enabled 是否启用
     */
    setAutoInteract(enabled: boolean): void;
    
    /**
     * 设置模型表情
     * @param expressionName 表情名称
     */
    setExpression(expressionName: string): void;
    
    /**
     * 获取可用表情列表
     * @returns 表情名称数组
     */
    getExpressions(): string[];
  }
  
  export default Live2DViewer;
}

// 扩展全局HTMLElementTagNameMap
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'live2d-viewer': {
        src?: string;
        motion?: string;
        scale?: string | number;
        'auto-interact'?: string | boolean;
        children?: React.ReactNode;
      };
    }
  }
  
  interface HTMLElementTagNameMap {
    'live2d-viewer': Live2DViewer;
  }
}