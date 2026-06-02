import type React from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ActionButton from "@/components/ActionButton";
import ErrorDisplay from "@/components/ErrorDisplay";
import { FormField, TextInput } from "@/components/forms";
import PasswordStrengthHints from "@/components/auth/PasswordStrengthHints";
import { useRegisterPageController } from "@/features/auth/controller/useRegisterPageController";

export default function RegisterPage() {
  const { t } = useTranslation();
  const {
    email,
    setEmail,
    name,
    setName,
    password,
    setPassword,
    loading,
    error,
    passwordError,
    passwordValidation,
    isPasswordFocused,
    setIsPasswordFocused,
    inviteLookupQuery,
    inviteEnabled,
    inviteInvalid,
    emailLocked,
    submitRegistration,
  } = useRegisterPageController();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitRegistration();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <div className="w-full max-w-md bg-base-100 shadow-xl rounded-lg p-6">
        <h1 className="text-2xl font-bold text-base-content mb-6">
          {t("common.register")}
        </h1>
        {inviteEnabled && inviteLookupQuery.fetchStatus === "fetching" ? (
          <div className="alert alert-info mb-4 text-sm">
            {t("invitations.register.verifying")}
          </div>
        ) : inviteLookupQuery.isError ? (
          <ErrorDisplay
            error={t("invitations.register.invalid")}
            className="mb-4 text-sm"
          />
        ) : inviteLookupQuery.data ? (
          <div className="alert alert-success mb-4 text-sm">
            <div>
              <div className="font-semibold">
                {t("invitations.register.valid")}
              </div>
              <div className="text-base-content/80">
                {t("invitations.register.invitee", {
                  email: inviteLookupQuery.data.target_email,
                })}
              </div>
              {inviteLookupQuery.data.creator_name ? (
                <div className="text-base-content/70">
                  {inviteLookupQuery.data.creator_email
                    ? t("invitations.register.inviterWithEmail", {
                        name: inviteLookupQuery.data.creator_name,
                        email: inviteLookupQuery.data.creator_email,
                      })
                    : t("invitations.register.inviterName", {
                        name: inviteLookupQuery.data.creator_name,
                      })}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {/* Beta registration notice */}
        <div className="alert alert-info mb-4 text-sm">
          <div>
            <div className="font-semibold">
              {t("register.betaNotice.title")}
            </div>
            <div className="text-base-content/80">
              {t("register.betaNotice.description")}
            </div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label={t("auth.email")} htmlFor="register-email" required>
            <TextInput
              id="register-email"
              name="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={t("auth.emailPlaceholder")}
              disabled={emailLocked}
            />
          </FormField>
          <FormField label={t("auth.name")} htmlFor="register-name" required>
            <TextInput
              id="register-name"
              name="register-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={t("auth.namePlaceholder")}
            />
          </FormField>
          <FormField
            label={t("auth.password")}
            htmlFor="register-password"
            required
          >
            <TextInput
              id="register-password"
              name="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
              required
              placeholder={t("auth.passwordPlaceholder")}
              className={
                passwordError
                  ? "input-error"
                  : password.length > 0 && passwordValidation.isValid
                    ? "input-success"
                    : ""
              }
            />
            <PasswordStrengthHints
              password={password}
              validation={passwordValidation}
              visible={isPasswordFocused || password.length > 0}
            />
            {passwordError && (
              <div className="text-error text-sm mt-1">{passwordError}</div>
            )}
          </FormField>
          {(error || passwordError) && (
            <div className="text-error text-base">{passwordError || error}</div>
          )}
          <ActionButton
            label={t("common.register")}
            type="submit"
            disabled={
              loading ||
              (inviteEnabled && inviteLookupQuery.isPending) ||
              inviteInvalid ||
              (password.length > 0 && !passwordValidation.isValid)
            }
            color="primary"
            variant="solid"
            className="w-full"
            icon={
              loading ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : undefined
            }
          />
        </form>
        <div className="mt-4 text-base text-base-content/70">
          {t("auth.haveAccount")}
          <Link className="text-primary hover:underline ml-1" to="/login">
            {t("auth.goToLogin")}
          </Link>
        </div>
      </div>
    </div>
  );
}
