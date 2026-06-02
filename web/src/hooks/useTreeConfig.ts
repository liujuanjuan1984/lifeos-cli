import { useMemo } from "react";
import { getTreeConfig, getTreeConfigBySize } from "@/config/treeConfig";

/**
 * 树木配置 Hook
 * 提供便捷的树木配置访问和计算
 */
export const useTreeConfig = (stage: number) => {
  const config = useMemo(() => getTreeConfig(stage), [stage]);

  return useMemo(
    () => ({
      ...config,
    }),
    [config],
  );
};

/**
 * 根据树木大小比例获取配置的 Hook
 */
export const useTreeConfigBySize = (treeSize: number) => {
  const config = useMemo(() => getTreeConfigBySize(treeSize), [treeSize]);

  return useMemo(() => {
    return {
      ...config,
      // 卫星大小计算
      getSatelliteSize: (baseSize: number) => {
        const sizeMultiplier = Math.max(0.3, treeSize);
        return baseSize * sizeMultiplier;
      },
    };
  }, [config, treeSize]);
};
