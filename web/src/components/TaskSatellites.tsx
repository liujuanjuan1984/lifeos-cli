import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Task } from "@/services/api";
import { useTreeConfigBySize } from "@/hooks/useTreeConfig";
import type { UUID } from "@/types/primitive";

interface TaskSatellitesProps {
  tasks: Task[];
  visionId: UUID;
  isVisible: boolean;
  treeSize?: number; // 树木的实际大小，用于动态调整圆环
}

/**
 * TaskSatellites - 3D representation of tasks as satellites orbiting around vision trees
 *
 * Each task is represented as a small geometric shape that orbits around its vision tree.
 * The appearance and behavior change based on task status:
 * - todo: Gray, slow orbit
 * - in_progress: Yellow, medium orbit with pulsing
 * - done: Green, fast orbit
 * - cancelled: Red, stationary
 */
const TaskSatellites: React.FC<TaskSatellitesProps> = ({
  tasks,
  visionId,
  isVisible,
  treeSize = 1, // 默认大小为1
}) => {
  // Use unified tree configuration
  const treeConfig = useTreeConfigBySize(treeSize);
  // Separate instanced meshes for different task statuses to maintain color logic
  const todoSatellitesRef = useRef<THREE.InstancedMesh>(null);
  const inProgressSatellitesRef = useRef<THREE.InstancedMesh>(null);
  const doneSatellitesRef = useRef<THREE.InstancedMesh>(null);
  const cancelledSatellitesRef = useRef<THREE.InstancedMesh>(null);
  const pausedSatellitesRef = useRef<THREE.InstancedMesh>(null);

  // Filter tasks to only show root level tasks (no parent) for this vision
  const rootTasks = useMemo(() => {
    return tasks.filter(
      (task) => !task.parent_task_id && task.vision_id === visionId,
    );
  }, [tasks, visionId]);

  // Get satellite properties directly from unified configuration
  const getSatelliteProperties = (task: Task) => {
    const status = task.status as keyof typeof treeConfig.satellites;
    return treeConfig.satellites[status] || treeConfig.satellites.todo;
  };

  // Group tasks by status for separate instanced rendering
  const tasksByStatus = useMemo(() => {
    const groups = {
      todo: [] as Task[],
      in_progress: [] as Task[],
      done: [] as Task[],
      cancelled: [] as Task[],
      paused: [] as Task[],
    };

    rootTasks.forEach((task) => {
      if (groups[task.status as keyof typeof groups]) {
        groups[task.status as keyof typeof groups].push(task);
      } else {
        groups.todo.push(task); // fallback
      }
    });

    return groups;
  }, [rootTasks]);

  // Animate satellites with separate instancing for each status
  useFrame((state) => {
    if (!isVisible) return;

    // Animate each status group separately
    Object.entries(tasksByStatus).forEach(([status, tasks]) => {
      if (tasks.length === 0) return;

      const ref = getStatusRef(status);
      if (!ref?.current) return;

      tasks.forEach((task, index) => {
        const properties = getSatelliteProperties(task);
        const time = state.clock.elapsedTime * properties.orbitSpeed;

        // Calculate position based on task's position in the overall task list
        const globalIndex = rootTasks.findIndex((t) => t.id === task.id);
        const angle = (globalIndex / rootTasks.length) * Math.PI * 2 + time;

        // Calculate orbit height using unified config
        const orbitHeight = treeConfig.orbitHeight;
        const height =
          orbitHeight + task.priority * 0.2 + Math.sin(time * 2) * 0.15;

        // Create transformation matrix for this instance
        const matrix = new THREE.Matrix4();
        // Use unified orbit radius configuration
        const dynamicOrbitRadius = treeConfig.orbitRadius;
        const position = new THREE.Vector3(
          Math.cos(angle) * dynamicOrbitRadius,
          height,
          Math.sin(angle) * dynamicOrbitRadius,
        );

        if (properties.orbitSpeed > 0) {
          // Apply rotation for visual interest
          const rotation = new THREE.Euler(time * 0.5, time, 0);
          const quaternion = new THREE.Quaternion().setFromEuler(rotation);
          matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
        } else {
          // Stationary satellites (cancelled tasks)
          matrix.setPosition(position);
        }

        ref.current!.setMatrixAt(index, matrix);
      });

      // Update instance matrix for this status group
      ref.current.instanceMatrix.needsUpdate = true;
    });
  });

  // Helper function to get the appropriate ref for each status
  const getStatusRef = (status: string) => {
    switch (status) {
      case "todo":
        return todoSatellitesRef;
      case "in_progress":
        return inProgressSatellitesRef;
      case "done":
        return doneSatellitesRef;
      case "cancelled":
        return cancelledSatellitesRef;
      case "paused":
        return pausedSatellitesRef;
      default:
        return todoSatellitesRef;
    }
  };

  if (!isVisible || rootTasks.length === 0) {
    return null;
  }

  return (
    <>
      {/* Separate instanced meshes for each task status to maintain color logic */}
      {tasksByStatus.todo.length > 0 && (
        <instancedMesh
          ref={todoSatellitesRef}
          args={[undefined, undefined, tasksByStatus.todo.length]}
        >
          <sphereGeometry args={[treeConfig.satellites.todo.size, 8, 6]} />
          <meshStandardMaterial
            color={treeConfig.satellites.todo.color}
            transparent
            opacity={treeConfig.satellites.todo.opacity}
            roughness={treeConfig.satellites.todo.roughness}
            metalness={treeConfig.satellites.todo.metalness}
            emissive={treeConfig.satellites.todo.emissive}
            emissiveIntensity={treeConfig.satellites.todo.emissiveIntensity}
          />
        </instancedMesh>
      )}

      {tasksByStatus.in_progress.length > 0 && (
        <instancedMesh
          ref={inProgressSatellitesRef}
          args={[undefined, undefined, tasksByStatus.in_progress.length]}
        >
          <sphereGeometry
            args={[treeConfig.satellites.in_progress.size, 8, 6]}
          />
          <meshStandardMaterial
            color={treeConfig.satellites.in_progress.color}
            emissive={treeConfig.satellites.in_progress.emissive}
            emissiveIntensity={
              treeConfig.satellites.in_progress.emissiveIntensity
            }
            transparent
            opacity={treeConfig.satellites.in_progress.opacity}
            roughness={treeConfig.satellites.in_progress.roughness}
            metalness={treeConfig.satellites.in_progress.metalness}
          />
        </instancedMesh>
      )}

      {tasksByStatus.done.length > 0 && (
        <instancedMesh
          ref={doneSatellitesRef}
          args={[undefined, undefined, tasksByStatus.done.length]}
        >
          <sphereGeometry args={[treeConfig.satellites.done.size, 8, 6]} />
          <meshStandardMaterial
            color={treeConfig.satellites.done.color}
            emissive={treeConfig.satellites.done.emissive}
            emissiveIntensity={treeConfig.satellites.done.emissiveIntensity}
            transparent
            opacity={treeConfig.satellites.done.opacity}
            roughness={treeConfig.satellites.done.roughness}
            metalness={treeConfig.satellites.done.metalness}
          />
        </instancedMesh>
      )}

      {tasksByStatus.cancelled.length > 0 && (
        <instancedMesh
          ref={cancelledSatellitesRef}
          args={[undefined, undefined, tasksByStatus.cancelled.length]}
        >
          <sphereGeometry args={[treeConfig.satellites.cancelled.size, 8, 6]} />
          <meshStandardMaterial
            color={treeConfig.satellites.cancelled.color}
            transparent
            opacity={treeConfig.satellites.cancelled.opacity}
            roughness={treeConfig.satellites.cancelled.roughness}
            metalness={treeConfig.satellites.cancelled.metalness}
            emissive={treeConfig.satellites.cancelled.emissive}
            emissiveIntensity={
              treeConfig.satellites.cancelled.emissiveIntensity
            }
          />
        </instancedMesh>
      )}

      {tasksByStatus.paused.length > 0 && (
        <instancedMesh
          ref={pausedSatellitesRef}
          args={[undefined, undefined, tasksByStatus.paused.length]}
        >
          <sphereGeometry args={[treeConfig.satellites.paused.size, 8, 6]} />
          <meshStandardMaterial
            color={treeConfig.satellites.paused.color}
            emissive={treeConfig.satellites.paused.emissive}
            emissiveIntensity={treeConfig.satellites.paused.emissiveIntensity}
            transparent
            opacity={treeConfig.satellites.paused.opacity}
            roughness={treeConfig.satellites.paused.roughness}
            metalness={treeConfig.satellites.paused.metalness}
          />
        </instancedMesh>
      )}

      {/* Dynamic orbit path visualization using unified configuration */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, treeConfig.orbitHeight, 0]}
      >
        <ringGeometry
          args={[
            treeConfig.orbitRadius - 0.02,
            treeConfig.orbitRadius + 0.02,
            64,
          ]}
        />
        <meshBasicMaterial color="#87CEEB" transparent opacity={0.1} />
      </mesh>
    </>
  );
};

export default TaskSatellites;
