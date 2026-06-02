import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icons";
import type { PasswordValidationResult } from "@/utils/session";

interface PasswordStrengthHintsProps {
  password: string;
  validation: PasswordValidationResult;
  visible: boolean;
}

function PasswordStrengthHints({
  password,
  validation,
  visible,
}: PasswordStrengthHintsProps) {
  const { t } = useTranslation();

  if (!visible) {
    return null;
  }

  const requirements = [
    {
      key: "minLength" as const,
      label: t("auth.passwordRequirements.minLength"),
      met: validation.requirements.minLength,
    },
    {
      key: "uppercase" as const,
      label: t("auth.passwordRequirements.uppercase"),
      met: validation.requirements.uppercase,
    },
    {
      key: "lowercase" as const,
      label: t("auth.passwordRequirements.lowercase"),
      met: validation.requirements.lowercase,
    },
    {
      key: "digit" as const,
      label: t("auth.passwordRequirements.digit"),
      met: validation.requirements.digit,
    },
    {
      key: "special" as const,
      label: t("auth.passwordRequirements.special"),
      met: validation.requirements.special,
    },
  ];

  return (
    <div className="mt-2 p-3 bg-base-200 rounded-lg text-sm animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="font-medium text-base-content/80 mb-1">
        {t("auth.passwordRequirements.title")}
      </div>
      <ul className="space-y-1 text-base-content/60">
        {requirements.map((requirement) => {
          const className = requirement.met
            ? "text-success"
            : password.length > 0
              ? "text-error"
              : "";
          return (
            <li key={requirement.key} className={className}>
              {requirement.met ? (
                <Icon name="check" size={14} aria-hidden />
              ) : (
                <span aria-hidden>•</span>
              )}{" "}
              {requirement.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default PasswordStrengthHints;
