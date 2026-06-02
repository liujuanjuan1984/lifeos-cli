export { ApiError } from "./client";

// Domain APIs
export { dimensionsApi } from "./dimensions";
export { visionsApi } from "./visions";
export { tasksApi } from "./tasks";
export { personsApi } from "./persons";
export { tagsApi } from "./tags";
export { foodsApi } from "./foods";
export { foodEntriesApi } from "./foodEntries";
export { exportApi } from "./export";
export { invitationsApi } from "./invitations";

// Types
export type { PersonSummary } from "./types/common";
export type { Tag, TagCreate } from "./tags";
export type {
  PlannedEvent,
  PlannedEventCreate,
  PlannedEventUpdate,
} from "./plannedEvents";
export type {
  FinanceAccount,
  BalanceSnapshotSummary,
  BalanceSnapshotDetail,
  BalanceSnapshotComparison,
} from "./finance";
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
export type { Food, FoodCreate, FoodUpdate, FoodSummary } from "./foods";
export type {
  FoodEntry,
  FoodEntryCreate,
  FoodEntryUpdate,
  FoodEntrySummary,
  DailyNutritionSummary,
} from "./foodEntries";
export type {
  ActualEventTemplate,
  ActualEventTemplateCreateRequest,
  ActualEventTemplateUpdateRequest,
} from "./actualEventTemplates";

// Export types
export type {
  TimelogExportParams,
  NotesExportParams,
  PlanningExportParams,
  VisionExportParams,
  FinanceTradingExportParams,
  FinanceAccountsExportParams,
  FinanceCashflowExportParams,
  ExportResult,
  ExportEstimateResult,
} from "./export";

export type {
  SageMaxim,
  SageMaximListResponse,
  SageMaximSort,
} from "./sageMaxims";
export type {
  Invitation,
  InvitationWithCreator,
  InvitationStatus,
  InvitationLookupResponse,
  InvitationCreateRequest,
} from "./invitations";
