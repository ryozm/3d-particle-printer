/**
 * ISampler — 点云采样策略接口
 * 
 * 所有采样器必须实现此接口，以便 Printer 可以切换采样策略
 */
import type * as THREE from 'three'
import type { PointCloudData } from './Loader'

export interface ISampler {
  /** 采样器名称 */
  readonly name: string

  /**
   * 从网格对象采样生成点云
   * @param meshes - 要采样的网格数组
   * @param count - 期望采样的粒子数量
   * @returns 点云数据
   */
  sample(meshes: THREE.Mesh[], count: number): PointCloudData
}
