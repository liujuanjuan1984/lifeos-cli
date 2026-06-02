interface FormSectionsConfig {
  dateRange?: boolean;
  keyword?: boolean;
  dimension?: boolean;
  noteTags?: boolean;
  notePersons?: boolean;
  planningCycle?: boolean;
  visionSelector?: boolean;
  visionStatus?: boolean;
}

interface ValidationConfig {
  requireStartDate?: boolean;
  requireVisionSelection?: boolean;
}

interface ContextModuleConfigShape {
  value: string;
  defaultLabel: string;
  translationKey: string;
  formSections?: FormSectionsConfig;
  validation?: ValidationConfig;
}

export const CONTEXT_MODULE_CONFIG = {
  actual_event: {
    value: "actual_event",
    defaultLabel: "Timelog",
    translationKey: "agent.context.modules.actual_event",
    formSections: {
      dateRange: true,
      dimension: true,
      keyword: true,
    },
  },
  notes: {
    value: "notes",
    defaultLabel: "Notes",
    translationKey: "agent.context.modules.notes",
    formSections: {
      keyword: true,
      noteTags: true,
      notePersons: true,
    },
  },
  planning_tasks: {
    value: "planning_tasks",
    defaultLabel: "Planning Tasks",
    translationKey: "agent.context.modules.planning_tasks",
    formSections: {
      planningCycle: true,
    },
    validation: {
      requireStartDate: true,
    },
  },
  vision_progress: {
    value: "vision_progress",
    defaultLabel: "Vision Progress",
    translationKey: "agent.context.modules.vision_progress",
    formSections: {
      visionSelector: true,
      visionStatus: true,
    },
    validation: {
      requireVisionSelection: true,
    },
  },
} as const satisfies Record<string, ContextModuleConfigShape>;

export type ModuleValue = keyof typeof CONTEXT_MODULE_CONFIG;
export type ContextModuleConfig = (typeof CONTEXT_MODULE_CONFIG)[ModuleValue];
export type ModuleFormSections = FormSectionsConfig;
export type ModuleValidationConfig = ValidationConfig;

interface ModuleOption {
  value: ModuleValue;
  defaultLabel: string;
  translationKey: string;
}

export const MODULE_OPTIONS: readonly ModuleOption[] = Object.values(
  CONTEXT_MODULE_CONFIG,
).map((config) => ({
  value: config.value,
  defaultLabel: config.defaultLabel,
  translationKey: config.translationKey,
}));
