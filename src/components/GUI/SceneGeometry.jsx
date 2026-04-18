export function SceneGeometry({ kind, children }) {
  const geometryNode = (() => {
    switch (kind) {
      case 'cube':
      case 'box':
        return <boxGeometry args={[1, 1, 1]} />
      case 'cylinder':
        return <cylinderGeometry args={[0.5, 0.5, 1, 64, 1]} />
      case 'torus':
        return <torusGeometry args={[0.7, 0.25, 32, 64]} />
      case 'plane':
        return <planeGeometry args={[1.5, 1.5]} />
      case 'sphere':
      default:
        return <sphereGeometry args={[1, 64, 64]} />
    }
  })()

  return (
    <mesh>
      {geometryNode}
      {children}
    </mesh>
  )
}
