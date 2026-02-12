import { PostDetailPage } from "@/features/posts/routes/post-detail-page";

export default async function Page({
  params,
}: {
  params: { postId: string } | Promise<{ postId: string }>;
}) {
  // Next.js app router may provide `params` as a Promise in newer versions.
  const { postId } = await params;
  return <PostDetailPage postId={postId} />;
}
