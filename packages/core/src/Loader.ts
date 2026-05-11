/**
 * Loader — 统一模型加载器
 * 支持 GLTF/GLB 3D 模型和 .bin 点云二进制文件
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export interface LoadResult {
  /** 场景（GLTF 模型才有） */
  scene?: THREE.Group
  /** 网格对象列表（GLTF 模型才有） */
  meshes?: THREE.Mesh[]
  /** 点云数据（.bin 文件或从模型采样的结果） */
  pointCloud?: PointCloudData
}

export interface PointCloudData {
  /** 顶点坐标 Float32Array [x, y, z, x, y, z, ...] */
  positions: Float32Array
  /** 法线 Float32Array [nx, ny, nz, nx, ny, nz, ...]（可选） */
  normals?: Float32Array
  /** 粒子数量 */
  count: number
}

/** 支持的文件类型 */
export type FileType = 'gltf' | 'glb' | 'bin'

/**
 * 根据文件扩展名判断类型
 */
function getFileType(url: string): FileType {
  const ext = url.split('.').pop()?.toLowerCase()
  if (ext === 'gltf') return 'gltf'
  if (ext === 'glb') return 'glb'
  if (ext === 'bin') return 'bin'
  throw new Error(`Unsupported file type: .${ext}`)
}

/**
 * 加载 GLTF/GLB 模型
 */
async function loadGLTF(url: string): Promise<LoadResult> {
  const loader = new GLTFLoader()

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const scene = gltf.scene
        const meshes: THREE.Mesh[] = []

        scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            meshes.push(child as THREE.Mesh)
          }
        })

        resolve({ scene, meshes })
      },
      undefined,
      (error) => reject(error)
    )
  })
}

/**
 * 加载 .bin 点云二进制文件
 * 格式：连续的 Float32 值，每 3 个为一组 (x, y, z)
 * 可选：每 6 个为一组 (x, y, z, nx, ny, nz)
 */
async function loadBin(url: string): Promise<LoadResult> {
  const response = await fetch(url)
  const buffer = await response.arrayBuffer()
  const floats = new Float32Array(buffer)

  // 判断是纯坐标还是坐标+法线
  const hasNormals = floats.length % 6 === 0 && floats.length % 3 === 0
  const stride = hasNormals ? 6 : 3
  const count = floats.length / stride

  const positions = new Float32Array(count * 3)
  let normals: Float32Array | undefined

  if (hasNormals) {
    normals = new Float32Array(count * 3)
  }

  for (let i = 0; i < count; i++) {
    const srcIdx = i * stride
    const dstIdx = i * 3

    positions[dstIdx] = floats[srcIdx]
    positions[dstIdx + 1] = floats[srcIdx + 1]
    positions[dstIdx + 2] = floats[srcIdx + 2]

    if (hasNormals && normals) {
      normals[dstIdx] = floats[srcIdx + 3]
      normals[dstIdx + 1] = floats[srcIdx + 4]
      normals[dstIdx + 2] = floats[srcIdx + 5]
    }
  }

  return {
    pointCloud: { positions, normals, count }
  }
}

/**
 * 统一加载入口
 * 自动识别文件类型并加载
 */
export async function load(url: string): Promise<LoadResult> {
  const type = getFileType(url)

  switch (type) {
    case 'gltf':
    case 'glb':
      return loadGLTF(url)
    case 'bin':
      return loadBin(url)
  }
}
