import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ModalBase from "@/layouts/ModalBase";
import CreateNoteModal from "./CreateNoteModal";
import type { Tag } from "@/services/api/tags";
import type { Note } from "@/services/api/notes";
import type { UUID } from "@/types/primitive";
import ActionButton from "./ActionButton";
import EmptyState from "./EmptyState";
import NoteCardLayout, {
  type NoteCardAssociation,
} from "./notes/NoteCardLayout";
import { Icon } from "./icons";
import { formatTime } from "@/utils/datetime";
import type { NoteTimelogSummary } from "@/services/api/notes";
import { useNoteCollapsePreference } from "@/hooks/notes/useNoteCollapsePreference";
import { useAssociatedNotesController } from "@/features/notes/controller/useAssociatedNotesController";

interface TagNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  tag: Tag | null;
}

const formatTimelogLabel = (
  t: (key: string, vars?: Record<string, unknown>) => string,
  timelog?: NoteTimelogSummary | null,
): string | null => {
  if (!timelog) return null;
  if (timelog.title && timelog.title.trim().length > 0) {
    return timelog.title.trim();
  }
  const start = timelog.start_time ? formatTime(timelog.start_time) : "";
  const end = timelog.end_time ? formatTime(timelog.end_time) : "";
  if (start && end) return `${start}-${end}`;
  if (start) return start;
  if (end) return end;
  return t("notes.timelogChipDefault");
};

function TagNotesModal({ isOpen, onClose, tag }: TagNotesModalProps) {
  const { t } = useTranslation();
  const noteCollapsePreference = useNoteCollapsePreference();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const tagId: UUID | null = tag?.id ?? null;

  const { notes, isLoading, error, refetch } = useAssociatedNotesController({
    isOpen,
    enabledId: tagId,
    listFilters: { tag_id: tagId ?? undefined },
  });

  useEffect(() => {
    if (!isOpen) {
      setShowCreateModal(false);
      setEditingNote(null);
    }
  }, [isOpen]);

  const handleNoteCreated = useCallback(() => {
    setShowCreateModal(false);
    void refetch();
  }, [refetch]);

  const handleEditComplete = useCallback(() => {
    setEditingNote(null);
    void refetch();
  }, [refetch]);

  const header = tag
    ? t("finance.tagNotes.title", { tag: `#${tag.name}` })
    : t("finance.tagNotes.titlePlaceholder");

  const emptyTitle = t("finance.tagNotes.emptyTitle");
  const emptyDescription = t("finance.tagNotes.emptyDescription");

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      header={header}
      showCloseButton
      size="xl"
      loading={isLoading}
      error={error ? (error as Error).message : undefined}
      onErrorDismiss={() => refetch()}
      showLoadingSpinner={isLoading}
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2 text-base-content">
          <Icon name="tag" size={18} aria-hidden className="text-primary" />
          <span className="font-semibold">
            {tag ? `#${tag.name}` : t("finance.tagNotes.noTag")}
          </span>
        </div>
        <ActionButton
          label={t("finance.tagNotes.createNote")}
          iconName="plus"
          color="primary"
          variant="solid"
          onClick={() => setShowCreateModal(true)}
          disabled={!tagId}
        />
      </div>

      {!isLoading && !error && notes.length === 0 && (
        <EmptyState
          icon={
            <Icon
              name="document-text"
              size={48}
              aria-hidden
              className="text-base-content/40"
            />
          }
          title={emptyTitle}
          description={emptyDescription}
          className="py-16"
        />
      )}

      {notes.length > 0 && (
        <div className="space-y-4">
          {notes.map((note) => {
            const associations: NoteCardAssociation[] = [];

            if (note.tags?.length) {
              associations.push(
                ...note.tags.map((tItem) => ({
                  id: `tag-${tItem.id}`,
                  type: "tag" as const,
                  label: `#${tItem.name}`,
                  disabled: true,
                  icon: (
                    <Icon
                      name="tag"
                      size={16}
                      className="text-primary"
                      aria-hidden
                    />
                  ),
                })),
              );
            }

            if (note.persons?.length) {
              associations.push(
                ...note.persons.map((person) => ({
                  id: `person-${person.id}`,
                  type: "person" as const,
                  label: `@${person.display_name ?? person.name}`,
                  disabled: true,
                  icon: (
                    <Icon
                      name="people"
                      size={16}
                      className="text-success"
                      aria-hidden
                    />
                  ),
                })),
              );
            }

            if (note.task) {
              associations.push({
                id: `task-${note.task.id}`,
                type: "task",
                label: note.task.content,
                disabled: true,
                icon: (
                  <Icon
                    name="clipboard"
                    size={16}
                    className="text-secondary"
                    aria-hidden
                  />
                ),
              });
            }

            const firstTimelog = note.timelogs?.[0];
            const timelogLabel = formatTimelogLabel(t, firstTimelog);
            if (timelogLabel) {
              associations.push({
                id: `timelog-${firstTimelog?.id ?? `${note.id}-timelog`}`,
                type: "timelog",
                label: timelogLabel,
                disabled: true,
                icon: (
                  <Icon
                    name="timer"
                    size={16}
                    className="text-info"
                    aria-hidden
                  />
                ),
              });
            }

            return (
              <div
                key={note.id}
                className="rounded-lg border border-base-200 bg-base-100 p-4 shadow-sm"
              >
                <NoteCardLayout
                  content={note.content}
                  createdAt={note.created_at}
                  associations={associations}
                  minCollapsedLines={noteCollapsePreference.value}
                  actions={
                    <ActionButton
                      label={t("common.edit")}
                      iconName="edit"
                      iconOnly
                      color="primary"
                      onClick={() => setEditingNote(note)}
                      ariaLabel={t("common.edit")}
                    />
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && tag && (
        <CreateNoteModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          preSelectedTagIds={[tag.id]}
          lockTagSelection
          onNoteCreated={handleNoteCreated}
        />
      )}

      {editingNote && (
        <CreateNoteModal
          isOpen={!!editingNote}
          onClose={() => setEditingNote(null)}
          mode="edit"
          existingNote={editingNote}
          preSelectedTagIds={tag ? [tag.id] : undefined}
          lockTagSelection={!!tag}
          onNoteCreated={handleEditComplete}
        />
      )}
    </ModalBase>
  );
}

export default TagNotesModal;
