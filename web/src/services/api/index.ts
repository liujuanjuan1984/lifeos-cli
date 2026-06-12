export { ApiError } from "./client";

// Domain APIs
export { dimensionsApi } from "./dimensions";
export { visionsApi } from "./visions";
export { tasksApi } from "./tasks";
export { personsApi } from "./persons";
export { tagsApi } from "./tags";

// Types
export type { PersonSummary } from "./types/common";
export type { Tag, TagCreate } from "./tags";
export type {
  PlannedEvent,
  PlannedEventCreate,
  PlannedEventUpdate,
} from "./plannedEvents";
export type {
  ActualEvent,
  ActualEventCreate,
  ActualEventUpdate,
  EnergyInjectionResult,
  ActualEventWithEnergyResponse,
} from "./actualEvents";
export type {
  Vision,
  VisionCreate,
  VisionUpdate,
  VisionWithTasks,
  VisionStatsResponse,
} from "./visions";
export type {
  Task,
  TaskCreate,
  TaskUpdate,
  TaskWithSubtasks,
  TaskHierarchy,
  TaskStatsResponse,
} from "./tasks";
export type {
  Anniversary,
  AnniversaryCreate,
  AnniversaryUpdate,
  Person,
  PersonCreate,
  PersonUpdate,
  PersonListResponse,
  PersonActivityItem,
  PersonActivitiesResponse,
} from "./persons";
export type {
  ActualEventTemplate,
  ActualEventTemplateCreateRequest,
  ActualEventTemplateUpdateRequest,
} from "./actualEventTemplates";
