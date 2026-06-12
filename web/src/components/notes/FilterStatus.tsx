import ActionButton from "@/components/ActionButton";
import type { PersonSummary, Tag } from "@/services/api";
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
  const hasActiveFilters =
    selectedFilterTags.length > 0 ||
    selectedFilterPersons.length > 0 ||
    (searchKeyword.trim() && isSearchApplied);

  if (!hasActiveFilters) {
    return null;
  }

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
