import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import ActionButton from "@/components/ActionButton";
import { FormField, TextInput } from "@/components/forms";
import PasswordStrengthHints from "@/components/auth/PasswordStrengthHints";
import { useToastMutation } from "@/hooks/useToastMutation";
import {
  apiChangePassword,
  type ChangePasswordRequest,
} from "@/services/api/auth";
import { clearAuth } from "@/services/auth";
import {
  validatePasswordStrength,
  type PasswordValidationResult,
} from "@/utils/session";

interface ChangePasswordCardProps {
  disabled?: boolean;
  className?: string;
}

export default function ChangePasswordCard({
  disabled = false,
  className,
}: ChangePasswordCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordValidation, setPasswordValidation] =
    useState<PasswordValidationResult>(() => validatePasswordStrength(""));
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isSubmitDisabled =
    disabled ||
    currentPassword.length === 0 ||
    newPassword.length === 0 ||
    confirmPassword.length === 0;

  const mutation = useToastMutation({
    mutationFn: async (payload: ChangePasswordRequest) =>
      await apiChangePassword(payload),
    getSuccessToast: () => ({
      description: t("auth.changeSuccess"),
    }),
    suppressSuccessToast: false,
    suppressErrorToast: true,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (newPassword !== confirmPassword) {
      setFormError(t("auth.passwordMismatch"));
      return;
    }

    if (!passwordValidation.isValid) {
      setFormError(passwordValidation.errors[0] ?? t("auth.changeFailed"));
      return;
    }

    try {
      await mutation.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirm: confirmPassword,
      });

      clearAuth();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordValidation(validatePasswordStrength(""));

      navigate({ to: "/login", replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("auth.changeFailed");
      setFormError(message);
    }
  };

  const helperText = useMemo(
    () => t("settings.accountSecurity.changePasswordDescription"),
    [t],
  );

  return (
    <form onSubmit={handleSubmit} className={className}>
      <p className="text-sm text-base-content/70 mb-4">{helperText}</p>
      <div className="space-y-4">
        <FormField
          label={t("auth.currentPassword")}
          htmlFor="current-password"
          required
        >
          <TextInput
            id="current-password"
            name="current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            autoComplete="current-password"
            disabled={disabled || mutation.isPending}
          />
        </FormField>

        <FormField
          label={t("auth.newPassword")}
          htmlFor="new-password"
          required
        >
          <TextInput
            id="new-password"
            name="new-password"
            type="password"
            value={newPassword}
            onChange={(event) => {
              const value = event.target.value;
              setNewPassword(value);
              setPasswordValidation(validatePasswordStrength(value));
            }}
            onFocus={() => setIsPasswordFocused(true)}
            onBlur={() => setIsPasswordFocused(false)}
            required
            autoComplete="new-password"
            disabled={disabled || mutation.isPending}
            className={
              newPassword.length > 0 && passwordValidation.isValid
                ? "input-success"
                : ""
            }
          />
          <PasswordStrengthHints
            password={newPassword}
            validation={passwordValidation}
            visible={isPasswordFocused || newPassword.length > 0}
          />
        </FormField>

        <FormField
          label={t("auth.confirmPassword")}
          htmlFor="confirm-password"
          required
        >
          <TextInput
            id="confirm-password"
            name="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            autoComplete="new-password"
            disabled={disabled || mutation.isPending}
          />
        </FormField>
      </div>

      {formError && <div className="text-error text-sm mt-3">{formError}</div>}

      <div className="mt-6">
        <ActionButton
          type="submit"
          label={t("auth.changePassword")}
          color="primary"
          variant="solid"
          disabled={isSubmitDisabled || mutation.isPending}
          className="w-full sm:w-auto"
          icon={
            mutation.isPending ? (
              <span
                className="loading loading-spinner loading-xs"
                aria-hidden
              />
            ) : undefined
          }
        />
      </div>
    </form>
  );
}
