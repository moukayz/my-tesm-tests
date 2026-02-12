import { AuthGuard } from "@/features/auth/components/auth-guard";
import { PostNewPage } from "@/features/posts/routes/post-new-page";

export default function Page() {
  return (
    <AuthGuard>
      <PostNewPage />
    </AuthGuard>
  );
}
