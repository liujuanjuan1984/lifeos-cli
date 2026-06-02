import type { Tag } from "@/services/api/tags";
import { CreateNewButton } from "@/components/ActionButton";
import Chip from "@/components/common/Chip";
import { Icon } from "@/components/icons";
import { useTranslation } from "react-i18next";

interface FinanceTagToolbarProps {
  tags: Tag[];
  onAddTag: () => void;
  onSelectTag: (tag: Tag) => void;
  loading?: boolean;
  saving?: boolean;
}

function FinanceTagToolbar({
  tags,
  onAddTag,
  onSelectTag,
  loading = false,
  saving = false,
}: FinanceTagToolbarProps) {
  const { t } = useTranslation();

  return (
    <section className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Icon name="tag" size={18} aria-hidden className="text-primary" />
          <span className="text-sm font-semibold text-base-content">
            {t("finance.tagToolbar.title")}
          </span>
        </div>

        {loading ? (
          <span className="text-sm text-base-content/70">
            {t("common.loading")}
          </span>
        ) : tags.length === 0 ? (
          <span className="text-sm text-base-content/70">
            {t("finance.tagToolbar.empty")}
          </span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Chip
                key={tag.id}
                onClick={() => onSelectTag(tag)}
                tone="primary"
                size="sm"
                icon={
                  <Icon
                    name="document-text"
                    size={14}
                    aria-hidden
                    className="text-primary"
                  />
                }
              >
                <span className="truncate max-w-[8rem]">#{tag.name}</span>
              </Chip>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <CreateNewButton
            label={t("finance.tagToolbar.followTag")}
            ariaLabel={t("finance.tagToolbar.followTag")}
            icon={<Icon name="eye" size={16} aria-hidden />}
            size="sm"
            onClick={onAddTag}
            disabled={saving}
          />
        </div>
      </div>
    </section>
  );
}

export default FinanceTagToolbar;
