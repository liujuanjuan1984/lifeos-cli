import ActionButton from "@/components/ActionButton";
import type { PersonSummary, Tag } from "@/services/api";
import { useToast } from "@/contexts/ToastContext";
import { useNotesExport } from "@/hooks/useExport";
import { type NotesExportParams } from "@/services/api/export";
import { useTranslation } from "react-i18next";

interface FilterStatusProps {
  selectedFilterTags: Tag[];
  selectedFilterPersons: PersonSummary[];
  searchKeyword: string;
  isSearchApplied: boolean;
  filteredNotesCount: number;
  onClearFilters: () => void;
}

export function FilterStatus({
  selectedFilterTags,
  selectedFilterPersons,
  searchKeyword,
  isSearchApplied,
  filteredNotesCount,
  onClearFilters,
}: FilterStatusProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { exportData } = useNotesExport();
  const hasActiveFilters =
    selectedFilterTags.length > 0 ||
    selectedFilterPersons.length > 0 ||
    (searchKeyword.trim() && isSearchApplied);

  if (!hasActiveFilters) {
    return null;
  }

  const handleExportToClipboard = async () => {
    try {
      const exportParams: NotesExportParams = {
        selected_filter_tags: selectedFilterTags.map((tag) => ({
          id: tag.id,
          name: tag.name,
        })),
        selected_filter_persons: selectedFilterPersons.map((person) => ({
          id: person.id,
          display_name: person.display_name,
        })),
        search_keyword: searchKeyword,
      };

      await exportData(exportParams, {
        showToasts: false,
        onSuccess: () => {
          toast.showSuccess(
            t("filterStatus.exportSuccess"),
            t("filterStatus.exportCompleted"),
          );
        },
        onError: (error) => {
          toast.showError(
            t("filterStatus.exportError"),
            error.message || t("filterStatus.exportErrorMessage"),
          );
        },
      });
    } catch (error) {
      console.error("Failed to export data:", error);
      toast.showError(
        t("filterStatus.exportError"),
        t("filterStatus.exportErrorMessage"),
      );
    }
  };

  return (
    <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg flex-1 min-w-0">
        <span className="text-base text-primary break-words">
          {t("filterStatus.filtering")}{" "}
          <strong>
            {[
              ...selectedFilterTags.map((tag) =>
                t("filterStatus.tagFilter", { name: tag.name }),
              ),
              ...selectedFilterPersons.map((person) =>
                t("filterStatus.personFilter", { name: person.display_name }),
              ),
              ...(searchKeyword.trim()
                ? [
                    t("filterStatus.keywordFilter", {
                      keyword: searchKeyword.trim(),
                    }),
                  ]
                : []),
            ].join("、")}
          </strong>
        </span>
        <span className="text-sm text-primary bg-base-100 px-2 py-1 rounded-full flex-shrink-0">
          {searchKeyword.trim() && !isSearchApplied
            ? `(${t("filterStatus.readyToSearch")})`
            : `(${t("filterStatus.notesCount", { count: filteredNotesCount })})`}
        </span>
      </div>
      <ActionButton
        label={t("filterStatus.exportText")}
        iconName="clipboard"
        color="primary"
        onClick={handleExportToClipboard}
        className="w-full sm:w-auto"
      />
      <ActionButton
        label={t("filterStatus.clearFilters")}
        iconName="x-mark"
        color="neutral"
        variant="ghost"
        onClick={onClearFilters}
        className="w-full sm:w-auto"
      />
    </div>
  );
}
