import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { apiLogin } from "@/services/api/auth";
import { setToken, setUser, decodeJwtSub, clearAuth } from "@/services/auth";
import { isUuid } from "@/utils/core";
import ActionButton from "@/components/ActionButton";
import ErrorDisplay from "@/components/ErrorDisplay";
import { FormField, TextInput } from "@/components/forms";
import { syncTimezonePreference } from "@/utils/datetime";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const next = (search as { next?: string })?.next || "/planning";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Clear any existing auth data before login attempt
    clearAuth();

    try {
      const res = await apiLogin({ email, password });
      const sub = decodeJwtSub(res.access_token);
      if (!sub) throw new Error(t("auth.invalidToken"));
      if (!isUuid(res.user.id)) throw new Error(t("auth.invalidUserId"));
      if (sub !== res.user.id) throw new Error(t("auth.tokenUserMismatch"));
      setToken(res.access_token, { expiresInSeconds: res.expires_in });
      setUser(res.user);
      await syncTimezonePreference();
      navigate({ to: next, replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <div className="w-full max-w-md bg-base-100 shadow-xl rounded-lg p-6">
        <h1 className="text-2xl font-bold text-base-content mb-6">
          {t("common.login")}
        </h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label={t("auth.email")} htmlFor="login-email" required>
            <TextInput
              id="login-email"
              name="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={t("auth.emailPlaceholder")}
            />
          </FormField>
          <FormField
            label={t("auth.password")}
            htmlFor="login-password"
            required
          >
            <TextInput
              id="login-password"
              name="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder={t("auth.passwordPlaceholder")}
            />
          </FormField>
          <ErrorDisplay error={error} className="text-sm" />
          <ActionButton
            label={loading ? t("common.login") : t("common.login")}
            type="submit"
            disabled={loading}
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
          {t("auth.noAccount")}
          <Link className="text-primary hover:underline ml-1" to="/register">
            {t("auth.goToRegister")}
          </Link>
        </div>
      </div>
    </div>
  );
}
