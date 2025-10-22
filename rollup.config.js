import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default [
  // 原始单模型版本
  {
    input: 'src/live2d-viewer.js',
    output: [
      {
        file: 'dist/live2d-viewer.js',
        format: 'es',
        name: 'Live2DViewer'
      },
      {
        file: 'dist/live2d-viewer.cjs.js',
        format: 'cjs',
        exports: 'named'
      }
    ],
    external: ['pixi.js', 'pixi-live2d-display'],
    plugins: [
      nodeResolve({
        preferBuiltins: false
      }),
      commonjs()
    ]
  },
  // 新版多模型版本
  {
    input: 'src/live2d-viewer-multi.js',
    output: [
      {
        file: 'dist/live2d-viewer-multi.js',
        format: 'es',
        name: 'Live2DViewerMulti'
      },
      {
        file: 'dist/live2d-viewer-multi.cjs.js',
        format: 'cjs',
        exports: 'named'
      }
    ],
    external: ['pixi.js', 'pixi-live2d-display'],
    plugins: [
      nodeResolve({
        preferBuiltins: false
      }),
      commonjs()
    ]
  },
  // 可选：主入口文件，导出两个版本
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/index.js',
        format: 'es'
      },
      {
        file: 'dist/index.cjs.js',
        format: 'cjs',
        exports: 'named'
      }
    ],
    external: ['pixi.js', 'pixi-live2d-display'],
    plugins: [
      nodeResolve({
        preferBuiltins: false
      }),
      commonjs()
    ]
  }
];