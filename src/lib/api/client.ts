/**
 * The single browser API client (CLAUDE.md §6, §11).
 *
 * - openapi-fetch typed against the generated `paths` (schema.d.ts).
 * - REQUEST middleware adds `Authorization: Bearer <token>` from the AuthService
 *   adapter (today the dev-stub `dev.<uid>.<email>`).
 * - RESPONSE middleware UNWRAPS the backend's `{ success, data }` envelope so
 *   callers/hooks see the documented inner shape directly, and throws `ApiError`
 *   on any non-2xx (including 401 — which signs the user out).
 *
 * Components NEVER import this directly — they go through a typed entity hook
 * (§6). The recording PointUploader is the one non-hook consumer.
 */
import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "@/lib/api/schema";
import { getAuthService } from "@/adapters";

/** Base URL of the NestJS API (global prefix `/api`). In dev, Vite proxies `/api`. */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

/** Thrown on any non-2xx response. Carries the parsed body for callers. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** Backend success envelope. The OpenAPI spec documents the inner `data` shape. */
interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

/** Nest's default error body. */
interface ErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

function errorMessage(body: ErrorBody | undefined, status: number): string {
  if (!body) return `Request failed (${status})`;
  if (Array.isArray(body.message)) return body.message.join(", ");
  return body.message ?? body.error ?? `Request failed (${status})`;
}

/**
 * Hook the api client can call on 401 without importing the auth provider
 * (avoids a cycle). AuthProvider registers a handler at mount.
 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const token = await getAuthService().getIdToken();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
  async onResponse({ response }) {
    // 204 / empty: nothing to unwrap.
    const clone = response.clone();
    const text = await clone.text();
    const parsed: unknown = text ? safeJson(text) : undefined;

    if (!response.ok) {
      if (response.status === 401) onUnauthorized?.();
      throw new ApiError(
        response.status,
        errorMessage(parsed as ErrorBody, response.status),
        parsed,
      );
    }

    // Unwrap `{ success, data }` -> `data`. Re-wrap as a Response so openapi-fetch
    // surfaces `data` in its `{ data, error }` result.
    const unwrapped =
      parsed && typeof parsed === "object" && "success" in parsed && "data" in parsed
        ? (parsed as SuccessEnvelope<unknown>).data
        : parsed;

    return new Response(unwrapped === undefined ? null : JSON.stringify(unwrapped), {
      status: response.status,
      statusText: response.statusText,
      headers: { "content-type": "application/json" },
    });
  },
};

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const apiClient = createClient<paths>({ baseUrl: API_BASE_URL });
apiClient.use(authMiddleware);
