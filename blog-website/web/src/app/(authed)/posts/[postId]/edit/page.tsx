import { AuthGuard } from "@/features/auth/components/auth-guard";
import { PostEditPage } from "@/features/posts/routes/post-edit-page";

export default async function Page({
  params,
}: {
  params: { postId: string } | Promise<{ postId: string }>;
}) {
  // Next.js app router may provide `params` as a Promise in newer versions.
  const { postId } = await params;
  return (
    <AuthGuard>
      <PostEditPage postId={postId} />
    </AuthGuard>
  );
}
