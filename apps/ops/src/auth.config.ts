import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe Auth.js config. Imported by middleware (which runs on Edge).
 * Providers that touch the DB are attached in `./auth.ts` — Node runtime only.
 */
export const authConfig = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.uid = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (typeof token.uid === 'string') {
        (session.user as { id: string }).id = token.uid;
      }
      if (typeof token.role === 'string') {
        (session.user as { role: string }).role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
