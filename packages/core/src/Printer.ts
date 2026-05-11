/**
 * Printer — 主控类
 * 管理粒子系统的创建、渲染、动画播放
 */
import * as THREE from 'three'
import type { PointCloudData } from './Loader'
import type { ISampler } from './ISampler'
import { SurfaceSampler } from './samplers/SurfaceSampler'
import { load } from './Loader'

import particleVert from './shaders/particle.vert'
import particleFrag from './shaders/particle.frag'

export interface PrinterOptions {
  /** 采样粒子数量 */
  particleCount?: number
  /** 粒子颜色 */
  color?: THREE.Color | string
  /** 粒子大小 */
  pointSize?: number
  /** 采样器（默认 SurfaceSampler） */
  sampler?: ISampler
}

const DEFAULT_OPTIONS: Required<PrinterOptions> = {
  particleCount: 50000,
  color: new THREE.Color(0x00ffff),
  pointSize: 2.0,
  sampler: new SurfaceSampler(),
}

export class Printer {
  /** 粒子系统 */
  points: THREE.Points | null = null
  /** Shader Material */
  material: THREE.ShaderMaterial | null = null
  /** 配置 */
  options: Required<PrinterOptions>
  /** 点云数据 */
  private pointCloud: PointCloudData | null = null

  constructor(options?: PrinterOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * 加载模型并生成点云
   * @param url - 模型文件 URL（GLTF/GLB/.bin）
   */
  async loadFromUrl(url: string): Promise<void> {
    const result = await load(url)

    if (result.pointCloud) {
      // .bin 文件，直接使用点云数据
      this.pointCloud = result.pointCloud
    } else if (result.meshes && result.meshes.length > 0) {
      // GLTF/GLB 模型，采样生成点云
      this.pointCloud = this.options.sampler.sample(result.meshes, this.options.particleCount)
    } else {
      throw new Error('No mesh or point cloud data found in the loaded file')
    }

    this.buildParticleSystem()
  }

  /**
   * 直接从点云数据构建
   */
  loadFromPointCloud(data: PointCloudData): void {
    this.pointCloud = data
    this.buildParticleSystem()
  }

  /**
   * 构建粒子系统
   */
  private buildParticleSystem(): void {
    if (!this.pointCloud) return

    const { positions, normals, count } = this.pointCloud

    // 创建 BufferGeometry
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    if (normals) {
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    }

    // 生成每粒子属性
    const delays = new Float32Array(count)
    const speeds = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // 归一化 Y 值作为延迟（从下到上打印）
      const y = positions[i * 3 + 1]
      delays[i] = this.normalizeDelay(y, positions)
      speeds[i] = 0.8 + Math.random() * 0.4 // 0.8 ~ 1.2 随机速度
    }

    geometry.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1))
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))

    // 创建 ShaderMaterial
    const color = this.options.color instanceof THREE.Color
      ? this.options.color
      : new THREE.Color(this.options.color)

    this.material = new THREE.ShaderMaterial({
      vertexShader: particleVert,
      fragmentShader: particleFrag,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uColor: { value: color },
        uPointSize: { value: this.options.pointSize },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    // 创建 Points 对象
    this.points = new THREE.Points(geometry, this.material)
  }

  /**
   * 归一化 Y 值为 0~1 的延迟值
   */
  private normalizeDelay(y: number, positions: Float32Array): number {
    // 找到 Y 的最小最大值
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 1; i < positions.length; i += 3) {
      minY = Math.min(minY, positions[i])
      maxY = Math.max(maxY, positions[i])
    }

    const range = maxY - minY
    if (range === 0) return 0

    return (y - minY) / range
  }

  /**
   * 更新动画（每帧调用）
   * @param elapsed - 经过的时间（秒）
   */
  update(elapsed: number): void {
    if (this.material) {
      this.material.uniforms.uTime.value = elapsed
    }
  }

  /**
   * 设置打印进度 (0 ~ 1)
   */
  setProgress(progress: number): void {
    if (this.material) {
      this.material.uniforms.uProgress.value = Math.max(0, Math.min(1, progress))
    }
  }

  /**
   * 获取 Points 对象，用于添加到场景
   */
  getObject(): THREE.Points | null {
    return this.points
  }

  /**
   * 销毁释放资源
   */
  dispose(): void {
    if (this.points) {
      this.points.geometry.dispose()
      this.material?.dispose()
      this.points = null
      this.material = null
    }
  }
}
