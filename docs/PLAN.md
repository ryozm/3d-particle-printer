# 开发计划 — 3D Particle Printer

> 明日方舟：终末地 官网 3D 模型打印/加载动效开源复刻

## 技术栈

- Three.js + GLSL（核心渲染）
- React + R3F（主力框架）
- pnpm workspaces + Turborepo（Monorepo）
- 支持 GLTF/GLB 模型 + .bin 点云二进制文件

---

## Phase 1：核心基础 — 模型加载与点云采样

### 1.1 模型加载器 (Loader) ✅
- [x] 实现 GLTF/GLB 模型加载（基于 THREE.GLTFLoader）
- [x] 实现 .bin 点云二进制文件加载（Float32Array 读取 xyz 坐标）
- [x] 统一的输入接口，自动识别文件类型

### 1.2 点云采样器 (Sampler) ✅
- [x] 定义 Sampler 策略接口 `ISampler`
- [x] 实现 SurfaceSampler — 三角面随机采样（默认策略）
- [x] 输出标准化的点云数据格式 `{ positions: Float32Array, normals: Float32Array, count: number }`

### 1.3 点云渲染 ✅
- [x] BufferGeometry 构建粒子系统
- [x] 基础 GLSL 着色器（vertex + fragment）
- [x] 粒子尺寸、颜色控制

**验收：** 能加载一个 GLB 模型，采样为点云并渲染到画布上

---

## Phase 2：核心动效 — 打印动画

### 2.1 打印进度系统
- [ ] Printer 主控类：管理 uProgress uniform（0→1）
- [ ] 按 Y 轴排序粒子，实现从下到上的打印效果
- [ ] 每个粒子的延迟属性 aDelay（基于归一化 Y 值）
- [ ] 速度控制 aSpeed

### 2.2 GLSL 着色器进阶
- [ ] 顶点着色器：根据 uProgress 和 aDelay 控制粒子显现
- [ ] 粒子从无到有的缩放动画
- [ ] 片元着色器：发光效果（Bloom-like glow）
- [ ] 颜色渐变（打印区域 vs 未打印区域）

### 2.3 动画控制
- [ ] 播放 / 暂停 / 重置
- [ ] 速度调节
- [ ] 循环播放支持

**验收：** 模型粒子从下到上逐层"打印"显现，有发光和颜色渐变效果

---

## Phase 3：丝线特效 (Wires)

### 3.1 丝线生成
- [ ] 从粒子顶部向下生成垂直丝线
- [ ] 丝线长度、密度参数控制
- [ ] 随机偏移增加自然感

### 3.2 丝线渲染
- [ ] GLSL 着色器：丝线的透明度衰减
- [ ] 与粒子系统的混合渲染

**验收：** 打印过程中有丝线从上方垂落的视觉效果

---

## Phase 4：React 适配层

### 4.1 R3F 组件封装
- [ ] `<ParticlePrinter>` 组件
- [ ] Props 接口设计：model、progress、color、wire 等
- [ ] 内部调用 core 包的 Printer/Sampler/Wires
- [ ] 生命周期管理（useFrame、useEffect）

### 4.2 Hook 封装
- [ ] `useParticlePrinter()` — 返回 printer 实例和控制方法
- [ ] `useModelLoader()` — 模型加载 hook

**验收：** 在 React 项目中通过组件方式使用粒子打印效果

---

## Phase 5：演示与打磨

### 5.1 Demo 应用
- [ ] demo-vanilla：原生 JS 完整演示
- [ ] demo-react：React + R3F 完整演示
- [ ] 模型切换功能
- [ ] 参数面板（进度、颜色、速度等可调）

### 5.2 文档站
- [ ] VitePress 文档完善
- [ ] API 参考文档
- [ ] 使用示例

### 5.3 发布准备
- [ ] 包构建验证（tsup build）
- [ ] npm publish 配置
- [ ] CHANGELOG

---

## 进度追踪

| 阶段 | 状态 | 开始日期 | 完成日期 |
|------|------|---------|---------|
| Phase 1 | ✅ 完成 | 2026-05-11 | 2026-05-11 |
| Phase 2 | 🔲 未开始 | — | — |
| Phase 3 | 🔲 未开始 | — | — |
| Phase 4 | 🔲 未开始 | — | — |
| Phase 5 | 🔲 未开始 | — | — |
