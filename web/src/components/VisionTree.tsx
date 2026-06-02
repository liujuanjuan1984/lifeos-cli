import React, { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vision } from "@/services/api";
import { useTreeConfig } from "@/hooks/useTreeConfig";

interface VisionTreeProps {
  vision: Vision;
  isSelected: boolean;
  onClick: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

/**
 * VisionTree - 3D representation of a single vision as a tree
 *
 * The tree's appearance changes based on the vision's stage (0-10):
 * - Stage 0: Small seed/sprout
 * - Stage 1: Young sapling
 * - Stage 2: Small tree
 * - Stage 3: Growing tree
 * - Stage 4: Mature tree
 * - Stage 5: Blooming tree
 * - Stage 6: Fruiting tree
 * - Stage 7: Harvest tree
 * - Stage 8: Bountiful tree
 * - Stage 9: Perfect tree
 * - Stage 10: Full grown tree ready for harvest
 */
const VisionTree: React.FC<VisionTreeProps> = ({
  vision,
  isSelected,
  onClick,
  onHoverStart,
  onHoverEnd,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const experienceParticlesRef = useRef<THREE.InstancedMesh>(null);

  // Use unified tree configuration
  const treeConfig = useTreeConfig(vision.stage);

  // Gentle floating animation for selected tree
  useFrame((state) => {
    if (meshRef.current && isSelected) {
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.05;
    } else if (meshRef.current) {
      meshRef.current.position.y = 0;
    }
  });

  // New: Position the instanced experience particles
  useEffect(() => {
    if (!experienceParticlesRef.current) return;

    const count = Math.min(vision.experience_points / 50, 10);
    const tempMatrix = new THREE.Matrix4();

    for (let i = 0; i < count; i++) {
      // 计算每个粒子的随机位置，逻辑和之前 .map() 版本一样
      const x = (Math.random() - 0.5) * treeConfig.crownRadius * 1.5;
      const y = treeConfig.trunkHeight + Math.random() * treeConfig.crownHeight;
      const z = (Math.random() - 0.5) * treeConfig.crownRadius * 1.5;

      // 设置该实例的位置
      tempMatrix.setPosition(x, y, z);
      experienceParticlesRef.current.setMatrixAt(i, tempMatrix);
    }

    // 非常重要：更新矩阵以应用更改
    experienceParticlesRef.current.instanceMatrix.needsUpdate = true;
  }, [vision.experience_points, treeConfig]); // 当经验值或树的大小变化时，重新计算粒子位置

  return (
    <group
      ref={meshRef}
      onClick={onClick}
      onPointerOver={onHoverStart}
      onPointerOut={onHoverEnd}
    >
      {/* Tree trunk */}
      <mesh position={[0, treeConfig.trunkHeight / 2, 0]}>
        <cylinderGeometry
          args={[
            treeConfig.trunkRadius,
            treeConfig.trunkRadius * 1.2,
            treeConfig.trunkHeight,
            8,
          ]}
        />
        <meshStandardMaterial color="#8B4513" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Tree crown/foliage */}
      <mesh
        position={[0, treeConfig.trunkHeight + treeConfig.crownHeight / 2, 0]}
      >
        <sphereGeometry args={[treeConfig.crownRadius, 12, 8]} />
        <meshStandardMaterial
          color={treeConfig.color}
          roughness={0.6}
          metalness={0.0}
          emissive={isSelected ? treeConfig.color : "#000000"}
          emissiveIntensity={isSelected ? 0.2 : 0}
        />
      </mesh>

      {/* Selection indicator ring */}
      {isSelected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry
            args={[
              treeConfig.crownRadius * 1.2,
              treeConfig.crownRadius * 1.4,
              32,
            ]}
          />
          <meshBasicMaterial color="#FFD700" transparent opacity={0.6} />
        </mesh>
      )}

      {/* Experience points indicator with instancing for performance */}
      {vision.experience_points > 0 && (
        <instancedMesh
          ref={experienceParticlesRef}
          args={[
            undefined,
            undefined,
            Math.min(vision.experience_points / 50, 10),
          ]}
        >
          <sphereGeometry args={[0.03]} />
          <meshStandardMaterial
            color="#FFD700"
            emissive="#FFD700"
            emissiveIntensity={0.8}
            transparent
            opacity={0.8}
          />
        </instancedMesh>
      )}

      {/* Tree base/roots indicator */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[treeConfig.trunkRadius * 2]} />
        <meshStandardMaterial
          color="#8B4513"
          roughness={1.0}
          metalness={0.0}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
};

export default VisionTree;
