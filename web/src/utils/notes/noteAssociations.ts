import type { PersonSummary } from "@/services/api/types/common";
import type { UUID } from "@/types/primitive";

type TaskLike =
  | {
      id: UUID;
      content?: string | null;
    }
  | null
  | undefined;

interface NoteAssociationSource {
  task?: TaskLike;
  persons?: Array<Pick<PersonSummary, "id">> | null | undefined;
}

interface NoteAssociationDefaults {
  preSelectedTaskId?: UUID;
  preSelectedTaskTitle?: string;
  preSelectedPersonIds?: UUID[];
  lockTaskSelection: boolean;
  lockPersonSelection: boolean;
}

const uniqueIds = (ids: UUID[] | undefined | null): UUID[] => {
  if (!ids || ids.length === 0) return [];
  return Array.from(new Set(ids));
};

export function deriveNoteAssociationDefaults(
  source: NoteAssociationSource,
  options?: {
    lockTask?: boolean;
    lockPersons?: boolean;
  },
): NoteAssociationDefaults {
  const task = source.task ?? null;
  const personIds = uniqueIds(
    (source.persons ?? [])
      .map((person) => person?.id)
      .filter((id): id is UUID => typeof id === "string" && id.length > 0),
  );

  const preSelectedTaskId =
    task && typeof task.id === "string" && task.id.length > 0
      ? (task.id as UUID)
      : undefined;

  const lockTaskSelection =
    options?.lockTask ?? Boolean(preSelectedTaskId && preSelectedTaskId !== "");
  const lockPersonSelection = options?.lockPersons ?? personIds.length > 0;

  return {
    preSelectedTaskId,
    preSelectedTaskTitle:
      typeof task?.content === "string" && task.content.trim().length > 0
        ? task.content
        : undefined,
    preSelectedPersonIds: personIds.length > 0 ? personIds : undefined,
    lockTaskSelection,
    lockPersonSelection,
  };
}
