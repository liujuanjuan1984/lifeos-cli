import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import StatusBadge from "@/components/StatusBadge";
import ErrorDisplay from "@/components/ErrorDisplay";
import { TextInput } from "@/components/forms";
import type {
  Vision,
  VisionExperienceRateUpdatePayload,
} from "@/services/api/visions";
import { VISION_EXPERIENCE_RATE_MAX } from "@/utils/constants";
import type { UUID } from "@/types/primitive";

interface VisionExperienceRatesTableValue {
  visions: Vision[];
  defaultRate: number;
  saving: boolean;
  error: string | null;
  onSave: (updates: VisionExperienceRateUpdatePayload[]) => Promise<boolean>;
  onRefresh: () => void;
}

interface VisionExperienceRatesTableProps {
  value: unknown;
  disabled: boolean;
  id: string;
  onChange: (value: unknown) => void;
  onSave: (value: unknown) => Promise<boolean>;
  saving: boolean;
  loading: boolean;
  error: string | null;
  "aria-describedby"?: string;
  "aria-labelledby"?: string;
}

type DraftMap = Record<UUID, string>;

const normalizeRateInput = (raw: string): string => {
  if (raw.trim() === "") {
    return "";
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  const rounded = Math.round(parsed);
  if (rounded < 1) {
    return "1";
  }
  if (rounded > VISION_EXPERIENCE_RATE_MAX) {
    return String(VISION_EXPERIENCE_RATE_MAX);
  }
  return String(rounded);
};

const VisionExperienceRatesTable = ({
  value,
  disabled,
  id,
  onChange: _onChange,
  onSave: _onSave,
  saving: _saving,
  loading: _loading,
  error: _errorProp,
  "aria-describedby": ariaDescribedBy,
}: VisionExperienceRatesTableProps) => {
  const { t } = useTranslation();
  const tableValue = (value as VisionExperienceRatesTableValue | undefined) ?? {
    visions: [],
    defaultRate: 60,
    saving: false,
    error: null,
    onSave: async () => true,
    onRefresh: () => undefined,
  };

  const { visions, defaultRate, saving, error, onSave, onRefresh } = tableValue;

  const [drafts, setDrafts] = useState<DraftMap>({});
  const [original, setOriginal] = useState<DraftMap>({});
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const nextDrafts: DraftMap = {};
    visions.forEach((vision) => {
      const rate =
        vision.experience_rate_per_hour === null ||
        vision.experience_rate_per_hour === undefined
          ? ""
          : String(vision.experience_rate_per_hour);
      nextDrafts[vision.id] = rate;
    });
    setDrafts(nextDrafts);
    setOriginal(nextDrafts);
    setLocalError(null);
  }, [visions]);

  const handleRateChange = useCallback((visionId: UUID, raw: string) => {
    setDrafts((prev) => ({
      ...prev,
      [visionId]: raw,
    }));
  }, []);

  const { updates, hasInvalid } = useMemo(() => {
    const pending: VisionExperienceRateUpdatePayload[] = [];
    let invalid = false;

    visions.forEach((vision) => {
      const draftValue = drafts[vision.id] ?? "";
      const originalValue = original[vision.id] ?? "";

      if (draftValue === originalValue) {
        return;
      }

      if (draftValue.trim() === "") {
        pending.push({
          id: vision.id,
          experience_rate_per_hour: null,
        });
        return;
      }

      const numeric = Number(draftValue);
      if (
        !Number.isInteger(numeric) ||
        numeric < 1 ||
        numeric > VISION_EXPERIENCE_RATE_MAX
      ) {
        invalid = true;
        return;
      }

      pending.push({
        id: vision.id,
        experience_rate_per_hour: numeric,
      });
    });

    return {
      updates: pending,
      hasInvalid: invalid,
    };
  }, [drafts, original, visions]);

  const isDirty = updates.length > 0;

  useEffect(() => {
    if (hasInvalid) {
      setLocalError(
        t("settings.visions.experienceTable.invalidRate", {
          min: 1,
          max: VISION_EXPERIENCE_RATE_MAX,
        }),
      );
    } else {
      setLocalError(null);
    }
  }, [hasInvalid, t]);

  useEffect(() => {
    if (!isDirty || hasInvalid || disabled || saving) {
      return;
    }

    const timer = window.setTimeout(async () => {
      const success = await onSave(updates);
      if (success) {
        onRefresh();
      }
    }, 600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [disabled, hasInvalid, isDirty, onRefresh, onSave, saving, updates]);

  return (
    <div id={id} aria-describedby={ariaDescribedBy} className="space-y-3">
      <p className="text-sm text-base-content/70">
        {t("settings.visions.experienceTable.hint", {
          max: VISION_EXPERIENCE_RATE_MAX,
        })}
      </p>

      <ErrorDisplay error={error} className="text-sm" />

      {localError && (
        <div className="alert alert-warning">
          <span className="text-sm">{localError}</span>
        </div>
      )}

      {visions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-base-300 p-6 text-center text-sm text-base-content/60">
          {t("settings.visions.experienceTable.empty")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-base-300">
          <table className="table table-zebra w-full">
            <thead>
              <tr className="text-sm uppercase text-base-content/60">
                <th className="bg-base-200">
                  {t("settings.visions.experienceTable.visionColumn")}
                </th>
                <th className="bg-base-200">
                  {t("settings.visions.experienceTable.statusColumn")}
                </th>
                <th className="bg-base-200 text-right">
                  {t("settings.visions.experienceTable.rateColumn")}
                </th>
              </tr>
            </thead>
            <tbody>
              {visions.map((vision) => {
                const draftValue = drafts[vision.id] ?? "";
                const originalValue = original[vision.id] ?? "";
                const isChanged = draftValue !== originalValue;

                return (
                  <tr
                    key={vision.id}
                    className={isChanged ? "bg-base-200/50" : undefined}
                  >
                    <td className="align-middle">
                      <div className="font-medium text-base-content">
                        {vision.name}
                      </div>
                    </td>
                    <td className="align-middle">
                      <StatusBadge status={vision.status} type="vision" />
                    </td>
                    <td className="align-middle">
                      <div className="flex items-center justify-end gap-2">
                        <TextInput
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          size="sm"
                          className="w-28 text-right"
                          value={draftValue}
                          onChange={(event) =>
                            handleRateChange(
                              vision.id,
                              normalizeRateInput(event.target.value),
                            )
                          }
                          disabled={disabled || saving}
                          aria-label={t(
                            "settings.visions.experienceTable.rateInputLabel",
                            { name: vision.name },
                          )}
                        />
                        <span className="text-xs text-base-content/50">
                          {t("settings.visions.experienceTable.rateUnit")}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-base-content/60">
          {t("settings.visions.experienceTable.footerHint", {
            defaultRate,
          })}
        </div>
        <div className="text-xs text-base-content/70">
          {saving
            ? t("settings.visions.experienceTable.saving")
            : isDirty
              ? t("settings.autoSavePending")
              : t("settings.autoSaveIdle")}
        </div>
      </div>
    </div>
  );
};

export default VisionExperienceRatesTable;
