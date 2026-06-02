import React, { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, Group, Material } from "three";

interface AgentProps {
  position?: [number, number, number];
  isAwakening?: boolean;
  onAwakeningComplete?: () => void;
}

/**
 * AI Agent component - The Energy Guardian
 * Sacred guardian of the dimensional energy satellites
 * Observes and maintains the harmony of the energy ecosystem
 */
const Agent: React.FC<AgentProps> = ({
  position = [2, 0.75, 2],
  isAwakening = false,
  onAwakeningComplete,
}) => {
  const agentRef = useRef<Group>(null);
  const bodyRef = useRef<Mesh>(null);
  const leftArmRef = useRef<Mesh>(null);
  const rightArmRef = useRef<Mesh>(null);
  const staffRef = useRef<Mesh>(null);
  const [guardianState, setGuardianState] = useState<
    "observing" | "channeling" | "blessing"
  >("observing");

  // Handle energy channeling state changes
  useEffect(() => {
    if (isAwakening && guardianState === "observing") {
      setGuardianState("channeling");

      // After channeling, give blessing
      setTimeout(() => {
        setGuardianState("blessing");
        onAwakeningComplete?.();

        // Return to observing after blessing
        setTimeout(() => {
          setGuardianState("observing");
        }, 2000);
      }, 3000);
    }
  }, [isAwakening, guardianState, onAwakeningComplete]);

  // Guardian animation system
  useFrame((state) => {
    if (agentRef.current) {
      const time = state.clock.getElapsedTime();

      if (guardianState === "observing") {
        // Slow, meditative movements while observing the satellites
        agentRef.current.position.y = position[1] + Math.sin(time * 0.8) * 0.03;
        agentRef.current.rotation.y = Math.sin(time * 0.2) * 0.3; // Slowly scanning the area
      } else if (guardianState === "channeling") {
        // Focused energy channeling pose
        agentRef.current.position.y = position[1] + 0.15; // Elevated during channeling
        agentRef.current.rotation.y = 0; // Face the tree directly

        // Raise staff and arms for channeling
        if (leftArmRef.current && rightArmRef.current && staffRef.current) {
          const channelIntensity = Math.sin(time * 3) * 0.2 + 0.4;
          leftArmRef.current.rotation.z = Math.PI / 3 + channelIntensity;
          rightArmRef.current.rotation.z = -Math.PI / 6; // Hold staff
          staffRef.current.rotation.x = channelIntensity * 0.5;
        }
      } else if (guardianState === "blessing") {
        // Blessing gesture - arms spread wide
        const blessMotion = Math.sin(time * 2) * 0.1;
        agentRef.current.position.y = position[1] + 0.1 + blessMotion;
        agentRef.current.rotation.y = Math.sin(time * 1.5) * 0.1; // Gentle turning

        if (leftArmRef.current && rightArmRef.current) {
          leftArmRef.current.rotation.z = Math.PI / 2 + blessMotion;
          rightArmRef.current.rotation.z = -Math.PI / 2 - blessMotion;
        }
      }
    }

    // Gentle breathing effect (always active)
    if (bodyRef.current) {
      const breathe = 1 + Math.sin(state.clock.getElapsedTime() * 1.5) * 0.015;
      bodyRef.current.scale.setScalar(breathe);
    }

    // Staff energy effect during channeling
    if (staffRef.current && guardianState === "channeling") {
      const time = state.clock.getElapsedTime();
      const material = staffRef.current.material as Material & {
        emissiveIntensity?: number;
      };
      if (material.emissiveIntensity !== undefined) {
        material.emissiveIntensity = 0.3 + Math.sin(time * 4) * 0.4;
      }
    }
  });

  return (
    <group ref={agentRef} position={position}>
      {/* Body - main capsule shape */}
      <mesh ref={bodyRef} castShadow receiveShadow>
        <capsuleGeometry args={[0.3, 0.5, 4, 8]} />
        <meshStandardMaterial
          color="#A9A9A9"
          roughness={0.7}
          metalness={0.1}
          flatShading
        />
      </mesh>

      {/* Head - sphere on top */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <sphereGeometry args={[0.2, 8, 6]} />
        <meshStandardMaterial
          color="#D3D3D3"
          roughness={0.6}
          metalness={0.1}
          flatShading
        />
      </mesh>

      {/* Eyes - simple black dots */}
      <mesh position={[-0.08, 0.65, 0.15]} castShadow>
        <sphereGeometry args={[0.03, 6, 4]} />
        <meshStandardMaterial color="#000000" flatShading />
      </mesh>
      <mesh position={[0.08, 0.65, 0.15]} castShadow>
        <sphereGeometry args={[0.03, 6, 4]} />
        <meshStandardMaterial color="#000000" flatShading />
      </mesh>

      {/* Arms - simple cylinders with refs for animation */}
      <mesh
        ref={leftArmRef}
        position={[-0.35, 0.1, 0]}
        rotation={[0, 0, Math.PI / 4]}
        castShadow
      >
        <cylinderGeometry args={[0.05, 0.08, 0.4, 6]} />
        <meshStandardMaterial
          color="#A9A9A9"
          roughness={0.7}
          metalness={0.1}
          flatShading
        />
      </mesh>
      <mesh
        ref={rightArmRef}
        position={[0.35, 0.1, 0]}
        rotation={[0, 0, -Math.PI / 4]}
        castShadow
      >
        <cylinderGeometry args={[0.05, 0.08, 0.4, 6]} />
        <meshStandardMaterial
          color="#A9A9A9"
          roughness={0.7}
          metalness={0.1}
          flatShading
        />
      </mesh>

      {/* Legs - simple cylinders */}
      <mesh position={[-0.1, -0.6, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.5, 6]} />
        <meshStandardMaterial
          color="#A9A9A9"
          roughness={0.7}
          metalness={0.1}
          flatShading
        />
      </mesh>
      <mesh position={[0.1, -0.6, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.5, 6]} />
        <meshStandardMaterial
          color="#A9A9A9"
          roughness={0.7}
          metalness={0.1}
          flatShading
        />
      </mesh>

      {/* Guardian's Energy Staff */}
      <mesh
        ref={staffRef}
        position={[0.5, 0.2, 0]}
        rotation={[0, 0, -Math.PI / 6]}
        castShadow
      >
        <cylinderGeometry args={[0.02, 0.03, 1.2, 8]} />
        <meshStandardMaterial
          color="#8B7355"
          emissive="#FFD700"
          emissiveIntensity={0.2}
          roughness={0.6}
          metalness={0.3}
          flatShading
        />
      </mesh>

      {/* Staff crystal/orb at the top */}
      <mesh
        position={[
          0.5 + Math.sin(-Math.PI / 6) * 0.6,
          0.2 + Math.cos(-Math.PI / 6) * 0.6,
          0,
        ]}
        castShadow
      >
        <sphereGeometry args={[0.08, 8, 6]} />
        <meshStandardMaterial
          color="#87CEEB"
          emissive="#87CEEB"
          emissiveIntensity={0.4}
          roughness={0.2}
          metalness={0.8}
          transparent
          opacity={0.9}
          flatShading
        />
      </mesh>

      {/* Simple shadow catcher under feet */}
      <mesh
        position={[0, -0.9, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[0.4, 8]} />
        <meshLambertMaterial color="#000000" transparent opacity={0.1} />
      </mesh>
    </group>
  );
};

export default Agent;
