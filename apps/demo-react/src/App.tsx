import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import particleVert from './shaders/particle.vert'
import particleFrag from './shaders/particle.frag'

/**
 * 生成测试用的点云数据 — 一个球形粒子云
 */
function useTestPointCloud(count = 30000) {
  return useMemo(() => {
    const positions = new Float32Array(count * 3)
    const delays = new Float32Array(count)
    const speeds = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // 球形分布
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 1.5 + (Math.random() - 0.5) * 0.3

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // 归一化 Y 值作为延迟
      const y = positions[i * 3 + 1]
      delays[i] = (y + 1.5) / 3 // 归一化到 0~1
      speeds[i] = 0.8 + Math.random() * 0.4
    }

    return { positions, delays, speeds, count }
  }, [count])
}

/**
 * 粒子打印效果组件
 */
function ParticleCloud() {
  const pointsRef = useRef<THREE.Points>(null!)
  const materialRef = useRef<THREE.ShaderMaterial>(null!)
  const { positions, delays, speeds, count } = useTestPointCloud()

  // 自动循环播放进度
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // 循环播放：每 4 秒一个周期
    const progress = (t % 4) / 4
    if (materialRef.current) {
      materialRef.current.uniforms.uProgress.value = progress
      materialRef.current.uniforms.uTime.value = t
    }
  })

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1))
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    return geo
  }, [positions, delays, speeds])

  return (
    <points ref={pointsRef} geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={particleVert}
        fragmentShader={particleFrag}
        uniforms={{
          uTime: { value: 0 },
          uProgress: { value: 0 },
          uColor: { value: new THREE.Color(0x00ffff) },
          uPointSize: { value: 3.0 },
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas camera={{ position: [0, 0, 4], fov: 60 }}>
        <color attach="background" args={['#000000']} />
        <ambientLight intensity={0.5} />
        <ParticleCloud />
        <OrbitControls enableDamping />
      </Canvas>

      {/* 标题 */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 0,
        right: 0,
        textAlign: 'center',
        color: '#0ff',
        fontFamily: 'monospace',
        pointerEvents: 'none',
      }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>
          3D Particle Printer — Demo
        </h1>
        <p style={{ fontSize: '0.9rem', opacity: 0.6, marginTop: 8 }}>
          明日方舟：终末地 官网 3D 模型打印动效复刻
        </p>
      </div>
    </div>
  )
}
