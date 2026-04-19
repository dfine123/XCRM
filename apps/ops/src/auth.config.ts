import type { NextAuthConfig } from 'next-auth';
import type { UserRole } from '@xcrm/db';

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
        token.role = (user as { role: UserRole }).role;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (typeof token.uid === 'string') {
        (session.user as { id: string }).id = token.uid;
      }
      if (token.role) {
        (session.user as { role: UserRole }).role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
