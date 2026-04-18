// Scene — lighting + environment rig. Full impl lands in M2 (T16).

import { Environment } from '@react-three/drei'

export function Scene({ environment, toneMapping = 'NeutralToneMapping', exposure = 1.0, envIntensity = 1.0, children }) {
  const envFiles = environment == null
    ? null
    : (typeof environment === 'string' ? environment : environment.hdri)

  return (
    <>
      <color attach="background" args={[0, 0, 0]} />
      <ambientLight intensity={0.5} color={0x404040} />
      <directionalLight position={[2, 3, 4]} intensity={1.5} color={0xffffff} />
      {envFiles && <Environment files={envFiles} environmentIntensity={envIntensity} />}
      <group userData={{ toneMapping, exposure }}>
        {children}
      </group>
    </>
  )
}
