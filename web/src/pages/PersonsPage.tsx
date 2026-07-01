import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import PersonManager from "@/components/PersonManager";
import ExpandableCard from "@/components/ExpandableCard";
import TagManager from "@/components/TagManagerModal";
import PersonTimelineModal from "@/components/PersonTimelineModal";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import PageLayout from "@/layouts/PageLayout";
import { usePersonActivitiesPage } from "@/hooks/queries/usePersons";
import { useTagSelectorSource } from "@/hooks/selectors/useTagSelectorSource";
import { usePersistentState } from "@/hooks/usePersistentState";
import ActionButton from "@/components/ActionButton";
import {
  formatPersonTagFilterLabel,
  getNextPersonTagFilterState,
} from "@/features/people/tagFilters";
import type { PersonSummary } from "@/services/api";
import { tagsApi, type Tag } from "@/services/api/tags";
import { tagsKeys } from "@/services/api/queryKeys";
import type { UUID } from "@/types/primitive";
import type { PersonActivityType } from "@/services/api/persons";

/**
 * PersonsPage - Main page for the social module
 *
 * This page provides:
 * - Person management interface
 * - Person activity timeline view
 * - Navigation between different views
 */
const PersonsPage: React.FC = () => {
  const { t } = useTranslation();
  // Simplify view: use modal for timeline and show both persons and tags as modules
  const [selectedPerson, setSelectedPerson] = useState<PersonSummary | null>(
    null,
  );
  const [showTagManager, setShowTagManager] = useState(false);

  // Tag filtering state
  const [filteredByTag, setFilteredByTag] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<UUID | null>(null);
  const { state: tagFiltersExpanded, setState: setTagFiltersExpanded } =
    usePersistentState<boolean>({
      key: "personsPage.tagFiltersExpanded",
      defaultValue: true,
      expireInHours: 0,
    });

  // Use the paginated activities hook
  type ActivityFilter = "all" | PersonActivityType;
  const [activitiesPage, setActivitiesPage] = useState(1);
  const activitiesPageSize = 50;
  const [activityTypeFilter, setActivityTypeFilter] =
    useState<ActivityFilter>("all");
  const activityTypeParam =
    activityTypeFilter === "all" ? undefined : activityTypeFilter;

  const {
    activities,
    total,
    totalPages,
    isLoading: isLoadingActivities,
    isFetching: isFetchingActivities,
  } = usePersonActivitiesPage(
    selectedPerson?.id || null,
    activitiesPage,
    activitiesPageSize,
    activityTypeParam,
  );

  useEffect(() => {
    setActivitiesPage(1);
    setActivityTypeFilter("all");
  }, [selectedPerson?.id]);

  // Load all person tags via shared cache
  const { tags: personTags, refresh: refreshPersonTags } = useTagSelectorSource(
    {
      entityType: "person",
    },
  );
  const { data: personTagStats } = useQuery({
    queryKey: tagsKeys.statsBatch("person"),
    queryFn: () => tagsApi.getStatsBatch("person"),
    enabled: personTags.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const personTagUsageCounts = useMemo(() => {
    if (!personTagStats) {
      return null;
    }
    return new Map<UUID, number>(
      personTagStats.tag_stats.map((stat) => [stat.id, stat.usage_count]),
    );
  }, [personTagStats]);

  const getCategoryDisplayName = useCallback(
    (category: string): string => {
      const normalizedCategory = category || "general";
      const translated = t(`tagManager.categories.${normalizedCategory}`);
      return translated &&
        translated !== `tagManager.categories.${normalizedCategory}`
        ? translated
        : normalizedCategory;
    },
    [t],
  );

  const sortedPersonTags = useMemo(
    () => [...personTags].sort((a, b) => a.name.localeCompare(b.name)),
    [personTags],
  );

  const tagsByCategory = useMemo(() => {
    const map = new Map<string, Tag[]>();
    sortedPersonTags.forEach((tag) => {
      const category = tag.category || "general";
      const current = map.get(category) || [];
      current.push(tag);
      map.set(category, current);
    });

    return Array.from(map.entries())
      .map(([category, tags]) => ({
        category,
        label: getCategoryDisplayName(category),
        tags: [...tags].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [sortedPersonTags, getCategoryDisplayName]);

  // Toggle person tag filtering.
  const togglePersonTagFilter = useCallback(
    (tag: Tag) => {
      const nextState = getNextPersonTagFilterState(
        { filteredByTag, selectedTagId },
        tag.id,
      );
      setFilteredByTag(nextState.filteredByTag);
      setSelectedTagId(nextState.selectedTagId);
    },
    [filteredByTag, selectedTagId],
  );

  // Handle search query change from PersonManager
  const handleSearchQueryChange = useCallback(
    (query: string) => {
      if (query.trim() && filteredByTag) {
        // Reset to all persons when searching
        setFilteredByTag(false);
        setSelectedTagId(null);
      }
    },
    [filteredByTag],
  );

  const [createPersonSignal, setCreatePersonSignal] = useState(0);

  // Page header via context
  const { setHeader } = usePageHeader();

  React.useEffect(() => {
    setHeader({
      actions: (
        <div className="flex gap-2">
          <ActionButton
            label={t("personManager.socialTagManager")}
            iconName="tag"
            color="primary"
            variant="solid"
            onClick={() => setShowTagManager(true)}
          />
          <ActionButton
            label={t("persons.addContact")}
            iconName="plus"
            color="primary"
            variant="solid"
            onClick={() => setCreatePersonSignal((value) => value + 1)}
          />
        </div>
      ),
    });
    return () => setHeader({ actions: undefined });
  }, [setHeader, t, setShowTagManager]);

  // Load person activities
  const handleLoadPersonActivities = useCallback((person: PersonSummary) => {
    setSelectedPerson(person);
  }, []);

  return (
    <PageLayout>
      {/* Tags Filter Container */}
      <ExpandableCard
        isExpanded={tagFiltersExpanded}
        onToggleExpansion={() =>
          setTagFiltersExpanded((isExpanded) => !isExpanded)
        }
        title={
          <h3 className="text-base font-semibold text-base-content">
            {t("personManager.tagFiltersTitle")}
          </h3>
        }
        elevation="moderate"
        className="mb-4"
      >
        <div className="space-y-3 px-5 pb-5">
          {tagsByCategory.map((group) => (
            <div key={group.category} className="space-y-2">
              <div className="rounded-sm bg-base-200/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-base-content/70">
                {group.label}
              </div>
              <div className="flex flex-wrap gap-2 px-3">
                {group.tags.map((tag) => (
                  <ActionButton
                    key={tag.id}
                    label={formatPersonTagFilterLabel(
                      tag.name,
                      personTagUsageCounts?.get(tag.id) ?? null,
                    )}
                    color={selectedTagId === tag.id ? "primary" : "neutral"}
                    variant={selectedTagId === tag.id ? "solid" : "ghost"}
                    size="sm"
                    onClick={() => togglePersonTagFilter(tag)}
                    className="rounded-full"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ExpandableCard>

      {/* Persons List Container */}
      <PersonManager
        filteredByTag={filteredByTag}
        selectedTagId={selectedTagId}
        onSearchQueryChange={handleSearchQueryChange}
        onTimelineRequest={handleLoadPersonActivities}
        createRequestSignal={createPersonSignal}
      />

      {/* Tag Manager Modal */}
      <TagManager
        isOpen={showTagManager}
        onClose={() => setShowTagManager(false)}
        title={t("personManager.socialTagManager")}
        entityTypeScope="person"
        onTagUpdated={() => {
          refreshPersonTags();
        }}
      />

      {/* Timeline Modal */}
      <PersonTimelineModal
        person={selectedPerson}
        isOpen={!!selectedPerson}
        onClose={() => setSelectedPerson(null)}
        activities={activities}
        total={total}
        totalPages={totalPages}
        isLoadingActivities={isLoadingActivities}
        isFetchingActivities={isFetchingActivities}
        page={activitiesPage}
        onPageChange={setActivitiesPage}
        activityType={activityTypeFilter}
        onActivityTypeChange={setActivityTypeFilter}
      />
    </PageLayout>
  );
};

export default PersonsPage;
