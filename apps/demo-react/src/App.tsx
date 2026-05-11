import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import particleVert from './shaders/particle.vert'
import particleFrag from './shaders/particle.frag'

// ─── 点云数据结构 ───────────────────────────────────────

interface PointCloudData {
  positions: Float32Array
  normals?: Float32Array
  count: number
}

// ─── 调试参数 ───────────────────────────────────────────

interface DebugParams {
  progress: number
  autoPlay: boolean
  loop: boolean
  speed: number
  color: string
  pointSize: number
  particleCount: number
  dropOffset: number
  glowIntensity: number
  blendMode: 'additive' | 'normal'
}

const DEFAULT_PARAMS: DebugParams = {
  progress: 0,
  autoPlay: true,
  loop: true,
  speed: 1.0,
  color: '#9fadad',
  pointSize: 0.5,
  particleCount: 10000,
  dropOffset: 2.0,
  glowIntensity: 0.0,
  blendMode: 'additive',
}

// ─── 模型加载 & 采样 ───────────────────────────────────

/** 从文件扩展名判断类型 */
function getFileType(name: string): 'gltf' | 'glb' | 'bin' | null {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'gltf') return 'gltf'
  if (ext === 'glb') return 'glb'
  if (ext === 'bin') return 'bin'
  return null
}

/** 加载 GLTF/GLB 并采样为点云 */
async function loadAndSample(file: File, count: number): Promise<PointCloudData> {
  const url = URL.createObjectURL(file)
  try {
    const loader = new GLTFLoader()
    const gltf = await new Promise<any>((resolve, reject) => {
      loader.load(url, resolve, undefined, reject)
    })

    const meshes: THREE.Mesh[] = []
    gltf.scene.traverse((child: any) => {
      if (child.isMesh) meshes.push(child)
    })

    if (meshes.length === 0) throw new Error('模型中没有找到 Mesh')

    return sampleFromMeshes(meshes, count)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 从网格表面采样点云（面积加权） */
function sampleFromMeshes(meshes: THREE.Mesh[], count: number): PointCloudData {
  // 收集所有三角面
  const triangles: { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; normal: THREE.Vector3 }[] = []

  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false)
    const matrix = mesh.matrixWorld
    const geo = mesh.geometry
    const pos = geo.getAttribute('position')
    const idx = geo.getIndex()
    const edge1 = new THREE.Vector3()
    const edge2 = new THREE.Vector3()
    const faceNormal = new THREE.Vector3()

    const getVertex = (i: number) => {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(matrix)
      return v
    }

    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const a = getVertex(idx.getX(i))
        const b = getVertex(idx.getX(i + 1))
        const c = getVertex(idx.getX(i + 2))
        edge1.subVectors(b, a)
        edge2.subVectors(c, a)
        faceNormal.crossVectors(edge1, edge2).normalize()
        triangles.push({ a, b, c, normal: faceNormal.clone() })
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        const a = getVertex(i)
        const b = getVertex(i + 1)
        const c = getVertex(i + 2)
        edge1.subVectors(b, a)
        edge2.subVectors(c, a)
        faceNormal.crossVectors(edge1, edge2).normalize()
        triangles.push({ a, b, c, normal: faceNormal.clone() })
      }
    }
  }

  // 面积
  const areas = triangles.map((t) => {
    edge1.subVectors(t.b, t.a)
    edge2.subVectors(t.c, t.a)
    return edge1.cross(edge2).length() * 0.5
  })
  const totalArea = areas.reduce((s, a) => s + a, 0)
  const edge1 = new THREE.Vector3()
  const edge2 = new THREE.Vector3()

  // 按面积采样
  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    // 加权随机选三角面
    let r = Math.random() * totalArea
    let ti = 0
    for (let j = 0; j < areas.length; j++) {
      r -= areas[j]
      if (r <= 0) { ti = j; break }
    }
    const tri = triangles[ti]

    // 重心坐标采样
    let r1 = Math.random()
    let r2 = Math.random()
    if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2 }

    const p = new THREE.Vector3()
      .copy(tri.a)
      .addScaledVector(edge1.subVectors(tri.b, tri.a), r1)
      .addScaledVector(edge2.subVectors(tri.c, tri.a), r2)

    positions[i * 3] = p.x
    positions[i * 3 + 1] = p.y
    positions[i * 3 + 2] = p.z
    normals[i * 3] = tri.normal.x
    normals[i * 3 + 1] = tri.normal.y
    normals[i * 3 + 2] = tri.normal.z
  }

  return { positions, normals, count }
}

/** 加载 .bin 点云文件 */
async function loadBinFile(file: File, maxCount: number): Promise<PointCloudData> {
  const buffer = await file.arrayBuffer()
  const floats = new Float32Array(buffer)
  const stride = floats.length % 6 === 0 ? 6 : 3
  const totalCount = floats.length / stride

  // 如果点云数量超过 maxCount，随机采样子集
  const count = Math.min(totalCount, maxCount)
  let indices: number[]
  if (count < totalCount) {
    // Fisher-Yates 部分洗牌，只取前 count 个
    const allIdx = Array.from({ length: totalCount }, (_, i) => i)
    for (let i = totalCount - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allIdx[i], allIdx[j]] = [allIdx[j], allIdx[i]]
    }
    indices = allIdx.slice(0, count).sort((a, b) => a - b)
  } else {
    indices = Array.from({ length: totalCount }, (_, i) => i)
  }

  const positions = new Float32Array(count * 3)
  const normals = stride === 6 ? new Float32Array(count * 3) : undefined

  for (let i = 0; i < count; i++) {
    const src = indices[i] * stride
    const dst = i * 3
    positions[dst] = floats[src]
    positions[dst + 1] = floats[src + 1]
    positions[dst + 2] = floats[src + 2]
    if (normals && stride === 6) {
      normals[dst] = floats[src + 3]
      normals[dst + 1] = floats[src + 4]
      normals[dst + 2] = floats[src + 5]
    }
  }

  return { positions, normals, count }
}

/** 统一处理上传文件 */
async function processFile(file: File, particleCount: number): Promise<PointCloudData> {
  const type = getFileType(file.name)
  if (!type) throw new Error(`不支持的格式: ${file.name}`)
  if (type === 'bin') return loadBinFile(file, particleCount)
  return loadAndSample(file, particleCount)
}

// ─── 点云生成（测试用球体）──────────────────────────────

function useTestPointCloud(count: number): PointCloudData {
  return useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 1.5 + (Math.random() - 0.5) * 0.3
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }
    return { positions, count }
  }, [count])
}

// ─── 从点云数据计算 delays & speeds ────────────────────

function computeParticleAttrs(data: PointCloudData) {
  const { positions, count } = data
  const delays = new Float32Array(count)
  const speeds = new Float32Array(count)

  let minY = Infinity, maxY = -Infinity
  for (let i = 1; i < count * 3; i += 3) {
    minY = Math.min(minY, positions[i])
    maxY = Math.max(maxY, positions[i])
  }
  const range = maxY - minY || 1

  for (let i = 0; i < count; i++) {
    delays[i] = (positions[i * 3 + 1] - minY) / range
    speeds[i] = 0.8 + Math.random() * 0.4
  }

  return { delays, speeds }
}

// ─── 粒子组件 ───────────────────────────────────────────

interface ParticleCloudProps {
  progressRef: React.MutableRefObject<number>
  modelData: PointCloudData | null
  color: string
  pointSize: number
  particleCount: number
  dropOffset: number
  glowIntensity: number
  blendMode: 'additive' | 'normal'
}

function ParticleCloud({
  progressRef,
  modelData,
  color,
  pointSize,
  particleCount,
  dropOffset,
  glowIntensity,
  blendMode,
}: ParticleCloudProps) {
  const testData = useTestPointCloud(particleCount)
  const data = modelData ?? testData
  const { delays, speeds } = useMemo(() => computeParticleAttrs(data), [data])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    geo.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1))
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    return geo
  }, [data.positions, delays, speeds])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: particleVert,
      fragmentShader: particleFrag,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uPointSize: { value: pointSize },
        uDropOffset: { value: dropOffset },
        uGlowIntensity: { value: glowIntensity },
      },
      transparent: true,
      depthWrite: false,
      blending: blendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
  }, [])

  useEffect(() => { material.uniforms.uColor.value.set(color) }, [material, color])
  useEffect(() => { material.uniforms.uPointSize.value = pointSize }, [material, pointSize])
  useEffect(() => { material.uniforms.uDropOffset.value = dropOffset }, [material, dropOffset])
  useEffect(() => { material.uniforms.uGlowIntensity.value = glowIntensity }, [material, glowIntensity])
  useEffect(() => {
    material.blending = blendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending
    material.needsUpdate = true
  }, [material, blendMode])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime()
    material.uniforms.uProgress.value = progressRef.current
  })

  useEffect(() => {
    return () => { material.dispose() }
  }, [material])

  return <primitive object={new THREE.Points(geometry, material)} />
}

// ─── 自动播放控制器 ─────────────────────────────────────

function AutoPlayController({
  autoPlay, loop, speed, progressRef, startTimeRef, onFinish,
}: {
  autoPlay: boolean; loop: boolean; speed: number
  progressRef: React.MutableRefObject<number>
  startTimeRef: React.MutableRefObject<number>
  onFinish: () => void
}) {
  useFrame(({ clock }) => {
    if (!autoPlay) return
    const elapsed = (clock.getElapsedTime() - startTimeRef.current) * speed
    if (loop) {
      progressRef.current = (elapsed % 2) / 2
    } else {
      const p = Math.min(elapsed / 2, 1)
      progressRef.current = p
      if (p >= 1) onFinish()
    }
  })
  return null
}

// ─── 进度同步回 UI ──────────────────────────────────────

function ProgressSync({
  autoPlay, progressRef, onSync,
}: {
  autoPlay: boolean; progressRef: React.MutableRefObject<number>; onSync: (v: number) => void
}) {
  const frameCount = useRef(0)
  useFrame(() => {
    if (!autoPlay) return
    frameCount.current++
    if (frameCount.current % 3 === 0) onSync(progressRef.current)
  })
  return null
}

// ─── 时钟引用捕获 ─────────────────────────────────────

function ClockCapture({ clockRef }: { clockRef: React.MutableRefObject<THREE.Clock | null> }) {
  useFrame(({ clock }) => { clockRef.current = clock })
  return null
}

// ─── 调试面板 ───────────────────────────────────────────

function DebugPanel({
  params, finished, modelInfo, onPatch, onProgressDrag, onReplay, onUpload, onResetModel,
}: {
  params: DebugParams
  finished: boolean
  modelInfo: string
  onPatch: (p: Partial<DebugParams>) => void
  onProgressDrag: (v: number) => void
  onReplay: () => void
  onUpload: (file: File) => void
  onResetModel: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>🎛 Debug Panel</span>
        <span style={styles.panelHint}>{params.particleCount.toLocaleString()} particles</span>
      </div>

      {/* 模型上传 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>📦 Model</div>
        <div style={styles.modelInfo}>{modelInfo}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => fileRef.current?.click()} style={styles.uploadBtn}>
            📁 上传模型
          </button>
          {modelInfo !== 'Default Sphere' && (
            <button onClick={onResetModel} style={styles.resetModelBtn}>
              ↺ 恢复默认
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".gltf,.glb,.bin"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onUpload(file)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {/* Progress */}
      <div style={styles.row}>
        <label style={styles.label}>Progress</label>
        <input type="range" min={0} max={1} step={0.001}
          value={params.progress} disabled={params.autoPlay}
          onChange={(e) => onProgressDrag(parseFloat(e.target.value))}
          style={styles.slider}
        />
        <span style={styles.value}>{(params.progress * 100).toFixed(1)}%</span>
      </div>

      {/* Auto Play */}
      <div style={styles.row}>
        <label style={styles.label}>Auto Play</label>
        {finished && !params.loop ? (
          <button onClick={onReplay} style={{ ...styles.toggleBtn, background: '#f662' }}>
            🔄 重放
          </button>
        ) : (
          <button onClick={() => onPatch({ autoPlay: !params.autoPlay })}
            style={{ ...styles.toggleBtn, background: params.autoPlay ? '#0ff2' : '#fff1' }}
          >
            {params.autoPlay ? '⏸ 暂停' : '▶ 播放'}
          </button>
        )}
      </div>

      {/* Loop */}
      <div style={styles.row}>
        <label style={styles.label}>Loop</label>
        <label style={styles.checkboxLabel}>
          <input type="checkbox" checked={params.loop}
            onChange={(e) => onPatch({ loop: e.target.checked })}
            style={styles.checkbox}
          />
          {params.loop ? '循环播放' : '单次播放'}
        </label>
      </div>

      {/* Speed */}
      <div style={styles.row}>
        <label style={styles.label}>Speed</label>
        <input type="range" min={0.1} max={3} step={0.1}
          value={params.speed}
          onChange={(e) => onPatch({ speed: parseFloat(e.target.value) })}
          style={styles.slider}
        />
        <span style={styles.value}>{params.speed.toFixed(1)}x</span>
      </div>

      {/* Color */}
      <div style={styles.row}>
        <label style={styles.label}>Color</label>
        <input type="color" value={params.color}
          onChange={(e) => onPatch({ color: e.target.value })}
          style={styles.colorInput}
        />
        <span style={styles.value}>{params.color}</span>
      </div>

      {/* Point Size */}
      <div style={styles.row}>
        <label style={styles.label}>Point Size</label>
        <input type="range" min={0.1} max={10} step={0.1}
          value={params.pointSize}
          onChange={(e) => onPatch({ pointSize: parseFloat(e.target.value) })}
          style={styles.slider}
        />
        <span style={styles.value}>{params.pointSize.toFixed(1)}</span>
      </div>

      {/* Drop Offset */}
      <div style={styles.row}>
        <label style={styles.label}>Drop Offset</label>
        <input type="range" min={0} max={10} step={0.01}
          value={params.dropOffset}
          onChange={(e) => onPatch({ dropOffset: parseFloat(e.target.value) })}
          style={styles.slider}
        />
        <span style={styles.value}>{params.dropOffset.toFixed(2)}</span>
      </div>

      {/* Glow */}
      <div style={styles.row}>
        <label style={styles.label}>Glow</label>
        <input type="range" min={0} max={2} step={0.01}
          value={params.glowIntensity}
          onChange={(e) => onPatch({ glowIntensity: parseFloat(e.target.value) })}
          style={styles.slider}
        />
        <span style={styles.value}>{params.glowIntensity.toFixed(2)}</span>
      </div>

      {/* Particle Count */}
      <div style={styles.row}>
        <label style={styles.label}>Particles</label>
        <input type="range" min={100} max={10000} step={100}
          value={params.particleCount}
          onChange={(e) => onPatch({ particleCount: parseInt(e.target.value) })}
          style={styles.slider}
        />
        <input type="number" min={1} max={100000}
          value={params.particleCount}
          onChange={(e) => {
            const v = parseInt(e.target.value)
            if (!isNaN(v) && v > 0) onPatch({ particleCount: v })
          }}
          style={styles.numberInput}
        />
      </div>

      {/* Blend Mode */}
      <div style={styles.row}>
        <label style={styles.label}>Blend</label>
        <button
          onClick={() => onPatch({ blendMode: params.blendMode === 'additive' ? 'normal' : 'additive' })}
          style={styles.toggleBtn}
        >
          {params.blendMode === 'additive' ? '✨ Additive' : '🔵 Normal'}
        </button>
      </div>

      {/* Reset */}
      <div style={{ ...styles.row, justifyContent: 'center' }}>
        <button onClick={() => onPatch(DEFAULT_PARAMS)} style={styles.resetBtn}>↺ Reset All</button>
      </div>
    </div>
  )
}

// ─── App ────────────────────────────────────────────────

export default function App() {
  const [params, setParams] = useState<DebugParams>(DEFAULT_PARAMS)
  const [modelData, setModelData] = useState<PointCloudData | null>(null)
  const [modelInfo, setModelInfo] = useState('Default Sphere')
  const [loading, setLoading] = useState(false)
  const progressRef = useRef(0)
  const startTimeRef = useRef(0)
  const clockRef = useRef<THREE.Clock | null>(null)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (params.loop) setFinished(false)
  }, [params.loop])

  const handleProgressDrag = useCallback((v: number) => {
    progressRef.current = v
    setFinished(false)
    setParams((p) => ({ ...p, progress: v }))
  }, [])

  const handlePatch = useCallback((patch: Partial<DebugParams>) => {
    setParams((p) => {
      const next = { ...p, ...patch }
      // 暂停 → 恢复时，调整 startTimeRef 让动画从当前位置继续
      if (p.autoPlay && !next.autoPlay) {
        // 暂停：什么都不用做，progressRef 已经是当前值
      } else if (!p.autoPlay && next.autoPlay) {
        // 恢复：startTimeRef = 当前时钟 - 已播放时间
        const now = clockRef.current?.getElapsedTime() ?? 0
        startTimeRef.current = now - (progressRef.current * 2 / next.speed)
      }
      return next
    })
  }, [])

  const handleFinish = useCallback(() => {
    setFinished(true)
    setParams((p) => ({ ...p, autoPlay: false }))
  }, [])

  const handleReplay = useCallback(() => {
    setFinished(false)
    progressRef.current = 0
    startTimeRef.current = clockRef.current?.getElapsedTime() ?? 0
    setParams((p) => ({ ...p, autoPlay: true, progress: 0 }))
  }, [])

  const handleSync = useCallback((v: number) => {
    setParams((p) => ({ ...p, progress: v }))
  }, [])

  // 模型上传
  const handleUpload = useCallback(async (file: File) => {
    setLoading(true)
    setModelInfo(`Loading: ${file.name}`)
    try {
      const data = await processFile(file, params.particleCount)
      setModelData(data)
      setModelInfo(`${file.name} (${data.count.toLocaleString()} pts)`)
      // 重置播放
      progressRef.current = 0
      startTimeRef.current = clockRef.current?.getElapsedTime() ?? 0
      setFinished(false)
      setParams((p) => ({ ...p, autoPlay: true, progress: 0 }))
    } catch (err: any) {
      setModelInfo(`Error: ${err.message}`)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [params.particleCount])

  // 恢复默认模型
  const handleResetModel = useCallback(() => {
    setModelData(null)
    setModelInfo('Default Sphere')
    progressRef.current = 0
    startTimeRef.current = clockRef.current?.getElapsedTime() ?? 0
    setFinished(false)
    setParams((p) => ({ ...p, autoPlay: true, progress: 0 }))
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas camera={{ position: [0, 0, 4], fov: 60 }}>
        <color attach="background" args={['#000000']} />
        <ParticleCloud
          progressRef={progressRef}
          modelData={modelData}
          color={params.color}
          pointSize={params.pointSize}
          particleCount={params.particleCount}
          dropOffset={params.dropOffset}
          glowIntensity={params.glowIntensity}
          blendMode={params.blendMode}
        />
        <AutoPlayController
          autoPlay={params.autoPlay}
          loop={params.loop}
          speed={params.speed}
          progressRef={progressRef}
          startTimeRef={startTimeRef}
          onFinish={handleFinish}
        />
        <ProgressSync autoPlay={params.autoPlay} progressRef={progressRef} onSync={handleSync} />
        <OrbitControls enableDamping />
        <ClockCapture clockRef={clockRef} />
      </Canvas>

      <div style={styles.title}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>3D Particle Printer — Demo</h1>
        <p style={{ fontSize: '0.9rem', opacity: 0.6, marginTop: 8 }}>
          明日方舟：终末地 官网 3D 模型打印动效复刻
        </p>
        {loading && <p style={{ fontSize: '0.8rem', color: '#ff0', marginTop: 4 }}>⏳ 加载中...</p>}
      </div>

      <DebugPanel
        params={params}
        finished={finished}
        modelInfo={modelInfo}
        onPatch={handlePatch}
        onProgressDrag={handleProgressDrag}
        onReplay={handleReplay}
        onUpload={handleUpload}
        onResetModel={handleResetModel}
      />
    </div>
  )
}

// ─── 样式 ───────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  title: {
    position: 'absolute', top: 20, left: 0, right: 0,
    textAlign: 'center', color: '#0ff', fontFamily: 'monospace', pointerEvents: 'none',
  },
  panel: {
    position: 'absolute', top: 16, right: 16, width: 280,
    background: '#0a0a0aee', border: '1px solid #0ff3', borderRadius: 8,
    padding: 12, fontFamily: 'monospace', fontSize: 12, color: '#ccc',
    backdropFilter: 'blur(12px)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
  },
  panelHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #0ff2',
  },
  panelTitle: { color: '#0ff', fontSize: 13, fontWeight: 'bold' },
  panelHint: { color: '#0ff8', fontSize: 10 },
  section: {
    marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #0ff2',
  },
  sectionTitle: {
    color: '#0ff', fontSize: 11, marginBottom: 6, fontWeight: 'bold',
  },
  modelInfo: {
    color: '#888', fontSize: 10, marginBottom: 6,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  uploadBtn: {
    flex: 1, background: '#0ff2', color: '#0ff', border: '1px solid #0ff3',
    borderRadius: 4, padding: '5px 8px', fontSize: 11, fontFamily: 'monospace',
    cursor: 'pointer', textAlign: 'center' as const,
  },
  resetModelBtn: {
    background: '#fff1', color: '#888', border: '1px solid #fff2',
    borderRadius: 4, padding: '5px 8px', fontSize: 10, fontFamily: 'monospace',
    cursor: 'pointer',
  },
  row: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  label: { width: 72, flexShrink: 0, color: '#888', fontSize: 11 },
  slider: { flex: 1, height: 4, accentColor: '#0ff', cursor: 'pointer' },
  value: { width: 48, textAlign: 'right', color: '#0ff', fontSize: 11, flexShrink: 0 },
  colorInput: { width: 32, height: 24, border: 'none', background: 'none', cursor: 'pointer' },
  numberInput: {
    width: 56, background: '#111', color: '#0ff', border: '1px solid #0ff3',
    borderRadius: 4, padding: '2px 6px', fontSize: 11, fontFamily: 'monospace',
    textAlign: 'right' as const,
  },
  checkboxLabel: {
    flex: 1, display: 'flex', alignItems: 'center', gap: 6,
    color: '#0ff', fontSize: 11, cursor: 'pointer',
  },
  checkbox: { accentColor: '#0ff', cursor: 'pointer', width: 14, height: 14 },
  toggleBtn: {
    flex: 1, background: '#fff1', color: '#0ff', border: '1px solid #0ff3',
    borderRadius: 4, padding: '4px 8px', fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
  },
  resetBtn: {
    background: 'none', color: '#f66', border: '1px solid #f663',
    borderRadius: 4, padding: '4px 16px', fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
  },
}
