import type { ErrorResponse } from "@/lib/contracts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";

export class ApiError extends Error {
  status: number;
  payload?: ErrorResponse;

  constructor(status: number, message: string, payload?: ErrorResponse) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;

const parseErrorResponse = async (response: Response) => {
  try {
    return (await response.json()) as ErrorResponse;
  } catch {
    return undefined;
  }
};

export const apiFetch = async <T>(
  path: string,
  init?: RequestInit
): Promise<T> => {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = await parseErrorResponse(response);
    const message = payload?.error?.message ?? response.statusText;
    throw new ApiError(response.status, message, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const streamFetch = async (
  path: string,
  init?: RequestInit
): Promise<Response> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = await parseErrorResponse(response);
    const message = payload?.error?.message ?? response.statusText;
    throw new ApiError(response.status, message, payload);
  }

  return response;
};
