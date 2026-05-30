import { Suspense, useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

// Three.js sphere with Insta-gradient internal glow + iridescent surface. Spins
// on its Y axis like a globe. Used in LoginPage during the connecting phase.
//
// Lazy-load this component (React.lazy) so the ~600 KB three.js bundle doesn't
// block the login page's first paint. While the chunk loads, the parent shows
// the regular PastelVoiceOrb.

const INSTA = {
  yellow: new THREE.Color("#feda77"),
  pink: new THREE.Color("#dd2a7b"),
  purple: new THREE.Color("#8134af"),
}

function GradientSphere({ spinning, isMobile }) {
  const meshRef = useRef(null)
  const haloRef = useRef(null)

  // Vertex-colored sphere. Lower segment count on mobile — at orbSize=170
  // (340 device pixels at 2x DPR) the difference between 96² and 48² is
  // invisible, but the GPU/CPU cost difference is real.
  const geometry = useMemo(() => {
    const segments = isMobile ? 48 : 64
    const g = new THREE.SphereGeometry(1, segments, segments)
    const colors = []
    // Scratch Color objects mutated in place — avoids ~thousands of
    // transient allocations on first mount.
    const top = new THREE.Color()
    const bottom = new THREE.Color()
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const y = (pos.getY(i) + 1) / 2 // 0..1, bottom→top
      if (y > 0.5) {
        top.copy(INSTA.yellow).lerp(INSTA.pink, (1 - y) * 2)
        colors.push(top.r, top.g, top.b)
      } else {
        bottom.copy(INSTA.pink).lerp(INSTA.purple, 1 - y * 2)
        colors.push(bottom.r, bottom.g, bottom.b)
      }
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
    return g
  }, [isMobile])

  useFrame((_, delta) => {
    if (meshRef.current) {
      // Always rotate a touch (idle drift), much faster when spinning.
      meshRef.current.rotation.y += delta * (spinning ? 1.6 : 0.25)
      meshRef.current.rotation.x += delta * (spinning ? 0.15 : 0.04)
    }
    if (haloRef.current) {
      haloRef.current.rotation.z += delta * (spinning ? -0.4 : -0.1)
    }
  })

  return (
    <group>
      {/* Soft atmospheric halo — slightly larger sphere with additive blending */}
      <mesh ref={haloRef} scale={1.18}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={INSTA.pink}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Sphere material: rich physical (iridescent gloss + clearcoat) on
          desktop where the effect actually shows; cheaper standard material
          on mobile where the 170px canvas + 2x DPR can't resolve the
          difference but pays the BRDF cost. */}
      <mesh ref={meshRef} geometry={geometry}>
        {isMobile ? (
          <meshStandardMaterial
            vertexColors
            roughness={0.32}
            metalness={0.06}
            emissive={INSTA.pink}
            emissiveIntensity={0.14}
          />
        ) : (
          <meshPhysicalMaterial
            vertexColors
            roughness={0.18}
            metalness={0.05}
            clearcoat={1}
            clearcoatRoughness={0.08}
            iridescence={0.6}
            iridescenceIOR={1.3}
            iridescenceThicknessRange={[100, 800]}
            envMapIntensity={0.9}
            emissive={INSTA.pink}
            emissiveIntensity={0.12}
          />
        )}
      </mesh>
    </group>
  )
}

export function Globe3D({ size = 280, spinning = false, isMobile = false }) {
  return (
    <div
      style={{ width: size, height: size }}
      aria-hidden="true"
      className="select-none"
    >
      <Canvas
        camera={{ position: [0, 0, 2.6], fov: 45 }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.45} />
        {/* warm key light, top-right */}
        <directionalLight position={[2.5, 2.5, 2]} intensity={1.1} color="#fff3d6" />
        {/* cool fill, bottom-left */}
        <directionalLight position={[-2, -1.5, 1.5]} intensity={0.55} color="#bcd4ff" />
        {/* tinted rim */}
        <pointLight position={[0, 0, -2]} intensity={0.5} color="#dd2a7b" />

        <Suspense fallback={null}>
          <GradientSphere spinning={spinning} isMobile={isMobile} />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default Globe3D
