import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import ModalBase from "@/layouts/ModalBase";
import ActionButton from "@/components/ActionButton";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Checkbox, TextInput } from "@/components/forms";
import type { UUID } from "@/types/primitive";

interface FinanceTreeItem {
  id: UUID;
  name: string;
  is_default: boolean;
  display_order: number | null;
}

interface FinanceTreeManagerModalProps {
  isOpen: boolean;
  title: string;
  trees: FinanceTreeItem[];
  loading: boolean;
  error?: string | null;
  onClose: () => void;
  onCreate: (name: string, isDefault?: boolean) => Promise<void>;
  onRename: (id: UUID, name: string) => Promise<void>;
  onDelete: (id: UUID) => Promise<void>;
  onSetDefault: (id: UUID) => Promise<void>;
  exportLabel?: string;
  onExportTree?: (id: UUID) => Promise<void> | void;
  createPending?: boolean;
  updatePending?: boolean;
  deletePending?: boolean;
}

export function FinanceTreeManagerModal({
  isOpen,
  title,
  trees,
  loading,
  error,
  onClose,
  onCreate,
  onRename,
  onDelete,
  onSetDefault,
  exportLabel,
  onExportTree,
  createPending = false,
  updatePending = false,
  deletePending = false,
}: FinanceTreeManagerModalProps) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState("");
  const [createDefault, setCreateDefault] = useState(false);
  const [editingId, setEditingId] = useState<UUID | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FinanceTreeItem | null>(
    null,
  );

  useEffect(() => {
    if (!isOpen) {
      setNewName("");
      setCreateDefault(false);
      setEditingId(null);
      setEditingName("");
      setDeleteTarget(null);
    }
  }, [isOpen]);

  const sortedTrees = useMemo(
    () =>
      [...trees].sort((a, b) => {
        if (a.is_default !== b.is_default) {
          return a.is_default ? -1 : 1;
        }
        if (a.display_order !== b.display_order) {
          if (a.display_order == null) return 1;
          if (b.display_order == null) return -1;
          return a.display_order - b.display_order;
        }
        return a.name.localeCompare(b.name);
      }),
    [trees],
  );

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await onCreate(trimmed, createDefault);
    setNewName("");
    setCreateDefault(false);
  };

  const handleStartEdit = (tree: FinanceTreeItem) => {
    setEditingId(tree.id);
    setEditingName(tree.name);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (!trimmed) return;
    await onRename(editingId, trimmed);
    setEditingId(null);
    setEditingName("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  return (
    <>
      <ModalBase
        isOpen={isOpen}
        onClose={onClose}
        header={title}
        size="lg"
        loading={loading}
        showLoadingSpinner={loading}
        error={error ?? undefined}
        showCloseButton={true}
      >
        <div className="space-y-6">
          <div className="rounded-xl border border-base-200 bg-base-100 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <TextInput
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder={t("finance.treeNamePlaceholder")}
                size="sm"
                className="flex-1 min-w-[10rem]"
              />
              <Checkbox
                checked={createDefault}
                onCheckedChange={setCreateDefault}
                size="sm"
                label={t("finance.setAsDefault")}
              />
              <ActionButton
                label={t("common.add")}
                iconName="plus"
                color="primary"
                variant="solid"
                size="sm"
                disabled={createPending || !newName.trim()}
                onClick={handleCreate}
              />
            </div>
          </div>

          {sortedTrees.length === 0 ? (
            <p className="text-sm text-base-content/70">
              {t("finance.noTrees")}
            </p>
          ) : (
            <div className="space-y-2">
              {sortedTrees.map((tree) => {
                const isEditing = editingId === tree.id;
                return (
                  <div
                    key={tree.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-base-200 bg-base-50 px-3 py-2"
                  >
                    {isEditing ? (
                      <TextInput
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        size="sm"
                        className="flex-1 min-w-[10rem]"
                      />
                    ) : (
                      <div className="flex flex-1 items-center gap-2 min-w-[10rem]">
                        <span className="text-sm font-medium">{tree.name}</span>
                        {tree.is_default ? (
                          <span className="badge badge-success badge-sm">
                            {t("finance.defaultTree")}
                          </span>
                        ) : null}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      {isEditing ? (
                        <>
                          <ActionButton
                            label={t("common.save")}
                            color="primary"
                            variant="solid"
                            size="xs"
                            disabled={updatePending || !editingName.trim()}
                            onClick={handleSaveEdit}
                          />
                          <ActionButton
                            label={t("common.cancel")}
                            size="xs"
                            variant="ghost"
                            disabled={updatePending}
                            onClick={handleCancelEdit}
                          />
                        </>
                      ) : (
                        <>
                          {onExportTree && exportLabel ? (
                            <ActionButton
                              label={exportLabel}
                              size="xs"
                              variant="outline"
                              disabled={updatePending || deletePending}
                              onClick={() => onExportTree(tree.id)}
                            />
                          ) : null}
                          {!tree.is_default ? (
                            <ActionButton
                              label={t("finance.setAsDefault")}
                              size="xs"
                              variant="outline"
                              disabled={updatePending}
                              onClick={() => onSetDefault(tree.id)}
                            />
                          ) : null}
                          <ActionButton
                            label={t("common.rename")}
                            size="xs"
                            variant="outline"
                            disabled={updatePending}
                            onClick={() => handleStartEdit(tree)}
                          />
                          <ActionButton
                            label={t("common.delete")}
                            size="xs"
                            color="error"
                            variant="ghost"
                            disabled={deletePending}
                            onClick={() => setDeleteTarget(tree)}
                          />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ModalBase>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await onDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
        title={t("common.delete")}
        message={t("finance.deleteTreeConfirm")}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        loading={deletePending}
      />
    </>
  );
}
