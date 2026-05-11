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
  speed: 1.0,
  color: '#00ffff',
  pointSize: 3.0,
  particleCount: 30000,
  dropOffset: 0.5,
  glowIntensity: 0.6,
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

function ParticleCloud({ params }: { params: DebugParams }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null!)
  const { positions, delays, speeds, count } = useTestPointCloud(params.particleCount)

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1))
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    return geo
  }, [positions, delays, speeds])

  useFrame(({ clock }) => {
    const mat = materialRef.current
    if (!mat) return
    mat.uniforms.uTime.value = clock.getElapsedTime()
    // progress 由外部控制，这里不自动更新
  })

  // 同步外部参数到 uniform
  useEffect(() => {
    const mat = materialRef.current
    if (!mat) return
    mat.uniforms.uProgress.value = params.progress
    mat.uniforms.uColor.value.set(params.color)
    mat.uniforms.uPointSize.value = params.pointSize
    mat.uniforms.uDropOffset.value = params.dropOffset
    mat.uniforms.uGlowIntensity.value = params.glowIntensity
  }, [params])

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={particleVert}
        fragmentShader={particleFrag}
        uniforms={{
          uTime: { value: 0 },
          uProgress: { value: params.progress },
          uColor: { value: new THREE.Color(params.color) },
          uPointSize: { value: params.pointSize },
          uDropOffset: { value: params.dropOffset },
          uGlowIntensity: { value: params.glowIntensity },
        }}
        transparent
        depthWrite={false}
        blending={params.blendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </points>
  )
}

// ─── 自动播放控制器 ─────────────────────────────────────

function AutoPlayController({
  autoPlay,
  speed,
  onProgressChange,
}: {
  autoPlay: boolean
  speed: number
  onProgressChange: (v: number) => void
}) {
  useFrame(({ clock }) => {
    if (!autoPlay) return
    const t = clock.getElapsedTime() * speed
    const progress = (t % 2) / 2 // 2 秒一个周期
    onProgressChange(progress)
  })
  return null
}

// ─── 调试面板 ───────────────────────────────────────────

function DebugPanel({
  params,
  onParamsChange,
}: {
  params: DebugParams
  onParamsChange: (p: DebugParams) => void
}) {
  const update = useCallback(
    (key: keyof DebugParams, value: DebugParams[keyof DebugParams]) => {
      onParamsChange({ ...params, [key]: value })
    },
    [params, onParamsChange]
  )

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>🎛 Debug Panel</span>
        <span style={styles.panelHint}>粒子数: {params.particleCount.toLocaleString()}</span>
      </div>

      {/* Progress */}
      <div style={styles.row}>
        <label style={styles.label}>Progress</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={params.progress}
          disabled={params.autoPlay}
          onChange={(e) => update('progress', parseFloat(e.target.value))}
          style={styles.slider}
        />
        <span style={styles.value}>{(params.progress * 100).toFixed(1)}%</span>
      </div>

      {/* Auto Play */}
      <div style={styles.row}>
        <label style={styles.label}>Auto Play</label>
        <button
          onClick={() => update('autoPlay', !params.autoPlay)}
          style={{
            ...styles.toggleBtn,
            background: params.autoPlay ? '#0ff2' : '#fff1',
          }}
        >
          {params.autoPlay ? '⏸ 暂停' : '▶ 播放'}
        </button>
      </div>

      {/* Speed */}
      <div style={styles.row}>
        <label style={styles.label}>Speed</label>
        <input
          type="range"
          min={0.1}
          max={3}
          step={0.1}
          value={params.speed}
          onChange={(e) => update('speed', parseFloat(e.target.value))}
          style={styles.slider}
        />
        <span style={styles.value}>{params.speed.toFixed(1)}x</span>
      </div>

      {/* Color */}
      <div style={styles.row}>
        <label style={styles.label}>Color</label>
        <input
          type="color"
          value={params.color}
          onChange={(e) => update('color', e.target.value)}
          style={styles.colorInput}
        />
        <span style={styles.value}>{params.color}</span>
      </div>

      {/* Point Size */}
      <div style={styles.row}>
        <label style={styles.label}>Point Size</label>
        <input
          type="range"
          min={0.5}
          max={10}
          step={0.1}
          value={params.pointSize}
          onChange={(e) => update('pointSize', parseFloat(e.target.value))}
          style={styles.slider}
        />
        <span style={styles.value}>{params.pointSize.toFixed(1)}</span>
      </div>

      {/* Drop Offset */}
      <div style={styles.row}>
        <label style={styles.label}>Drop Offset</label>
        <input
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={params.dropOffset}
          onChange={(e) => update('dropOffset', parseFloat(e.target.value))}
          style={styles.slider}
        />
        <span style={styles.value}>{params.dropOffset.toFixed(2)}</span>
      </div>

      {/* Glow Intensity */}
      <div style={styles.row}>
        <label style={styles.label}>Glow</label>
        <input
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={params.glowIntensity}
          onChange={(e) => update('glowIntensity', parseFloat(e.target.value))}
          style={styles.slider}
        />
        <span style={styles.value}>{params.glowIntensity.toFixed(2)}</span>
      </div>

      {/* Particle Count */}
      <div style={styles.row}>
        <label style={styles.label}>Particles</label>
        <select
          value={params.particleCount}
          onChange={(e) => update('particleCount', parseInt(e.target.value))}
          style={styles.select}
        >
          <option value={10000}>10,000</option>
          <option value={30000}>30,000</option>
          <option value={50000}>50,000</option>
          <option value={100000}>100,000</option>
        </select>
      </div>

      {/* Blend Mode */}
      <div style={styles.row}>
        <label style={styles.label}>Blend</label>
        <button
          onClick={() => update('blendMode', params.blendMode === 'additive' ? 'normal' : 'additive')}
          style={styles.toggleBtn}
        >
          {params.blendMode === 'additive' ? '✨ Additive' : '🔵 Normal'}
        </button>
      </div>

      {/* Reset */}
      <div style={{ ...styles.row, justifyContent: 'center' }}>
        <button onClick={() => onParamsChange(DEFAULT_PARAMS)} style={styles.resetBtn}>
          ↺ Reset
        </button>
      </div>
    </div>
  )
}

// ─── App ────────────────────────────────────────────────

export default function App() {
  const [params, setParams] = useState<DebugParams>(DEFAULT_PARAMS)

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas camera={{ position: [0, 0, 4], fov: 60 }}>
        <color attach="background" args={['#000000']} />
        <ambientLight intensity={0.5} />
        <ParticleCloud params={params} />
        <AutoPlayController
          autoPlay={params.autoPlay}
          speed={params.speed}
          onProgressChange={(v) => setParams((p) => ({ ...p, progress: v }))}
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
      <DebugPanel params={params} onParamsChange={setParams} />
    </div>
  )
}

// ─── 样式 ───────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  title: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#0ff',
    fontFamily: 'monospace',
    pointerEvents: 'none',
  },
  panel: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 280,
    background: '#0a0a0aee',
    border: '1px solid #0ff3',
    borderRadius: 8,
    padding: 12,
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#ccc',
    backdropFilter: 'blur(12px)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid #0ff2',
  },
  panelTitle: {
    color: '#0ff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  panelHint: {
    color: '#0ff8',
    fontSize: 10,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  label: {
    width: 72,
    flexShrink: 0,
    color: '#888',
    fontSize: 11,
  },
  slider: {
    flex: 1,
    height: 4,
    accentColor: '#0ff',
    cursor: 'pointer',
  },
  value: {
    width: 48,
    textAlign: 'right',
    color: '#0ff',
    fontSize: 11,
    flexShrink: 0,
  },
  colorInput: {
    width: 32,
    height: 24,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
  },
  select: {
    flex: 1,
    background: '#111',
    color: '#0ff',
    border: '1px solid #0ff3',
    borderRadius: 4,
    padding: '2px 6px',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  toggleBtn: {
    flex: 1,
    background: '#fff1',
    color: '#0ff',
    border: '1px solid #0ff3',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 11,
    fontFamily: 'monospace',
    cursor: 'pointer',
  },
  resetBtn: {
    background: 'none',
    color: '#f66',
    border: '1px solid #f663',
    borderRadius: 4,
    padding: '4px 16px',
    fontSize: 11,
    fontFamily: 'monospace',
    cursor: 'pointer',
  },
}
