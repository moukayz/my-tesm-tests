"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import React from "react";
import type { components } from "@/shared/api/openapi";
import { setCsrfToken } from "@/shared/api/csrf";
import { ApiError } from "@/shared/api/errors";
import * as authApi from "@/features/auth/api";

type SessionResponse = components["schemas"]["SessionResponse"];

const sessionKey = ["session"] as const;

async function refreshSession(qc: QueryClient) {
  // After a successful auth mutation we must refetch immediately.
  // Using a long staleTime here can return the cached unauthenticated session.
  await qc.invalidateQueries({ queryKey: sessionKey, exact: true });
  const session = await qc.fetchQuery({
    queryKey: sessionKey,
    queryFn: authApi.getSession,
    staleTime: 0,
  });
  if (session.authenticated) setCsrfToken(session.csrfToken);
  else setCsrfToken(null);
  return session;
}

export function useSessionQuery() {
  const q = useQuery<authApi.SessionResponse, ApiError>({
    queryKey: sessionKey,
    queryFn: authApi.getSession,
    staleTime: 60_000,
  });

  // TanStack Query v5 does not support onSuccess/onError callbacks.
  React.useEffect(() => {
    if (!q.data) return;
    if (q.data.authenticated) setCsrfToken(q.data.csrfToken);
    else setCsrfToken(null);
  }, [q.data]);

  return q;
}

export function useLoginMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: async () => {
      await refreshSession(qc);
    },
  });
}

export function useRegisterMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: async () => {
      await refreshSession(qc);
    },
  });
}

export function useLogoutMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout();
      } catch (e) {
        if (e instanceof ApiError) {
          if (e.status === 401) {
            // Treat as already logged out.
          } else if (e.status === 403 && e.code === "forbidden") {
            // Attempt stale-token recovery once.
            await refreshSession(qc);
            await authApi.logout();
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }

      setCsrfToken(null);
      qc.setQueryData<SessionResponse>(sessionKey, { authenticated: false });
    },
  });
}
