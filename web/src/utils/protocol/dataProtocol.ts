/**
 * 数据协议 V2 - 基于业界最佳实践
 *
 * 基于以下标准：
 * - JSON Schema: null vs undefined 语义
 * - GraphQL: 字段存在性语义
 * - RFC 6902: JSON Patch 部分更新
 * - OpenAPI: 数据验证标准
 */

/**
 * 字段更新语义（统一前后端）
 * - undefined: 字段未提供（不参与更新，保持原值）
 * - null: 字段被明确设置为空值（用户想要清空该字段）
 * - 有效值: 字段被设置为该值
 */
/**
 * 数据清理配置
 */
interface DataCleanupConfig {
  /** 是否将空字符串转换为 null */
  nullifyEmptyStrings?: boolean;
  /** 是否将空数组转换为 null（明确设置为空） */
  nullifyEmptyArrays?: boolean;
  /** 是否移除 undefined 字段（用于部分更新） */
  removeUndefined?: boolean;
  /** 是否去除字符串首尾空格 */
  trimStrings?: boolean;
  /** 是否保留 null 值（用于明确设置空值） */
  preserveNull?: boolean;
}

/**
 * 基于 JSON Schema 的数据清理函数
 * 遵循业界标准的 null vs undefined 语义
 */
function cleanPayload<T extends Record<string, unknown>>(
  payload: T,
  config: DataCleanupConfig = {},
): Partial<T> {
  const {
    nullifyEmptyStrings = true,
    nullifyEmptyArrays = true,
    removeUndefined = true,
    trimStrings = true,
    preserveNull = true,
  } = config;

  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(payload)) {
    let cleanedValue: unknown = value;

    // 处理 undefined：字段未提供
    if (value === undefined) {
      if (!removeUndefined) {
        result[key as keyof T] = value as T[keyof T];
      }
      continue;
    }

    // 处理 null：明确设置为空值
    if (value === null) {
      if (preserveNull) {
        result[key as keyof T] = value as T[keyof T];
      }
      continue;
    }

    // 处理字符串
    if (typeof value === "string") {
      cleanedValue = trimStrings ? value.trim() : value;
      if (cleanedValue === "" && nullifyEmptyStrings) {
        cleanedValue = null; // 空字符串转 null，表示明确设置为空
      }
    }

    // 处理数组
    if (Array.isArray(value)) {
      if (value.length === 0 && nullifyEmptyArrays) {
        cleanedValue = null; // 空数组转 null，表示明确设置为空
      } else {
        // 清理数组中的空值
        const filtered = value.filter((item) => {
          if (typeof item === "string") {
            return trimStrings ? item.trim() !== "" : item !== "";
          }
          return item != null;
        });
        cleanedValue =
          filtered.length === 0 && nullifyEmptyArrays ? null : filtered;
      }
    }

    // 只保留非 undefined 的值
    if (cleanedValue !== undefined) {
      result[key as keyof T] = cleanedValue as T[keyof T];
    }
  }

  return result;
}

/**
 * 创建操作类型的数据清理器
 * 区分创建和更新场景
 */
export const DataCleaner = {
  /**
   * 创建场景：所有字段都应该有值
   */
  create: <T extends Record<string, unknown>>(payload: T): Partial<T> => {
    return cleanPayload(payload, {
      nullifyEmptyStrings: true,
      nullifyEmptyArrays: true,
      removeUndefined: true,
      trimStrings: true,
      preserveNull: true,
    });
  },

  /**
   * 更新场景：支持部分更新和明确设置空值
   * 这是最常用的更新场景处理函数
   */
  update: <T extends Record<string, unknown>>(payload: T): Partial<T> => {
    return cleanPayload(payload, {
      nullifyEmptyStrings: true,
      nullifyEmptyArrays: true,
      removeUndefined: true, // 只更新提供的字段
      trimStrings: true,
      preserveNull: true, // 保留 null 值，表示明确设置为空
    });
  },

  /**
   * 更新场景（保留未修改字段）：用于需要明确区分修改和未修改的场景
   */
  updateWithUndefined: <T extends Record<string, unknown>>(
    payload: T,
  ): Partial<T> => {
    return cleanPayload(payload, {
      nullifyEmptyStrings: true,
      nullifyEmptyArrays: true,
      removeUndefined: false, // 保留 undefined 字段
      trimStrings: true,
      preserveNull: true,
    });
  },

  /**
   * 查询场景：保持原始值
   */
  query: <T extends Record<string, unknown>>(payload: T): T => {
    return cleanPayload(payload, {
      nullifyEmptyStrings: false,
      nullifyEmptyArrays: false,
      removeUndefined: false,
      trimStrings: true,
      preserveNull: true,
    }) as T;
  },
};
