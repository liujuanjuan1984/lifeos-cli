import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUserLlmCredentials } from "@/hooks/queries/useUserLlmCredentials";
import { useToast } from "@/contexts/ToastContext";
import ActionButton, {
  DeleteButton,
  ActionButtonGroup,
} from "@/components/ActionButton";
import ConfirmDialog from "@/components/ConfirmDialog";
import Badge from "@/components/common/Badge";
import EmptyState from "@/components/EmptyState";
import ErrorDisplay from "@/components/ErrorDisplay";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Checkbox, TextInput } from "@/components/forms";
import { Icon } from "@/components/icons";
import { formatDateTime } from "@/utils/datetime";

interface UserLlmCredentialsCardProps {
  disabled: boolean;
  id: string;
}

const PROVIDER_OPTIONS = ["openai", "azure-openai", "custom"];

const initialFormState = {
  provider: "openai",
  displayName: "",
  apiKey: "",
  apiBase: "",
  modelOverride: "",
  makeDefault: true,
};

export const UserLlmCredentialsCard: React.FC<UserLlmCredentialsCardProps> = ({
  disabled,
  id,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const {
    credentials,
    isLoading,
    error,
    createCredential,
    setDefaultCredential,
    deleteCredential,
    refresh,
    testCredential,
    isTesting,
  } = useUserLlmCredentials();
  const [formState, setFormState] = useState(initialFormState);
  const [formSaving, setFormSaving] = useState(false);
  const [deletingCredential, setDeletingCredential] = useState<{
    id: string;
    displayName: string;
  } | null>(null);

  const handleChange = (
    field: keyof typeof initialFormState,
    value: string,
  ) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleToggleDefault = () => {
    setFormState((prev) => ({
      ...prev,
      makeDefault: !prev.makeDefault,
    }));
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!formState.apiKey.trim()) {
      toast.showError(t("settings.llm.errors.missingKey"));
      return;
    }
    setFormSaving(true);
    try {
      await createCredential({
        provider: formState.provider,
        api_key: formState.apiKey.trim(),
        display_name: formState.displayName.trim() || null,
        api_base: formState.apiBase.trim() || null,
        model_override: formState.modelOverride.trim() || null,
        make_default: formState.makeDefault,
      });
      setFormState((prev) => ({
        ...initialFormState,
        provider: prev.provider,
      }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("settings.saveFailed");
      toast.showError(message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleSetDefault = async (credentialId: string) => {
    try {
      await setDefaultCredential(credentialId);
    } catch (err) {
      toast.showError(
        err instanceof Error ? err.message : t("settings.saveFailed"),
      );
    }
  };

  const handleDelete = (credentialId: string, displayName: string) => {
    setDeletingCredential({
      id: credentialId,
      displayName: displayName || credentialId,
    });
  };

  const confirmDelete = async () => {
    if (!deletingCredential) return;
    try {
      await deleteCredential(deletingCredential.id);
    } catch (err) {
      toast.showError(
        err instanceof Error ? err.message : t("settings.saveFailed"),
      );
    } finally {
      setDeletingCredential(null);
    }
  };

  const formattedError =
    error?.message ??
    (error ? t("settings.llm.errors.genericError") : undefined);

  return (
    <div id={id}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-base-content">
            {t("settings.llm.credentials.label")}
          </h3>
          <p className="text-sm text-base-content/70">
            {t("settings.llm.credentials.description")}
          </p>
        </div>
        <ActionButton
          label={t("common.refresh")}
          iconName="refresh"
          color="neutral"
          size="sm"
          variant="outline"
          onClick={() => {
            void refresh();
          }}
          disabled={isLoading || disabled}
          iconOnly
        />
      </div>

      <ErrorDisplay error={formattedError ?? null} className="text-sm" />

      <div className="space-y-3">
        {isLoading && !credentials.length ? (
          <LoadingSpinner size="sm" className="py-4" />
        ) : null}

        {!isLoading && credentials.length === 0 ? (
          <EmptyState
            icon={
              <Icon
                name="inbox"
                size={36}
                aria-hidden
                className="text-base-content/40"
              />
            }
            title={t("settings.llm.credentials.empty")}
            className="py-6"
          />
        ) : null}

        {credentials.map((credential) => (
          <div
            key={credential.id}
            className="rounded-md border border-base-300 p-3 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-base font-medium text-base-content">
                  <span>{credential.displayName || credential.provider}</span>
                  {credential.isDefault ? (
                    <Badge tone="primary" size="sm">
                      {t("settings.llm.credentials.defaultBadge")}
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs text-base-content/70">
                  {t("settings.llm.credentials.tokenPreview", {
                    last4: credential.tokenLast4 ?? "****",
                  })}
                </div>
                <div className="text-xs text-base-content/50">
                  {t("settings.llm.credentials.updatedAt", {
                    value: formatDateTime(credential.updatedAt),
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!credential.isDefault ? (
                  <ActionButton
                    label={t("settings.llm.actions.makeDefault")}
                    iconName="star"
                    color="primary"
                    size="xs"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => {
                      void handleSetDefault(credential.id);
                    }}
                    iconOnly
                  />
                ) : null}
                <DeleteButton
                  size="xs"
                  disabled={disabled}
                  onClick={() => {
                    handleDelete(credential.id, credential.displayName || "");
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="divider">{t("settings.llm.credentials.addNew")}</div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text">
                {t("settings.llm.form.provider")}
              </span>
            </div>
            <select
              className="select select-bordered"
              value={formState.provider}
              onChange={(event) => handleChange("provider", event.target.value)}
              disabled={disabled || formSaving}
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`settings.llm.providers.${option}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-control w-full">
            <div className="label">
              <span className="label-text">
                {t("settings.llm.form.displayName")}
              </span>
            </div>
            <TextInput
              type="text"
              value={formState.displayName}
              onChange={(event) =>
                handleChange("displayName", event.target.value)
              }
              placeholder={t("settings.llm.form.displayNamePlaceholder")}
              disabled={disabled || formSaving}
            />
          </label>
        </div>

        <label className="form-control w-full">
          <div className="label">
            <span className="label-text">{t("settings.llm.form.apiKey")}</span>
          </div>
          <TextInput
            type="password"
            value={formState.apiKey}
            onChange={(event) => handleChange("apiKey", event.target.value)}
            placeholder="sk-..."
            disabled={disabled || formSaving}
            autoComplete="off"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text">
                {t("settings.llm.form.apiBase")}
              </span>
            </div>
            <TextInput
              type="url"
              value={formState.apiBase}
              onChange={(event) => handleChange("apiBase", event.target.value)}
              placeholder="https://api.openai.com/v1"
              disabled={disabled || formSaving}
            />
          </label>

          <label className="form-control w-full">
            <div className="label">
              <span className="label-text">
                {t("settings.llm.form.modelOverride")}
              </span>
            </div>
            <TextInput
              type="text"
              value={formState.modelOverride}
              onChange={(event) =>
                handleChange("modelOverride", event.target.value)
              }
              placeholder="gpt-4.1-mini"
              disabled={disabled || formSaving}
            />
          </label>
        </div>

        <Checkbox
          checked={formState.makeDefault}
          onCheckedChange={handleToggleDefault}
          disabled={disabled || formSaving}
          size="sm"
          variant="primary"
          label={t("settings.llm.form.makeDefault")}
        />

        <ActionButtonGroup gap="lg" align="start">
          <ActionButton
            type="submit"
            label={
              formSaving
                ? t("common.saving")
                : t("settings.llm.credentials.saveButton")
            }
            iconName={formSaving ? undefined : "check"}
            color="primary"
            size="sm"
            variant="solid"
            disabled={disabled || formSaving}
          />
          <ActionButton
            label={
              isTesting
                ? t("common.testing")
                : t("settings.llm.actions.testConnection")
            }
            iconName={isTesting ? undefined : "bolt"}
            color="neutral"
            size="sm"
            variant="outline"
            disabled={
              disabled || formSaving || isTesting || !formState.apiKey.trim()
            }
            onClick={() => {
              void testCredential({
                provider: formState.provider,
                api_key: formState.apiKey.trim(),
                api_base: formState.apiBase.trim() || null,
                model_override: formState.modelOverride.trim() || null,
              });
            }}
          />
        </ActionButtonGroup>
      </form>

      <ConfirmDialog
        isOpen={!!deletingCredential}
        title={t("common.confirm")}
        message={t("settings.llm.confirmDelete", {
          name: deletingCredential?.displayName ?? "",
        })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingCredential(null)}
      />
    </div>
  );
};
