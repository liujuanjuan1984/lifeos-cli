import React from "react";
import { useTranslation } from "react-i18next";
import type { PersonSummary } from "@/services/api";
import UnifiedTag from "@/components/UnifiedTag";

interface PersonTooltipContentProps {
  person: PersonSummary;
}

const PersonTooltipContent: React.FC<PersonTooltipContentProps> = ({
  person,
}) => {
  const { t } = useTranslation();
  const tags = Array.isArray(person.tags) ? person.tags : [];
  const locationTags = tags.filter((tag) => tag.category === "location");

  return (
    <div className="space-y-2">
      <div className="text-base font-semibold text-base-content">
        {t("notes.tooltip.person.title", { name: person.display_name })}
      </div>
      <dl className="space-y-1 text-sm text-base-content/80">
        {person.primary_nickname ? (
          <div className="flex items-start gap-2">
            <dt className="font-medium text-base-content/70">
              {t("notes.tooltip.person.nickname")}:
            </dt>
            <dd className="text-base-content">{person.primary_nickname}</dd>
          </div>
        ) : null}
        {locationTags.length > 0 || person.location ? (
          <div className="flex items-start gap-2">
            <dt className="font-medium text-base-content/70">
              {t("notes.tooltip.person.location")}:
            </dt>
            <dd className="text-base-content">
              {locationTags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {locationTags.map((tag) => (
                    <UnifiedTag key={tag.id} type="location" size="sm">
                      {tag.name}
                    </UnifiedTag>
                  ))}
                </div>
              ) : (
                person.location
              )}
            </dd>
          </div>
        ) : null}
        <div className="flex items-start gap-2">
          <dt className="font-medium text-base-content/70">
            {t("notes.tooltip.person.tags")}:
          </dt>
          <dd className="text-base-content">
            {tags.length === 0 ? (
              <span>{t("notes.tooltip.person.noTags")}</span>
            ) : (
              <ul className="space-y-0.5">
                {tags.map((tag) => (
                  <li key={tag.id}>#{tag.name}</li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
};

export default PersonTooltipContent;
