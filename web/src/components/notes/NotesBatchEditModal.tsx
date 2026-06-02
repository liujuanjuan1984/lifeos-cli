import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import ModalBase from "@/layouts/ModalBase";
import ActionButton, { ActionButtonGroup } from "@/components/ActionButton";
import TagSelector from "@/components/selects/TagSelector";
import PersonSelector from "@/components/selects/PersonSelector";
import TaskSelector from "@/components/selects/TaskSelector";
import { FormField, TextInput } from "@/components/forms";
import type { Tag } from "@/services/api/tags";
import type { UUID } from "@/types/primitive";
import { useNotesBatchEditController } from "@/features/notes/controller/useNotesBatchEditController";

interface NotesBatchEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNoteIds: Set<UUID>;
  onSuccess: () => void;
  availableTags: Tag[];
  onCreateTag: (tagName: string) => Promise<Tag>;
  availableTasks: { id: UUID; name: string }[];
}

type BatchMode = "tags" | "persons" | "task" | "content";

type TagMode = "add" | "replace";

type PersonMode = "add" | "replace";

type TaskMode = "replace" | "clear";

const NotesBatchEditModal = ({
  isOpen,
  onClose,
  selectedNoteIds,
  onSuccess,
  availableTags,
  onCreateTag,
  availableTasks,
}: NotesBatchEditModalProps) => {
  const { t } = useTranslation();

  const [mode, setMode] = useState<BatchMode>("tags");
  const [tagMode, setTagMode] = useState<TagMode>("add");
  const [selectedTagIds, setSelectedTagIds] = useState<UUID[]>([]);

  const [personMode, setPersonMode] = useState<PersonMode>("add");
  const [selectedPersonIds, setSelectedPersonIds] = useState<UUID[]>([]);

  const [taskMode, setTaskMode] = useState<TaskMode>("replace");
  const [selectedTaskId, setSelectedTaskId] = useState<UUID | null>(null);

  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);

  const noteIds = useMemo(() => Array.from(selectedNoteIds), [selectedNoteIds]);

  const preloadedTasks = useMemo(
    () =>
      availableTasks.map((task) => ({
        id: task.id,
        content: task.name,
        status: "todo",
        vision_id: task.id,
        parent_task_id: null,
        priority: 1,
        display_order: 0,
        estimated_effort: null,
        actual_effort_self: 0,
        actual_effort_total: 0,
        notes_count: 0,
        created_at: "1970-01-01T00:00:00.000Z",
        updated_at: "1970-01-01T00:00:00.000Z",
      })),
    [availableTasks],
  );

  const resetState = useCallback(() => {
    setMode("tags");
    setTagMode("add");
    setSelectedTagIds([]);
    setPersonMode("add");
    setSelectedPersonIds([]);
    setTaskMode("replace");
    setSelectedTaskId(null);
    setFindText("");
    setReplaceText("");
    setCaseSensitive(false);
  }, []);

  const { isPending, submitBatchEdit } = useNotesBatchEditController({
    onSuccess,
    onCompleted: onClose,
    resetState,
  });

  const handleClose = useCallback(() => {
    if (isPending) return;
    resetState();
    onClose();
  }, [isPending, onClose, resetState]);

  const handleSubmit = useCallback(async () => {
    await submitBatchEdit({
      noteIds,
      mode,
      tagMode,
      selectedTagIds,
      personMode,
      selectedPersonIds,
      taskMode,
      selectedTaskId,
      findText,
      replaceText,
      caseSensitive,
    });
  }, [
    caseSensitive,
    findText,
    mode,
    noteIds,
    personMode,
    replaceText,
    selectedPersonIds,
    selectedTagIds,
    selectedTaskId,
    taskMode,
    submitBatchEdit,
    tagMode,
  ]);

  return (
    <ModalBase isOpen={isOpen} onClose={handleClose}>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-base-content">
            {t("notes.batchEdit.modalTitle", { count: noteIds.length })}
          </h2>
          <p className="text-base text-base-content/70 mt-1">
            {t("notes.batchEdit.description")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton
            label={t("notes.batchEdit.mode.tags")}
            onClick={() => setMode("tags")}
            color={mode === "tags" ? "primary" : "neutral"}
            variant={mode === "tags" ? "outline" : "ghost"}
          />
          <ActionButton
            label={t("notes.batchEdit.mode.persons")}
            onClick={() => setMode("persons")}
            color={mode === "persons" ? "primary" : "neutral"}
            variant={mode === "persons" ? "outline" : "ghost"}
          />
          <ActionButton
            label={t("notes.batchEdit.mode.task")}
            onClick={() => setMode("task")}
            color={mode === "task" ? "primary" : "neutral"}
            variant={mode === "task" ? "outline" : "ghost"}
          />
          <ActionButton
            label={t("notes.batchEdit.mode.content")}
            onClick={() => setMode("content")}
            color={mode === "content" ? "primary" : "neutral"}
            variant={mode === "content" ? "outline" : "ghost"}
          />
        </div>

        {mode === "tags" && (
          <div className="space-y-4">
            <ActionButtonGroup>
              <ActionButton
                label={t("notes.batchEdit.tagMode.add")}
                onClick={() => setTagMode("add")}
                color={tagMode === "add" ? "primary" : "neutral"}
                variant={tagMode === "add" ? "solid" : "outline"}
              />
              <ActionButton
                label={t("notes.batchEdit.tagMode.replace")}
                onClick={() => setTagMode("replace")}
                color={tagMode === "replace" ? "primary" : "neutral"}
                variant={tagMode === "replace" ? "solid" : "outline"}
              />
            </ActionButtonGroup>
            <TagSelector
              availableTags={availableTags}
              selectedTagIds={selectedTagIds}
              onTagsChange={setSelectedTagIds}
              onCreateTag={onCreateTag}
              size="md"
            />
          </div>
        )}

        {mode === "persons" && (
          <div className="space-y-4">
            <ActionButtonGroup>
              <ActionButton
                label={t("notes.batchEdit.personMode.add")}
                onClick={() => setPersonMode("add")}
                color={personMode === "add" ? "primary" : "neutral"}
                variant={personMode === "add" ? "solid" : "outline"}
              />
              <ActionButton
                label={t("notes.batchEdit.personMode.replace")}
                onClick={() => setPersonMode("replace")}
                color={personMode === "replace" ? "primary" : "neutral"}
                variant={personMode === "replace" ? "solid" : "outline"}
              />
            </ActionButtonGroup>
            <PersonSelector
              selectedPersonIds={selectedPersonIds}
              onSelectionChange={setSelectedPersonIds}
              multiple={true}
              size="md"
            />
          </div>
        )}

        {mode === "task" && (
          <div className="space-y-4">
            <ActionButtonGroup>
              <ActionButton
                label={t("notes.batchEdit.taskMode.replace")}
                onClick={() => setTaskMode("replace")}
                color={taskMode === "replace" ? "primary" : "neutral"}
                variant={taskMode === "replace" ? "solid" : "outline"}
              />
              <ActionButton
                label={t("notes.batchEdit.taskMode.clear")}
                onClick={() => setTaskMode("clear")}
                color={taskMode === "clear" ? "primary" : "neutral"}
                variant={taskMode === "clear" ? "solid" : "outline"}
              />
            </ActionButtonGroup>
            {taskMode === "replace" && (
              <TaskSelector
                value={selectedTaskId as UUID | null}
                onChange={(value) => setSelectedTaskId(value || null)}
                preloadedTasks={preloadedTasks}
                deferRemoteLoad={true}
                showSpecialOptions={false}
                expandFilterForSelected={true}
                idPrefix="notes-batch-task"
                className="w-full"
              />
            )}
          </div>
        )}

        {mode === "content" && (
          <div className="space-y-4">
            <FormField
              label={t("notes.batchEdit.findText")}
              htmlFor="notes-batch-find"
            >
              <TextInput
                id="notes-batch-find"
                type="text"
                value={findText}
                onChange={(event) => setFindText(event.target.value)}
              />
            </FormField>
            <FormField
              label={t("notes.batchEdit.replaceText")}
              htmlFor="notes-batch-replace"
            >
              <TextInput
                id="notes-batch-replace"
                type="text"
                value={replaceText}
                onChange={(event) => setReplaceText(event.target.value)}
              />
            </FormField>
            <div className="flex items-center gap-2">
              <ActionButton
                label={
                  caseSensitive
                    ? t("notes.batchEdit.caseSensitiveOn")
                    : t("notes.batchEdit.caseSensitiveOff")
                }
                iconName="language"
                color={caseSensitive ? "primary" : "neutral"}
                variant={caseSensitive ? "solid" : "outline"}
                onClick={() => setCaseSensitive((prev) => !prev)}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <ActionButton
            label={t("common.cancel")}
            onClick={handleClose}
            color="neutral"
            variant="outline"
            disabled={isPending}
          />
          <ActionButton
            label={
              isPending ? t("common.processing") : t("notes.batchEdit.apply")
            }
            onClick={handleSubmit}
            color="primary"
            disabled={isPending}
          />
        </div>
      </div>
    </ModalBase>
  );
};

export default NotesBatchEditModal;
