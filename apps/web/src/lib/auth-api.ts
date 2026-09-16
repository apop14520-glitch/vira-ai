"use client";

import { ApiClientError, apiJson, apiRequest } from "@/lib/api-client";

export type AdminSession = {
  authenticated: true;
  username: string;
  organization_id: string;
};

export type LoginResponse = { authenticated: true; username: string };
export type InitialSetupStatus = { required: boolean; configured: boolean };

export function getInitialSetupStatus(): Promise<InitialSetupStatus> {
  return apiJson<InitialSetupStatus>("/api/v1/auth/setup-status");
}

export function setupInitialAdmin(
  username: string,
  password: string,
  confirmation: string,
  setupToken: string,
): Promise<LoginResponse> {
  return apiJson<LoginResponse>("/api/v1/auth/setup", {
    method: "POST",
    body: JSON.stringify({ username, password, confirmation, setup_token: setupToken }),
  });
}

export async function getSession(): Promise<AdminSession | null> {
  try {
    return await apiJson<AdminSession>("/api/v1/auth/session");
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) return null;
    throw error;
  }
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return apiJson<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function logout(): Promise<void> {
  await apiRequest("/api/v1/auth/logout", { method: "POST" });
}

export async function changePassword(currentPassword: string, newPassword: string, confirmation: string): Promise<void> {
  await apiRequest("/api/v1/auth/password", {
    method: "PUT",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword, confirmation }),
  });
}
