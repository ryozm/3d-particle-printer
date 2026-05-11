# 明日方舟：终末地 官网 3D 模型打印/加载动效开源复刻

> Arknights: Endfield Official Website 3D Model Print Animation — Open Source Recreation

## ✨ 项目简介

复刻 [明日方舟：终末地](https://www.arknights.endfield.net/) 官网中炫酷的 3D 模型加载/打印动效。

核心效果：3D 模型以"打印"的方式逐层显现，配合粒子、光效等视觉元素，呈现出类似 3D 打印机工作的加载动画。

## 🎯 目标

- 开源复刻终末地官网的 3D 模型打印动效
- 流畅的 Web 端 3D 渲染体验
- 可自定义模型、动效参数
- 多框架适配（React / Vue）

## 🛠 技术栈

| 分类 | 方案 | 备注 |
|------|------|------|
| 3D 引擎 | Three.js | 核心渲染 |
| 着色器 | GLSL | 粒子动效的核心实现 |
| 前端框架 | React + R3F | 主力开发框架 |
| 样式 | Tailwind CSS | |
| 模型格式 | GLTF / GLB / .bin | 支持标准 3D 模型及点云二进制文件 |
| 包管理 | pnpm workspaces | Monorepo |
| 构建 | Turborepo + tsup + Vite | |
| 文档 | VitePress | |

## 🏗 项目架构

```
3d-particle-printer/
├── package.json               # 根依赖管理 (pnpm workspaces)
├── pnpm-workspace.yaml        # 定义 packages 和 apps 目录
├── turbo.json                 # Turborepo 任务配置
│
├── packages/                  # 📦 核心源码区 (npm 包)
│   ├── core/                  # 🧠 纯 Vanilla Three.js 实现
│   │   ├── src/
│   │   │   ├── shaders/       # GLSL 源码文件
│   │   │   ├── samplers/      # 点云采样策略
│   │   │   ├── Printer.js     # 主控类 (管理动画、切换、材质)
│   │   │   ├── Wires.js       # 丝线特效
│   │   │   └── index.js       # 导出入口
│   │   └── package.json       # @particle-printer/core
│   │
│   ├── react/                 # ⚛️ React / R3F 适配
│   │   └── package.json       # @particle-printer/react
│   │
│   └── vue/                   # 🟩 Vue3 / TresJS 适配 (TODO)
│       └── package.json       # @particle-printer/vue
│
└── apps/                      # 🚀 演示与文档 (不发布)
    ├── demo-vanilla/          # 原生 JS 演示
    ├── demo-react/            # React + R3F 演示
    ├── demo-vue/              # Vue3 + TresJS 演示 (TODO)
    └── docs/                  # VitePress 文档
```

## 📦 支持的输入格式

- **GLTF / GLB** — 标准 3D 模型格式，自动采样表面生成点云
- **.bin (点云二进制)** — 预计算的点云坐标数据，直接加载

## 🎨 点云采样策略

内置多种采样算法，支持切换：

- **SurfaceSampler** — 三角面随机采样（默认）
- PoissonDiskSampler — 均匀分布采样（TODO）
- VoxelSampler — 体素化采样（TODO）

## 📄 License

MIT
