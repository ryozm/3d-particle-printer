# 快速开始

## 安装

```bash
# React 项目
npm install @particle-printer/react three @react-three/fiber

# Vue 项目
npm install @particle-printer/vue three @tresjs/core

# 纯 Three.js 项目
npm install @particle-printer/core three
```

## 使用

### React / R3F

```tsx
import { ParticlePrinter } from '@particle-printer/react'

function App() {
  return <ParticlePrinter />
}
```

### Vue3 / TresJS

```vue
<template>
  <ParticlePrinter />
</template>

<script setup>
import { ParticlePrinter } from '@particle-printer/vue'
</script>
```

### Vanilla Three.js

```ts
import { Printer } from '@particle-printer/core'

const printer = new Printer()
```
