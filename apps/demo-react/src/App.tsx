import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import particleVert from './shaders/particle.vert'
import particleFrag from './shaders/particle.frag'

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

// ─── 点云生成 ───────────────────────────────────────────

function useTestPointCloud(count: number) {
  return useMemo(() => {
    const positions = new Float32Array(count * 3)
    const delays = new Float32Array(count)
    const speeds = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 1.5 + (Math.random() - 0.5) * 0.3

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      const y = positions[i * 3 + 1]
      delays[i] = (y + 1.5) / 3
      speeds[i] = 0.8 + Math.random() * 0.4
    }

    return { positions, delays, speeds, count }
  }, [count])
}

// ─── 粒子组件 ───────────────────────────────────────────

interface ParticleCloudProps {
  progressRef: React.MutableRefObject<number>
  color: string
  pointSize: number
  particleCount: number
  dropOffset: number
  glowIntensity: number
  blendMode: 'additive' | 'normal'
}

function ParticleCloud({
  progressRef,
  color,
  pointSize,
  particleCount,
  dropOffset,
  glowIntensity,
  blendMode,
}: ParticleCloudProps) {
  const { positions, delays, speeds, count } = useTestPointCloud(particleCount)

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1))
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    return geo
  }, [positions, delays, speeds])

  // 手动创建材质，不会因 re-render 重建
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
  }, []) // 只创建一次

  // 非动画参数同步
  useEffect(() => { material.uniforms.uColor.value.set(color) }, [material, color])
  useEffect(() => { material.uniforms.uPointSize.value = pointSize }, [material, pointSize])
  useEffect(() => { material.uniforms.uDropOffset.value = dropOffset }, [material, dropOffset])
  useEffect(() => { material.uniforms.uGlowIntensity.value = glowIntensity }, [material, glowIntensity])
  useEffect(() => {
    material.blending = blendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending
    material.needsUpdate = true
  }, [material, blendMode])

  // 每帧从 ref 读 progress，直接写 uniform
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime()
    material.uniforms.uProgress.value = progressRef.current
  })

  // 组件卸载时释放
  useEffect(() => {
    return () => { material.dispose() }
  }, [material])

  return <primitive object={new THREE.Points(geometry, material)} />
}

// ─── 自动播放控制器 ─────────────────────────────────────

function AutoPlayController({
  autoPlay,
  loop,
  speed,
  progressRef,
}: {
  autoPlay: boolean
  loop: boolean
  speed: number
  progressRef: React.MutableRefObject<number>
}) {
  useFrame(({ clock }) => {
    if (!autoPlay) return
    const t = clock.getElapsedTime() * speed
    if (loop) {
      progressRef.current = (t % 2) / 2
    } else {
      progressRef.current = Math.min(t / 2, 1) // 播放到 1 就停
    }
  })
  return null
}

// ─── 进度同步回 UI ──────────────────────────────────────

function ProgressSync({
  autoPlay,
  progressRef,
  onSync,
}: {
  autoPlay: boolean
  progressRef: React.MutableRefObject<number>
  onSync: (v: number) => void
}) {
  const frameCount = useRef(0)
  useFrame(() => {
    if (!autoPlay) return
    frameCount.current++
    if (frameCount.current % 3 === 0) {
      onSync(progressRef.current)
    }
  })
  return null
}

// ─── 调试面板 ───────────────────────────────────────────

function DebugPanel({
  params,
  onPatch,
  onProgressDrag,
}: {
  params: DebugParams
  onPatch: (p: Partial<DebugParams>) => void
  onProgressDrag: (v: number) => void
}) {
  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>🎛 Debug Panel</span>
        <span style={styles.panelHint}>{params.particleCount.toLocaleString()} particles</span>
      </div>

      {/* Progress */}
      <div style={styles.row}>
        <label style={styles.label}>Progress</label>
        <input
          type="range" min={0} max={1} step={0.001}
          value={params.progress}
          disabled={params.autoPlay}
          onChange={(e) => onProgressDrag(parseFloat(e.target.value))}
          style={styles.slider}
        />
        <span style={styles.value}>{(params.progress * 100).toFixed(1)}%</span>
      </div>

      {/* Auto Play */}
      <div style={styles.row}>
        <label style={styles.label}>Auto Play</label>
        <button
          onClick={() => onPatch({ autoPlay: !params.autoPlay })}
          style={{ ...styles.toggleBtn, background: params.autoPlay ? '#0ff2' : '#fff1' }}
        >
          {params.autoPlay ? '⏸ 暂停' : '▶ 播放'}
        </button>
      </div>

      {/* Loop */}
      <div style={styles.row}>
        <label style={styles.label}>Loop</label>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={params.loop}
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
        <input type="range" min={0.5} max={10} step={0.1}
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
        <input
          type="number"
          min={1}
          max={100000}
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
        <button onClick={() => onPatch(DEFAULT_PARAMS)} style={styles.resetBtn}>↺ Reset</button>
      </div>
    </div>
  )
}

// ─── App ────────────────────────────────────────────────

export default function App() {
  const [params, setParams] = useState<DebugParams>(DEFAULT_PARAMS)
  const progressRef = useRef(0)

  // 手动拖拽：直接写 ref + 更新 state
  const handleProgressDrag = useCallback((v: number) => {
    progressRef.current = v
    setParams((p) => ({ ...p, progress: v }))
  }, [])

  // 面板参数 patch
  const handlePatch = useCallback((patch: Partial<DebugParams>) => {
    setParams((p) => ({ ...p, ...patch }))
  }, [])

  // 自动播放时同步进度到 UI
  const handleSync = useCallback((v: number) => {
    setParams((p) => ({ ...p, progress: v }))
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas camera={{ position: [0, 0, 4], fov: 60 }}>
        <color attach="background" args={['#000000']} />
        <ParticleCloud
          progressRef={progressRef}
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
        />
        <ProgressSync
          autoPlay={params.autoPlay}
          progressRef={progressRef}
          onSync={handleSync}
        />
        <OrbitControls enableDamping />
      </Canvas>

      {/* 标题 */}
      <div style={styles.title}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>3D Particle Printer — Demo</h1>
        <p style={{ fontSize: '0.9rem', opacity: 0.6, marginTop: 8 }}>
          明日方舟：终末地 官网 3D 模型打印动效复刻
        </p>
      </div>

      {/* 调试面板 */}
      <DebugPanel
        params={params}
        onPatch={handlePatch}
        onProgressDrag={handleProgressDrag}
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
    backdropFilter: 'blur(12px)',
  },
  panelHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #0ff2',
  },
  panelTitle: { color: '#0ff', fontSize: 13, fontWeight: 'bold' },
  panelHint: { color: '#0ff8', fontSize: 10 },
  row: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  label: { width: 72, flexShrink: 0, color: '#888', fontSize: 11 },
  slider: { flex: 1, height: 4, accentColor: '#0ff', cursor: 'pointer' },
  value: { width: 48, textAlign: 'right', color: '#0ff', fontSize: 11, flexShrink: 0 },
  colorInput: { width: 32, height: 24, border: 'none', background: 'none', cursor: 'pointer' },
  select: {
    flex: 1, background: '#111', color: '#0ff', border: '1px solid #0ff3',
    borderRadius: 4, padding: '2px 6px', fontSize: 11, fontFamily: 'monospace',
  },
  numberInput: {
    width: 56, background: '#111', color: '#0ff', border: '1px solid #0ff3',
    borderRadius: 4, padding: '2px 6px', fontSize: 11, fontFamily: 'monospace',
    textAlign: 'right' as const,
  },
  checkboxLabel: {
    flex: 1, display: 'flex', alignItems: 'center', gap: 6,
    color: '#0ff', fontSize: 11, cursor: 'pointer',
  },
  checkbox: {
    accentColor: '#0ff', cursor: 'pointer', width: 14, height: 14,
  },
  toggleBtn: {
    flex: 1, background: '#fff1', color: '#0ff', border: '1px solid #0ff3',
    borderRadius: 4, padding: '4px 8px', fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
  },
  resetBtn: {
    background: 'none', color: '#f66', border: '1px solid #f663',
    borderRadius: 4, padding: '4px 16px', fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
  },
}
