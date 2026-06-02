import React, { useCallback, useMemo, useId } from "react";
import { DeleteButton } from "@/components/ActionButton";
import ActionButton from "@/components/ActionButton";
import { formatTime } from "@/utils/datetime";
import { useToast } from "@/contexts/ToastContext";
import { copyToClipboardWithMessages } from "@/utils/core";
import { useTranslation } from "react-i18next";
import type { Note } from "@/types/newNotes";
import type { Tag } from "@/services/api";
import type { PersonSummary } from "@/services/api";
import type { UUID } from "@/types/primitive";
import type { NoteTimelogSummary } from "@/services/api/notes";
import Checkbox from "@/components/forms/Checkbox";
import NoteCardLayout, { type NoteCardAssociation } from "./NoteCardLayout";
import HoverTooltipOverlay from "@/components/HoverTooltipOverlay";
import {
  PersonTooltipContent,
  TagTooltipContent,
  TaskTooltipContent,
  TimelogTooltipContent,
} from "@/components/tooltips";
import { useHoverTooltip } from "@/hooks/useHoverTooltip";
import { Icon } from "@/components/icons";

type NoteAssociationTooltipPayload =
  | { type: "person"; person: PersonSummary }
  | { type: "tag"; tag: Tag }
  | { type: "task"; task: Note["task"] }
  | { type: "timelog"; timelog: NoteTimelogSummary };

interface AssociationTooltipPayloadState {
  key: string;
  data: NoteAssociationTooltipPayload;
}

interface NoteItemProps {
  note: Note;
  selectedFilterTag: Tag | null;
  selectedFilterPerson: PersonSummary | null;
  selectedFilterTaskId: UUID | null;
  onEdit: (note: Note) => void;
  onDelete: (noteId: UUID) => void;
  onTagClick: (tag: Tag) => void;
  onPersonClick: (person: PersonSummary) => void;
  onTaskClick: (taskId: UUID) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onSelectChange?: (noteId: UUID, checked: boolean) => void;
  minCollapsedLines?: number;
}

const NoteItem = React.memo<NoteItemProps>(
  ({
    note,
    selectedFilterTag,
    selectedFilterPerson,
    selectedFilterTaskId,
    onEdit,
    onDelete,
    onTagClick,
    onPersonClick,
    onTaskClick,
    isSelectMode = false,
    isSelected = false,
    onSelectChange,
    minCollapsedLines,
  }) => {
    const { t } = useTranslation();
    const toast = useToast();

    const {
      tooltipState: associationTooltipState,
      showTooltip,
      schedulePositionUpdate,
      hideTooltip,
      showTooltipForElement,
    } = useHoverTooltip<AssociationTooltipPayloadState>({
      defaultOffset: { x: 16, y: -12 },
      focusOffset: (rect) => ({ x: -rect.width / 2, y: -16 }),
    });
    const tooltipId = useId();
    const dimensionMap = useMemo(
      () => new Map<UUID, { name: string; color: string }>(),
      [],
    );

    const associationTooltip = useMemo(() => {
      if (!associationTooltipState) {
        return null;
      }
      return {
        key: associationTooltipState.payload.key,
        payload: associationTooltipState.payload.data,
        position: associationTooltipState.position,
        offset: associationTooltipState.offset,
      };
    }, [associationTooltipState]);

    const showAssociationTooltip = useCallback(
      (
        key: string,
        payload: NoteAssociationTooltipPayload,
        position: { x: number; y: number },
      ) => {
        showTooltip({
          payload: { key, data: payload },
          position,
        });
      },
      [showTooltip],
    );

    const updateAssociationTooltipPosition = useCallback(
      (
        key: string,
        payload: NoteAssociationTooltipPayload,
        position: { x: number; y: number },
      ) => {
        if (!associationTooltip || associationTooltip.key !== key) {
          showTooltip({
            payload: { key, data: payload },
            position,
          });
          return;
        }
        schedulePositionUpdate(position);
      },
      [associationTooltip, schedulePositionUpdate, showTooltip],
    );

    const associations: NoteCardAssociation[] = [];

    const formatTimelogLabel = (timelog: NoteTimelogSummary): string => {
      if (timelog.title && timelog.title.trim().length > 0) {
        return timelog.title.trim();
      }

      const start = timelog.start_time ? formatTime(timelog.start_time) : "";
      const end = timelog.end_time ? formatTime(timelog.end_time) : "";

      if (start && end) {
        return `${start}-${end}`;
      }
      if (start) {
        return `${start}`;
      }
      if (end) {
        return `${end}`;
      }
      return t("notes.timelogChipDefault");
    };

    if (note.persons && note.persons.length > 0) {
      associations.push(
        ...note.persons.map((p) => {
          const id = `person-${p.id}`;
          const payload: NoteAssociationTooltipPayload = {
            type: "person",
            person: p,
          };
          return {
            id,
            type: "person" as const,
            label: `@${p.display_name}`,
            icon: (
              <Icon
                name="people"
                size={16}
                className="text-success"
                aria-hidden
              />
            ),
            active: selectedFilterPerson?.id === p.id,
            onClick: () => onPersonClick(p),
            onMouseEnter: (event: React.MouseEvent<HTMLElement>) =>
              showAssociationTooltip(id, payload, {
                x: event.clientX,
                y: event.clientY,
              }),
            onMouseMove: (event: React.MouseEvent<HTMLElement>) =>
              updateAssociationTooltipPosition(id, payload, {
                x: event.clientX,
                y: event.clientY,
              }),
            onMouseLeave: () => hideTooltip(),
            onFocus: (event: React.FocusEvent<HTMLElement>) =>
              showTooltipForElement(
                { key: id, data: payload },
                event.currentTarget,
              ),
            onBlur: () => hideTooltip(),
            ariaDescribedBy: tooltipId,
          } satisfies NoteCardAssociation;
        }),
      );
    }

    if (note.tags && note.tags.length > 0) {
      associations.push(
        ...note.tags.map((tag) => {
          const id = `tag-${tag.id}`;
          const payload: NoteAssociationTooltipPayload = {
            type: "tag",
            tag,
          };
          return {
            id,
            type: "tag" as const,
            label: `#${tag.name}`,
            icon: (
              <Icon name="tag" size={16} className="text-primary" aria-hidden />
            ),
            active: selectedFilterTag?.id === tag.id,
            onClick: () => onTagClick(tag),
            onMouseEnter: (event: React.MouseEvent<HTMLElement>) =>
              showAssociationTooltip(id, payload, {
                x: event.clientX,
                y: event.clientY,
              }),
            onMouseMove: (event: React.MouseEvent<HTMLElement>) =>
              updateAssociationTooltipPosition(id, payload, {
                x: event.clientX,
                y: event.clientY,
              }),
            onMouseLeave: () => hideTooltip(),
            onFocus: (event: React.FocusEvent<HTMLElement>) =>
              showTooltipForElement(
                { key: id, data: payload },
                event.currentTarget,
              ),
            onBlur: () => hideTooltip(),
            ariaDescribedBy: tooltipId,
          } satisfies NoteCardAssociation;
        }),
      );
    }

    if (note.task) {
      associations.push({
        id: `task-${note.task.id}`,
        type: "task",
        label: `${note.task.content} (${note.task.status})`,
        icon: (
          <Icon
            name="clipboard"
            size={16}
            className="text-secondary"
            aria-hidden
          />
        ),
        active: selectedFilterTaskId === note.task.id,
        onClick: () => onTaskClick(note.task!.id),
        onMouseEnter: (event: React.MouseEvent<HTMLElement>) =>
          showAssociationTooltip(
            `task-${note.task!.id}`,
            { type: "task", task: note.task },
            {
              x: event.clientX,
              y: event.clientY,
            },
          ),
        onMouseMove: (event: React.MouseEvent<HTMLElement>) =>
          updateAssociationTooltipPosition(
            `task-${note.task!.id}`,
            { type: "task", task: note.task },
            {
              x: event.clientX,
              y: event.clientY,
            },
          ),
        onMouseLeave: () => hideTooltip(),
        onFocus: (event: React.FocusEvent<HTMLElement>) =>
          showTooltipForElement(
            {
              key: `task-${note.task!.id}`,
              data: { type: "task", task: note.task },
            },
            event.currentTarget,
          ),
        onBlur: () => hideTooltip(),
        ariaDescribedBy: tooltipId,
      });
    }

    if (note.timelogs && note.timelogs.length > 0) {
      associations.push(
        ...note.timelogs.map((timelog) => {
          const label = formatTimelogLabel(timelog);
          const id = `timelog-${timelog.id}`;
          const payload: NoteAssociationTooltipPayload = {
            type: "timelog",
            timelog,
          };
          return {
            id,
            type: "timelog" as const,
            label,
            icon: (
              <Icon name="timer" size={16} className="text-info" aria-hidden />
            ),
            onMouseEnter: (event: React.MouseEvent<HTMLElement>) =>
              showAssociationTooltip(id, payload, {
                x: event.clientX,
                y: event.clientY,
              }),
            onMouseMove: (event: React.MouseEvent<HTMLElement>) =>
              updateAssociationTooltipPosition(id, payload, {
                x: event.clientX,
                y: event.clientY,
              }),
            onMouseLeave: () => hideTooltip(),
            onFocus: (event: React.FocusEvent<HTMLElement>) =>
              showTooltipForElement(
                { key: id, data: payload },
                event.currentTarget,
              ),
            onBlur: () => hideTooltip(),
            ariaDescribedBy: tooltipId,
          } satisfies NoteCardAssociation;
        }),
      );
    }

    const tooltipContentNode = useMemo(() => {
      if (!associationTooltip) {
        return null;
      }

      switch (associationTooltip.payload.type) {
        case "person":
          return (
            <PersonTooltipContent person={associationTooltip.payload.person} />
          );
        case "tag":
          return <TagTooltipContent tag={associationTooltip.payload.tag} />;
        case "task": {
          const task = associationTooltip.payload.task;
          if (!task) {
            return null;
          }
          return (
            <TaskTooltipContent
              task={task}
              visionName={task.vision_summary?.name ?? null}
              parentTaskName={task.parent_summary?.content ?? null}
            />
          );
        }
        case "timelog":
          return (
            <TimelogTooltipContent
              entry={{
                title: associationTooltip.payload.timelog.title ?? null,
                start_time:
                  associationTooltip.payload.timelog.start_time ?? null,
                end_time: associationTooltip.payload.timelog.end_time ?? null,
                dimension_id:
                  associationTooltip.payload.timelog.dimension_id ?? null,
                dimension_summary:
                  associationTooltip.payload.timelog.dimension_summary ??
                  undefined,
                task_summary:
                  associationTooltip.payload.timelog.task_summary ?? undefined,
              }}
              dimensionMap={dimensionMap}
            />
          );
        default:
          return null;
      }
    }, [associationTooltip, dimensionMap]);

    // 复制笔记内容到剪贴板
    const handleCopy = async () => {
      const result = await copyToClipboardWithMessages(
        note.content,
        t("notes.copySuccessMessage"),
        t("notes.copyErrorMessage"),
      );

      if (result.success) {
        toast.showSuccess(t("notes.copySuccess"), result.message);
      } else {
        toast.showError(t("notes.copyError"), result.message);
      }
    };
    // Inline editing removed: always render view mode

    const handleSelectionChange = (checked: boolean) => {
      if (!onSelectChange) return;
      onSelectChange(note.id, checked);
    };

    const actions = (
      <>
        <ActionButton
          label={t("notes.copyTooltip")}
          iconName="clipboard"
          color="primary"
          onClick={handleCopy}
          ariaLabel={t("notes.copyTooltip")}
          iconOnly
        />
        <ActionButton
          label={t("notes.editTooltip")}
          iconName="edit"
          color="primary"
          onClick={() => onEdit(note)}
          ariaLabel={t("notes.editTooltip")}
          iconOnly
        />
        <DeleteButton onClick={() => onDelete(note.id)} />
      </>
    );

    return (
      <div>
        {isSelectMode && note.id && (
          <div className="flex items-center justify-between mb-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={handleSelectionChange}
              size="sm"
              label={t("notes.selectForBatch")}
            />
          </div>
        )}

        <NoteCardLayout
          content={note.content}
          associations={associations}
          createdAt={note.createdAt.toISOString()}
          actions={actions}
          actionsVisibility="hover"
          contentClassName="prose-base prose-p:my-2 prose-p:whitespace-pre-wrap prose-ul:my-2 prose-ol:my-2 prose-li:my-1"
          minCollapsedLines={minCollapsedLines}
        />
        <HoverTooltipOverlay
          visible={Boolean(associationTooltip && tooltipContentNode)}
          position={associationTooltip?.position ?? null}
          offset={associationTooltip?.offset}
          className="text-sm leading-relaxed max-w-xs"
        >
          <div id={tooltipId}>{tooltipContentNode}</div>
        </HoverTooltipOverlay>
      </div>
    );
  },
);

NoteItem.displayName = "NoteItem";

export default NoteItem;
