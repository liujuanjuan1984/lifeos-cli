export type QueryLike = {
  queryKey: unknown;
};

export const isTimelogsListQuery = (query: QueryLike): boolean => {
  if (!Array.isArray(query.queryKey)) return false;
  return (
    query.queryKey.length >= 2 &&
    query.queryKey[0] === "timelogs" &&
    query.queryKey[1] === "list"
  );
};

export const isTimelogsAdvancedSearchQuery = (
  query: QueryLike,
): boolean => {
  if (!Array.isArray(query.queryKey)) return false;
  return (
    query.queryKey.length >= 2 &&
    query.queryKey[0] === "timelogs" &&
    query.queryKey[1] === "advanced-search"
  );
};

export const isNotesListQuery = (query: QueryLike): boolean => {
  if (!Array.isArray(query.queryKey)) return false;
  return (
    query.queryKey.length >= 2 &&
    query.queryKey[0] === "notes" &&
    query.queryKey[1] === "list"
  );
};

export const isNotesStatsQuery = (query: QueryLike): boolean => {
  if (!Array.isArray(query.queryKey)) return false;
  return (
    query.queryKey.length >= 2 &&
    query.queryKey[0] === "notes" &&
    query.queryKey[1] === "stats"
  );
};

export const isNotesAdvancedSearchQuery = (query: QueryLike): boolean => {
  if (!Array.isArray(query.queryKey)) return false;
  return (
    query.queryKey.length >= 3 &&
    query.queryKey[0] === "notes" &&
    query.queryKey[1] === "advanced-search"
  );
};

export const isPlannedEventsListQuery = (query: QueryLike): boolean => {
  if (!Array.isArray(query.queryKey)) return false;
  return (
    query.queryKey.length >= 2 &&
    query.queryKey[0] === "planned-events" &&
    query.queryKey[1] === "list"
  );
};

export const isTasksListQuery = (query: QueryLike): boolean => {
  if (!Array.isArray(query.queryKey)) return false;
  return (
    query.queryKey.length >= 2 &&
    query.queryKey[0] === "tasks" &&
    query.queryKey[1] === "list"
  );
};

export const isTasksSelectorSourceQuery = (query: QueryLike): boolean => {
  if (!Array.isArray(query.queryKey)) return false;
  return (
    query.queryKey.length >= 3 &&
    query.queryKey[0] === "tasks" &&
    query.queryKey[1] === "selector-source"
  );
};

export const isVisionsHierarchyQuery = (query: QueryLike): boolean => {
  if (!Array.isArray(query.queryKey)) return false;
  return (
    query.queryKey.length >= 4 &&
    query.queryKey[0] === "visions" &&
    query.queryKey[query.queryKey.length - 1] === "hierarchy"
  );
};

export const isVisionsListQuery = (query: QueryLike): boolean => {
  if (!Array.isArray(query.queryKey)) return false;
  return (
    query.queryKey.length >= 2 &&
    query.queryKey[0] === "visions" &&
    query.queryKey[1] === "list"
  );
};

export const isPersonsListQuery = (query: QueryLike): boolean => {
  if (!Array.isArray(query.queryKey)) return false;
  return (
    query.queryKey.length >= 2 &&
    query.queryKey[0] === "persons" &&
    query.queryKey[1] === "list"
  );
};

export const isHabitsListQuery = (query: QueryLike): boolean => {
  if (!Array.isArray(query.queryKey)) return false;
  return (
    query.queryKey.length >= 2 &&
    query.queryKey[0] === "habits" &&
    query.queryKey[1] === "list"
  );
};

export const isHabitsActionsQuery = (query: QueryLike): boolean => {
  if (!Array.isArray(query.queryKey)) return false;
  return (
    query.queryKey.length >= 3 &&
    query.queryKey[0] === "habits" &&
    query.queryKey[query.queryKey.length - 1] === "actions"
  );
};

export const isAreasListQuery = (query: QueryLike): boolean => {
  if (!Array.isArray(query.queryKey)) return false;
  return (
    query.queryKey.length >= 2 &&
    query.queryKey[0] === "areas" &&
    query.queryKey[1] === "list"
  );
};
