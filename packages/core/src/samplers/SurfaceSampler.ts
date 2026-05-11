/**
 * SurfaceSampler — 三角面随机采样
 * 
 * 默认采样策略：根据三角面面积按概率随机采样点
 * 面积越大的三角面，被采样的概率越高，保证分布均匀
 */
import * as THREE from 'three'
import type { PointCloudData } from '../Loader'
import type { ISampler } from '../ISampler'

export class SurfaceSampler implements ISampler {
  readonly name = 'surface'

  /**
   * 从网格数组采样生成点云
   */
  sample(meshes: THREE.Mesh[], count: number): PointCloudData {
    // 1. 收集所有三角面数据
    const triangles = this.collectTriangles(meshes)

    // 2. 计算每个三角面的面积
    const areas = triangles.map((tri) => this.triangleArea(tri))
    const totalArea = areas.reduce((sum, a) => sum + a, 0)

    // 3. 按面积概率采样
    const positions = new Float32Array(count * 3)
    const normals = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      // 按面积加权随机选择三角面
      const triIdx = this.weightedRandom(areas, totalArea)
      const tri = triangles[triIdx]

      // 在三角面内随机采样一个点
      const point = this.randomPointOnTriangle(tri)
      positions[i * 3] = point.x
      positions[i * 3 + 1] = point.y
      positions[i * 3 + 2] = point.z

      // 法线插值（使用三角面法线，更精确的做法是顶点法线插值）
      const normal = tri.normal
      normals[i * 3] = normal.x
      normals[i * 3 + 1] = normal.y
      normals[i * 3 + 2] = normal.z
    }

    return { positions, normals, count }
  }

  /**
   * 从网格中提取所有三角面
   */
  private collectTriangles(meshes: THREE.Mesh[]): Triangle[] {
    const triangles: Triangle[] = []

    for (const mesh of meshes) {
      const geometry = mesh.geometry
      const position = geometry.getAttribute('position')
      const normal = geometry.getAttribute('normal')
      const index = geometry.getIndex()

      // 获取世界变换矩阵
      mesh.updateWorldMatrix(true, false)
      const matrix = mesh.matrixWorld
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)

      if (index) {
        // 索引几何体
        for (let i = 0; i < index.count; i += 3) {
          const a = index.getX(i)
          const b = index.getX(i + 1)
          const c = index.getX(i + 2)

          triangles.push(this.extractTriangle(position, normal, a, b, c, matrix, normalMatrix))
        }
      } else {
        // 非索引几何体
        for (let i = 0; i < position.count; i += 3) {
          triangles.push(this.extractTriangle(position, normal, i, i + 1, i + 2, matrix, normalMatrix))
        }
      }
    }

    return triangles
  }

  /**
   * 提取单个三角面数据
   */
  private extractTriangle(
    position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
    normal: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined,
    a: number, b: number, c: number,
    matrix: THREE.Matrix4,
    normalMatrix: THREE.Matrix3
  ): Triangle {
    const vA = new THREE.Vector3().fromBufferAttribute(position, a).applyMatrix4(matrix)
    const vB = new THREE.Vector3().fromBufferAttribute(position, b).applyMatrix4(matrix)
    const vC = new THREE.Vector3().fromBufferAttribute(position, c).applyMatrix4(matrix)

    // 计算面法线
    const edge1 = new THREE.Vector3().subVectors(vB, vA)
    const edge2 = new THREE.Vector3().subVectors(vC, vA)
    const faceNormal = new THREE.Vector3().crossVectors(edge1, edge2).normalize()

    // 如果有顶点法线，使用顶点法线插值
    let nA = faceNormal
    if (normal) {
      nA = new THREE.Vector3().fromBufferAttribute(normal, a).applyMatrix3(normalMatrix).normalize()
    }

    return { a: vA, b: vB, c: vC, normal: nA }
  }

  /**
   * 计算三角形面积（海伦公式）
   */
  private triangleArea(tri: Triangle): number {
    const edge1 = new THREE.Vector3().subVectors(tri.b, tri.a)
    const edge2 = new THREE.Vector3().subVectors(tri.c, tri.a)
    return edge1.cross(edge2).length() * 0.5
  }

  /**
   * 按权重随机选择索引
   */
  private weightedRandom(weights: number[], total: number): number {
    let random = Math.random() * total
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i]
      if (random <= 0) return i
    }
    return weights.length - 1
  }

  /**
   * 在三角形内随机采样一个点（重心坐标法）
   */
  private randomPointOnTriangle(tri: Triangle): THREE.Vector3 {
    // 使用重心坐标确保均匀分布
    let r1 = Math.random()
    let r2 = Math.random()

    // 确保点在三角形内
    if (r1 + r2 > 1) {
      r1 = 1 - r1
      r2 = 1 - r2
    }

    // P = A + r1*(B-A) + r2*(C-A)
    const point = new THREE.Vector3()
      .copy(tri.a)
      .addScaledVector(new THREE.Vector3().subVectors(tri.b, tri.a), r1)
      .addScaledVector(new THREE.Vector3().subVectors(tri.c, tri.a), r2)

    return point
  }
}

/** 三角形数据结构 */
interface Triangle {
  a: THREE.Vector3
  b: THREE.Vector3
  c: THREE.Vector3
  normal: THREE.Vector3
}
