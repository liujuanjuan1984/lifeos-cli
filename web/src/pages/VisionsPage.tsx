import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import VisionManager, {
  type VisionManagerHandle,
} from "@/components/VisionManager";

import { usePageHeader } from "@/contexts/PageHeaderContext";
import PageLayout from "@/layouts/PageLayout";
import { CreateNewButton } from "@/components/ActionButton";
import EnumSelect from "@/components/selects/EnumSelect";
import DimensionSelect from "@/components/selects/DimensionSelect";
import { VISION_STATUS_FILTER_OPTIONS } from "@/utils/constants";
import type { UUID } from "@/types/primitive";

/**
 * VisionPage - Independent page for vision management
 *
 * This page provides a dedicated interface for managing user visions,
 * including creating, editing, and tracking vision progress.
 * Similar to NotesPage and TimeLogPage, this is a standalone feature page.
 */
const VisionPage: React.FC = () => {
  const { t } = useTranslation();
  const vmRef = useRef<VisionManagerHandle>(null);
  const { setHeader } = usePageHeader();

  // Status filter state
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [dimensionFilter, setDimensionFilter] = useState<
    UUID | null | undefined
  >(undefined);

  useEffect(() => {
    setHeader({
      actions: (
        <div className="flex items-center gap-2 flex-nowrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            <DimensionSelect
              value={dimensionFilter}
              onChange={(value) => setDimensionFilter(value)}
              placeholder={t("common.all")}
              showAllOption
              showNoneOption
              noneLabel={t("visions.filters.dimensionNone")}
              showLabel={false}
              fullWidth={false}
              className="min-w-[180px]"
              id="vision-dimension-filter"
            />
            <EnumSelect
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as string)}
              options={VISION_STATUS_FILTER_OPTIONS}
              autoWidth
              className="text-sm sm:text-base min-w-[140px]"
              id="vision-status-filter"
            />
          </div>

          <CreateNewButton
            label={t("common.create_new")}
            onClick={() => vmRef.current?.openCreateVision()}
          />
        </div>
      ),
    });
    return () => setHeader({ actions: undefined });
  }, [setHeader, t, statusFilter, dimensionFilter]);

  return (
    <PageLayout>
      <VisionManager
        ref={vmRef}
        statusFilter={statusFilter}
        dimensionFilter={dimensionFilter}
      />
    </PageLayout>
  );
};

export default VisionPage;
