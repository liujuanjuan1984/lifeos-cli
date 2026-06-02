import type { UUID } from "@/types/primitive";
/**
 * Tree Configuration Center
 * 集中管理所有树木相关的配置参数
 * 使用函数式配置生成器，避免重复代码
 */
interface SatelliteConfig {
  size: number;
  color: string;
  emissive: string;
  emissiveIntensity: number;
  orbitSpeed: number;
  opacity: number;
  roughness: number;
  metalness: number;
}

interface TreeStageConfig {
  // 基础尺寸
  height: number;
  trunkRadius: number;
  crownRadius: number;

  // 派生尺寸 (预计算，避免重复计算)
  trunkHeight: number; // height * 0.4
  crownHeight: number; // height * 0.6
  crownCenterY: number; // height * 0.7

  // 视觉属性
  color: string;

  // 卫星相关
  orbitRadius: number; // 轨道半径 (crownRadius * 1.5)
  orbitHeight: number; // 轨道高度 (height * 0.7)

  // 卫星配置 (预计算，基于不同状态)
  satellites: {
    todo: SatelliteConfig;
    in_progress: SatelliteConfig;
    done: SatelliteConfig;
    cancelled: SatelliteConfig;
    paused: SatelliteConfig;
  };

  // 粒子相关
  experienceParticleCount: number; // 经验值粒子数量
  ambientParticleRadius: number; // 环境粒子半径
}

// 基础配置常量
const BASE_CONFIG = {
  // 尺寸比例
  trunkHeightRatio: 0.4,
  crownHeightRatio: 0.6,
  crownCenterRatio: 0.7,
  orbitRadiusMultiplier: 1.5,
  orbitHeightRatio: 0.7,

  // 卫星基础配置
  satelliteBaseConfig: {
    todo: {
      color: "#808080",
      emissive: "#000000",
      emissiveIntensity: 0,
      orbitSpeed: 0.5,
      opacity: 0.7,
      roughness: 0.4,
      metalness: 0.6,
    },
    in_progress: {
      color: "#FF6347",
      emissive: "#FF6347",
      emissiveIntensity: 0.3,
      orbitSpeed: 1.0,
      opacity: 0.9,
      roughness: 0.4,
      metalness: 0.6,
    },
    done: {
      color: "#32CD32",
      emissive: "#32CD32",
      emissiveIntensity: 0.2,
      orbitSpeed: 1.5,
      opacity: 0.8,
      roughness: 0.4,
      metalness: 0.6,
    },
    cancelled: {
      color: "#808080",
      emissive: "#000000",
      emissiveIntensity: 0,
      orbitSpeed: 0,
      opacity: 0.5,
      roughness: 0.4,
      metalness: 0.6,
    },
    paused: {
      color: "#FFD700",
      emissive: "#FFD700",
      emissiveIntensity: 0.2,
      orbitSpeed: 0.3,
      opacity: 0.6,
      roughness: 0.4,
      metalness: 0.6,
    },
  },

  // 卫星大小比例 (相对于树冠半径)
  satelliteSizeRatios: {
    todo: 0.2,
    in_progress: 0.24,
    done: 0.16,
    cancelled: 0.133,
    paused: 0.2,
  },
} as const;

// 阶段基础数据
const STAGE_BASE_DATA = [
  {
    height: 0.3,
    trunkRadius: 0.02,
    crownRadius: 0.15,
    color: "#90EE90",
    experienceParticleCount: 1,
    ambientParticleRadius: 0.01,
  },
  {
    height: 0.8,
    trunkRadius: 0.08,
    crownRadius: 0.3,
    color: "#9ACD32",
    experienceParticleCount: 2,
    ambientParticleRadius: 0.015,
  },
  {
    height: 1.5,
    trunkRadius: 0.12,
    crownRadius: 0.6,
    color: "#32CD32",
    experienceParticleCount: 3,
    ambientParticleRadius: 0.02,
  },
  {
    height: 2.5,
    trunkRadius: 0.18,
    crownRadius: 1.0,
    color: "#228B22",
    experienceParticleCount: 4,
    ambientParticleRadius: 0.02,
  },
  {
    height: 4.0,
    trunkRadius: 0.25,
    crownRadius: 1.5,
    color: "#006400",
    experienceParticleCount: 6,
    ambientParticleRadius: 0.02,
  },
  {
    height: 5.5,
    trunkRadius: 0.32,
    crownRadius: 2.0,
    color: "#228B22",
    experienceParticleCount: 8,
    ambientParticleRadius: 0.025,
  },
  {
    height: 7.0,
    trunkRadius: 0.4,
    crownRadius: 2.5,
    color: "#FFD700",
    experienceParticleCount: 10,
    ambientParticleRadius: 0.025,
  },
  {
    height: 8.5,
    trunkRadius: 0.48,
    crownRadius: 3.0,
    color: "#FFA500",
    experienceParticleCount: 12,
    ambientParticleRadius: 0.03,
  },
  {
    height: 9.5,
    trunkRadius: 0.55,
    crownRadius: 3.5,
    color: "#FF8C00",
    experienceParticleCount: 15,
    ambientParticleRadius: 0.03,
  },
  {
    height: 10.5,
    trunkRadius: 0.62,
    crownRadius: 4.0,
    color: "#FF4500",
    experienceParticleCount: 18,
    ambientParticleRadius: 0.035,
  },
  {
    height: 12.0,
    trunkRadius: 0.7,
    crownRadius: 4.5,
    color: "#8A2BE2",
    experienceParticleCount: 20,
    ambientParticleRadius: 0.04,
  },
];

/**
 * 生成卫星配置
 */
function generateSatelliteConfig(
  crownRadius: number,
): TreeStageConfig["satellites"] {
  const satellites: TreeStageConfig["satellites"] = {
    todo: {
      ...BASE_CONFIG.satelliteBaseConfig.todo,
      size: crownRadius * BASE_CONFIG.satelliteSizeRatios.todo,
    },
    in_progress: {
      ...BASE_CONFIG.satelliteBaseConfig.in_progress,
      size: crownRadius * BASE_CONFIG.satelliteSizeRatios.in_progress,
    },
    done: {
      ...BASE_CONFIG.satelliteBaseConfig.done,
      size: crownRadius * BASE_CONFIG.satelliteSizeRatios.done,
    },
    cancelled: {
      ...BASE_CONFIG.satelliteBaseConfig.cancelled,
      size: crownRadius * BASE_CONFIG.satelliteSizeRatios.cancelled,
    },
    paused: {
      ...BASE_CONFIG.satelliteBaseConfig.paused,
      size: crownRadius * BASE_CONFIG.satelliteSizeRatios.paused,
    },
  };

  return satellites;
}

/**
 * 生成单个阶段的完整配置
 */
function generateStageConfig(
  baseData: (typeof STAGE_BASE_DATA)[0],
): TreeStageConfig {
  const {
    height,
    trunkRadius,
    crownRadius,
    color,
    experienceParticleCount,
    ambientParticleRadius,
  } = baseData;

  return {
    height,
    trunkRadius,
    crownRadius,
    color,
    experienceParticleCount,
    ambientParticleRadius,

    // 计算派生尺寸
    trunkHeight: height * BASE_CONFIG.trunkHeightRatio,
    crownHeight: height * BASE_CONFIG.crownHeightRatio,
    crownCenterY: height * BASE_CONFIG.crownCenterRatio,

    // 计算轨道参数
    orbitRadius: crownRadius * BASE_CONFIG.orbitRadiusMultiplier,
    orbitHeight: height * BASE_CONFIG.orbitHeightRatio,

    // 生成卫星配置
    satellites: generateSatelliteConfig(crownRadius),
  };
}

// 生成所有阶段的配置
const TREE_STAGE_CONFIG: Record<UUID, TreeStageConfig> = Object.fromEntries(
  STAGE_BASE_DATA.map((baseData, index) => [
    index,
    generateStageConfig(baseData),
  ]),
) as Record<UUID, TreeStageConfig>;

type TreeStage = keyof typeof TREE_STAGE_CONFIG;

/**
 * 获取指定阶段的树木配置
 * 每个阶段都有独立的配置，直接返回对应阶段的配置
 * @param stage 树木阶段 (0-10)
 * @returns 对应的配置对象
 */
export const getTreeConfig = (stage: number): TreeStageConfig => {
  // 限制阶段范围在 0-10 之间
  const validStage = Math.max(
    0,
    Math.min(10, Math.round(Number(stage))),
  ) as unknown as TreeStage;
  return TREE_STAGE_CONFIG[validStage];
};

/**
 * 根据树木大小比例获取配置
 * @param treeSize 树木大小比例 (0-1)
 * @returns 对应的配置对象
 */
export const getTreeConfigBySize = (treeSize: number): TreeStageConfig => {
  const stage = Math.round(treeSize * 10); // 现在支持10个阶段
  return getTreeConfig(stage);
};
