import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import VisionTree from "./VisionTree";
import TaskSatellites from "./TaskSatellites";

import type { Vision, Task } from "@/services/api";
import { useTheme } from "@/contexts/ThemeContext";
import type { UUID } from "@/types/primitive";
import { useVisionOrchardData } from "@/features/visions/controller/useVisionOrchardData";

interface VisionOrchardProps {
  onVisionHover: (
    vision: (Vision & { tasks: Task[]; totalTime: number }) | null,
  ) => void;
  showSectorLines?: boolean; // Control sector lines visibility
  statusFilter?: string; // Control which status visions to show
  dimensionFilter?: UUID | null;
}

/**
 * VisionOrchard - The main 3D orchard scene for v0.5
 *
 * This component implements the "fruit orchard" metaphor where each vision
 * is represented as a tree in different growth stages, with tasks as
 * satellites orbiting around their respective trees.
 */
const VisionOrchard: React.FC<VisionOrchardProps> = ({
  onVisionHover,
  showSectorLines = false,
  statusFilter = "active",
  dimensionFilter,
}) => {
  const { isDark } = useTheme();
  const [selectedVision, setSelectedVision] = useState<Vision | null>(null);
  const { visions, visionTasks, loading } = useVisionOrchardData({
    statusFilter,
    dimensionFilter,
  });

  // Theme-aware colors for 3D materials
  const textColor = isDark ? "#f3f4f6" : "#ffffff"; // base-content for dark, white for light

  // Performance optimization: Instanced meshes
  const ambientParticlesRef = useRef<THREE.InstancedMesh>(null);

  // Handle vision click for selection
  const handleVisionClick = (vision: Vision) => {
    setSelectedVision(selectedVision?.id === vision.id ? null : vision);
  };

  // Performance optimization: Animate ambient particles
  useFrame((state) => {
    if (ambientParticlesRef.current) {
      const time = state.clock.elapsedTime;
      for (let i = 0; i < 20; i++) {
        const matrix = new THREE.Matrix4();
        const x = (Math.random() - 0.5) * 20;
        const y = Math.random() * 3 + 1 + Math.sin(time + i) * 0.1;
        const z = (Math.random() - 0.5) * 20;
        matrix.setPosition(x, y, z);
        ambientParticlesRef.current.setMatrixAt(i, matrix);
      }
      ambientParticlesRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  if (loading) {
    return (
      <group>
        {/* Simple loading indicator */}
        <mesh position={[0, 1, 0]}>
          <sphereGeometry args={[0.2]} />
          <meshStandardMaterial
            color="#8FBC8F"
            emissive="#8FBC8F"
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* Loading text plane */}
        <mesh position={[0, 0.5, 0]} rotation={[0, 0, 0]}>
          <planeGeometry args={[3, 0.5]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
      </group>
    );
  }

  // If no visions exist, show empty orchard with hint
  if (visions.length === 0) {
    return (
      <group>
        {/* Empty orchard ground marker */}
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2]} />
          <meshStandardMaterial color="#90EE90" transparent opacity={0.6} />
        </mesh>

        {/* Hint text for creating first vision */}
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshStandardMaterial
            color="#FFD700"
            emissive="#FFD700"
            emissiveIntensity={0.2}
          />
        </mesh>
      </group>
    );
  }

  // Calculate positions for trees in a circular arrangement
  // Trees with higher stages get larger angle segments
  const getTreePosition = (
    index: number,
    total: number,
  ): [number, number, number] => {
    if (total === 1) {
      // Place single vision tree in the outer circle, not at center
      const defaultRadius = 3;
      return [defaultRadius, 0, 0];
    }

    // Calculate base radius based on tree count and stages
    const baseRadius = Math.max(3, total * 0.8); // Minimum radius of 3, scales with tree count
    const averageStage =
      visions.reduce((sum, vision) => sum + 0.25 * vision.stage, 0) / total;
    const stageRadius = baseRadius + averageStage * 0.3; // Add stage bonus to radius
    const radius = stageRadius;

    // Calculate total weight based on all tree stages (add 1 to ensure stage 0 trees get space)
    const totalWeight = visions.reduce(
      (sum, vision) => sum + 0.25 * vision.stage + 1,
      0,
    );

    // Calculate cumulative weight up to current index
    let cumulativeWeight = 0;
    for (let i = 0; i < index; i++) {
      cumulativeWeight += 0.25 * visions[i].stage + 1;
    }

    // Calculate the start angle of this tree's sector
    const startAngle = (cumulativeWeight / totalWeight) * Math.PI * 2;

    // Calculate the end angle of this tree's sector
    const endAngle =
      ((cumulativeWeight + 0.25 * visions[index].stage + 1) / totalWeight) *
      Math.PI *
      2;

    // Place tree at the center of its sector
    const centerAngle = (startAngle + endAngle) / 2;

    const x = Math.cos(centerAngle) * radius;
    const z = Math.sin(centerAngle) * radius;
    return [x, 0, z];
  };

  return (
    <group>
      {/* Render all vision trees */}
      {visions.map((vision, index) => {
        const position = getTreePosition(index, visions.length);
        const tasks = visionTasks[vision.id] || [];

        return (
          <group key={vision.id} position={position}>
            {/* Vision Tree */}
            <VisionTree
              key={vision.id}
              vision={vision}
              onClick={() => handleVisionClick(vision)}
              isSelected={selectedVision?.id === vision.id}
              onHoverStart={() =>
                onVisionHover({
                  ...vision,
                  tasks,
                  totalTime: vision.total_actual_effort
                    ? Math.round((vision.total_actual_effort / 60) * 10) / 10
                    : 0,
                })
              }
              onHoverEnd={() => onVisionHover(null)}
            />

            {/* Task Satellites orbiting around the tree */}
            <TaskSatellites
              tasks={tasks}
              visionId={vision.id}
              isVisible={true}
              treeSize={vision.stage / 10} // 根据阶段计算树木大小比例
            />

            {/* Tree name label (always visible) */}
            <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2, 0.3]} />
              <meshBasicMaterial color={textColor} transparent opacity={0.8} />
            </mesh>
          </group>
        );
      })}

      {/* Orchard ground circle */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[Math.max(5, visions.length * 1.2)]} />
        <meshStandardMaterial
          color="#8FBC8E"
          roughness={0.8}
          metalness={0.1}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Temporary sector divider lines to show angle distribution */}
      {showSectorLines &&
        visions.map((vision, index) => {
          // Calculate the angle for this tree (same logic as getTreePosition)
          const totalWeight = visions.reduce(
            (sum, vision) => sum + 0.25 * vision.stage + 1,
            0,
          );
          let cumulativeWeight = 0;
          for (let i = 0; i < index; i++) {
            cumulativeWeight += 0.25 * visions[i].stage + 1;
          }
          const startAngle = (cumulativeWeight / totalWeight) * Math.PI * 2;

          return (
            <group key={`sector-line-${vision.id}`}>
              {/* Sector divider line - use primitive line for better visibility */}
              <primitive
                object={(() => {
                  const geometry = new THREE.BufferGeometry();
                  const positions = new Float32Array([
                    0,
                    0.1,
                    0, // Start from center
                    Math.cos(startAngle) * 8,
                    0.1,
                    Math.sin(startAngle) * 8, // End at angle direction
                  ]);
                  geometry.setAttribute(
                    "position",
                    new THREE.BufferAttribute(positions, 3),
                  );
                  const material = new THREE.LineBasicMaterial({
                    color: "#FF0000",
                    linewidth: 3,
                  });
                  return new THREE.Line(geometry, material);
                })()}
              />
            </group>
          );
        })}

      {/* Ambient particles with instancing for performance */}
      <instancedMesh
        ref={ambientParticlesRef}
        args={[undefined, undefined, 20]}
      >
        <sphereGeometry args={[0.02]} />
        <meshStandardMaterial
          color="#FFD700"
          emissive="#FFD700"
          emissiveIntensity={0.5}
          transparent
          opacity={0.6}
        />
      </instancedMesh>
    </group>
  );
};

export default VisionOrchard;
