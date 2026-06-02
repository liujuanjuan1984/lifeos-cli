import { useTranslation } from "react-i18next";
import { type DailyNutritionSummary } from "@/services/api";
import Card from "@/layouts/Card";
import { Icon, type IconName } from "./icons";

interface NutritionSummarySidebarProps {
  nutrition: DailyNutritionSummary | null;
  entryCount: number;
  className?: string;
}

export default function NutritionSummarySidebar({
  nutrition,
  entryCount,
  className = "",
}: NutritionSummarySidebarProps) {
  const { t } = useTranslation();
  if (!nutrition) {
    return (
      <Card
        title={t("nutritionSummarySidebar.todayNutritionIntake")}
        className={className}
      >
        <div className="text-center text-base-content/60">
          <div className="text-base">
            {t("nutritionSummarySidebar.noNutritionData")}
          </div>
        </div>
      </Card>
    );
  }

  const nutritionItems: Array<{
    key: keyof DailyNutritionSummary;
    label: string;
    unit: string;
    color: string;
    bgColor: string;
    iconName: IconName;
  }> = [
    {
      key: "total_calories",
      label: t("nutritionSummarySidebar.calories"),
      unit: t("nutritionSummarySidebar.caloriesUnit"),
      color: "text-warning",
      bgColor: "bg-warning/10",
      iconName: "fire",
    },
    {
      key: "total_protein",
      label: t("nutritionSummarySidebar.protein"),
      unit: t("nutritionSummarySidebar.proteinUnit"),
      color: "text-info",
      bgColor: "bg-info/10",
      iconName: "sparkles",
    },
    {
      key: "total_carbs",
      label: t("nutritionSummarySidebar.carbs"),
      unit: t("nutritionSummarySidebar.proteinUnit"),
      color: "text-success",
      bgColor: "bg-success/10",
      iconName: "chart",
    },
    {
      key: "total_fat",
      label: t("nutritionSummarySidebar.fat"),
      unit: t("nutritionSummarySidebar.proteinUnit"),
      color: "text-error",
      bgColor: "bg-error/10",
      iconName: "star",
    },
  ];

  return (
    <Card
      title={t("nutritionSummarySidebar.todayNutritionIntake")}
      className={className}
    >
      <div className="mb-3">
        <p className="text-base text-base-content/60">
          {t("nutritionSummarySidebar.entryCount", { count: entryCount })}
        </p>
      </div>

      <div className="space-y-3">
        {nutritionItems.map((item) => {
          const value =
            (nutrition[item.key as keyof DailyNutritionSummary] as number) || 0;
          return (
            <div key={item.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full ${item.bgColor} flex items-center justify-center`}
                >
                  <Icon
                    name={item.iconName}
                    size={18}
                    aria-hidden
                    className={item.color}
                  />
                </div>
                <span className="text-base text-base-content">
                  {item.label}
                </span>
              </div>
              <div className="text-right">
                <div className={`text-base font-semibold ${item.color}`}>
                  {Math.round(value)}
                </div>
                <div className="text-base text-base-content/60">
                  {value.toFixed(1)}
                  {item.unit}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional nutrition info if available */}
      {(nutrition.total_fiber || nutrition.total_sugar) && (
        <div className="mt-4 pt-3 border-t border-base-200">
          <div className="space-y-2">
            {nutrition.total_fiber && (
              <div className="flex justify-between text-base">
                <span className="text-base-content/70">
                  {t("nutritionSummarySidebar.fiber")}
                </span>
                <span className="text-base-content">
                  {nutrition.total_fiber.toFixed(1)}g
                </span>
              </div>
            )}
            {nutrition.total_sugar && (
              <div className="flex justify-between text-base">
                <span className="text-base-content/70">
                  {t("nutritionSummarySidebar.sugar")}
                </span>
                <span className="text-base-content">
                  {nutrition.total_sugar.toFixed(1)}g
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
