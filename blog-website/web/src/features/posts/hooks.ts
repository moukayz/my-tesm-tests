"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as postsApi from "@/features/posts/api";

export function usePostsInfiniteQuery({ limit = 20 }: { limit?: number } = {}) {
  return useInfiniteQuery({
    queryKey: ["posts", { limit }],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => postsApi.listPosts({ limit, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export function usePostQuery(postId: string) {
  return useQuery({
    queryKey: ["post", postId],
    queryFn: () => postsApi.getPost(postId),
    placeholderData: (prev) => prev,
  });
}

export function useCreatePostMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postsApi.createPost,
    onSuccess: async (data) => {
      qc.setQueryData(["post", data.post.id], data);
      await qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

export function useUpdatePostMutation(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: postsApi.UpdatePostRequest) => postsApi.updatePost(postId, body),
    onSuccess: async (data) => {
      qc.setQueryData(["post", postId], data);
      await qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

export function useDeletePostMutation(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postsApi.deletePost(postId),
    onSuccess: async () => {
      qc.removeQueries({ queryKey: ["post", postId] });
      await qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}
