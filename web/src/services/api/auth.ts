import { http } from "./client";
import { ENDPOINTS } from "./endpoints";
import type { AuthUser } from "@/services/auth";
import type { UUID } from "@/types/primitive";

type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
};

type RegisterRequest = {
  email: string;
  password: string;
  name: string;
  timezone?: string;
  invite_code?: string;
};

export type RegisterResponse = {
  id: UUID;
  email: string;
  name: string;
  is_superuser?: boolean;
  timezone?: string;
};

export type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
  new_password_confirm?: string;
};

type ChangePasswordResponse = {
  message: string;
};

export async function apiLogin(req: LoginRequest) {
  return http.post<LoginResponse>(ENDPOINTS.AUTH.LOGIN, req);
}

export async function apiRegister(req: RegisterRequest) {
  return http.post<RegisterResponse>(ENDPOINTS.AUTH.REGISTER, req);
}

export async function apiMe() {
  return http.get<AuthUser>(ENDPOINTS.AUTH.ME);
}

export async function apiChangePassword(req: ChangePasswordRequest) {
  return http.post<ChangePasswordResponse>(ENDPOINTS.AUTH.CHANGE_PASSWORD, req);
}

export async function apiLogout() {
  return http.post<void>(ENDPOINTS.AUTH.LOGOUT);
}
