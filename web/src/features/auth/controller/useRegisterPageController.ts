import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { apiRegister, apiLogin } from "@/services/api/auth";
import { invitationsApi } from "@/services/api";
import { invitationsKeys } from "@/services/api/queryKeys";
import { setToken, setUser, decodeJwtSub, clearAuth } from "@/services/auth";
import { detectTimezone, syncTimezonePreference } from "@/utils/datetime";
import { isUuid } from "@/utils/core";
import {
  validatePasswordStrength,
  type PasswordValidationResult,
} from "@/utils/session";

export function useRegisterPageController() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const search = useSearch({ from: "/register" }) as {
    invite?: string;
    email?: string;
  };

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordValidation, setPasswordValidation] =
    useState<PasswordValidationResult>(() => validatePasswordStrength(""));
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [inviteEmailSynced, setInviteEmailSynced] = useState(false);

  const urlInviteCode =
    typeof search?.invite === "string" && search.invite.trim().length > 0
      ? search.invite.trim()
      : undefined;
  const presetEmail =
    typeof search?.email === "string" && search.email.trim().length > 0
      ? search.email.trim()
      : undefined;

  const inviteCode = urlInviteCode;
  const inviteEnabled = Boolean(inviteCode);

  const inviteLookupQuery = useQuery({
    queryKey: invitationsKeys.lookup(inviteCode ?? ""),
    queryFn: () => invitationsApi.lookupInvitation(inviteCode as string),
    enabled: inviteEnabled,
    retry: false,
  });

  const inviteEmail = inviteLookupQuery.data?.target_email ?? presetEmail;
  const emailLocked = inviteEnabled && Boolean(inviteLookupQuery.data);
  const inviteInvalid = inviteEnabled && inviteLookupQuery.isError;

  useEffect(() => {
    setInviteEmailSynced(false);
  }, [inviteCode, presetEmail]);

  useEffect(() => {
    if (inviteEmail && !inviteEmailSynced) {
      setEmail(inviteEmail);
      setInviteEmailSynced(true);
    }
  }, [inviteEmail, inviteEmailSynced]);

  const handlePasswordChange = (nextPassword: string) => {
    setPassword(nextPassword);

    const validation = validatePasswordStrength(nextPassword);
    setPasswordValidation(validation);

    if (nextPassword.length > 0) {
      setPasswordError(null);
    }
  };

  const submitRegistration = async () => {
    setLoading(true);
    setError(null);
    setPasswordError(null);

    clearAuth();

    const validation = validatePasswordStrength(password);
    if (!validation.isValid) {
      setPasswordError(validation.errors[0] ?? null);
      setLoading(false);
      return;
    }

    try {
      const timezone = detectTimezone();
      await apiRegister({
        email,
        password,
        name,
        timezone,
        invite_code: inviteCode ?? "",
      });
      const res = await apiLogin({ email, password });
      const sub = decodeJwtSub(res.access_token);
      if (!sub) throw new Error(t("auth.invalidToken"));
      if (!isUuid(res.user.id)) throw new Error(t("auth.invalidUserId"));
      if (sub !== res.user.id) throw new Error(t("auth.tokenUserMismatch"));
      setToken(res.access_token, { expiresInSeconds: res.expires_in });
      setUser(res.user);
      await syncTimezonePreference({ force: true });
      navigate({ to: "/planning", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.registerFailed"));
    } finally {
      setLoading(false);
    }
  };

  return {
    email,
    setEmail,
    name,
    setName,
    password,
    setPassword: handlePasswordChange,
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
  };
}
