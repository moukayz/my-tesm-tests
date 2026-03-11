import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    error: '/auth-error',
  },
  callbacks: {
    signIn({ user }) {
      const allowed = process.env.ALLOWED_EMAIL
      if (!allowed) return true
      return user.email === allowed
    },
  },
})
