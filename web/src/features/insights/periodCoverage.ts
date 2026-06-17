export interface PeriodCoverage {
  label: string;
  isComplete: boolean;
}

function normalizeMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.round(minutes));
}

function formatCoverageHourValue(minutes: number): string {
  const normalizedMinutes = normalizeMinutes(minutes);
  const hours = normalizedMinutes / 60;
  if (Number.isInteger(hours)) return String(hours);
  return hours.toFixed(2).replace(/\.?0+$/, "");
}

export function buildPeriodCoverage(
  actualMinutes: number,
  capacityMinutes: number,
): PeriodCoverage {
  const normalizedActualMinutes = normalizeMinutes(actualMinutes);
  const normalizedCapacityMinutes = normalizeMinutes(capacityMinutes);

  return {
    label: `${formatCoverageHourValue(normalizedActualMinutes)}/${formatCoverageHourValue(normalizedCapacityMinutes)}`,
    isComplete: normalizedActualMinutes === normalizedCapacityMinutes,
  };
}
