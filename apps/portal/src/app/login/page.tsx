import { Button, Card, CardContent } from '@xcrm/ui';
import { PRODUCT_NAME } from '@xcrm/shared/constants';
import { prisma } from '@xcrm/db';
import crypto from 'node:crypto';
import { z } from 'zod';

const emailSchema = z.string().email();

async function requestMagicLink(formData: FormData) {
  'use server';
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) return;
  const user = await prisma.agencyUser.findFirst({
    where: { email: parsed.data, deletedAt: null },
  });
  if (!user) return; // silent — don't leak account existence
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await prisma.agencyMagicLink.create({
    data: {
      agencyUserId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
  // Phase 0: deliberately no email send. Resend integration lands in Phase 3.
  // Links are visible via an admin-only console during development.
}

export default function PortalLogin({
  searchParams,
}: {
  searchParams: { sent?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-base p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span
            aria-hidden
            className="h-7 w-7 rounded-md"
            style={{
              background:
                'conic-gradient(from 180deg, oklch(72% 0.17 25), oklch(72% 0.17 60), oklch(72% 0.17 135), oklch(72% 0.17 210), oklch(72% 0.17 290), oklch(72% 0.17 25))',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.4), 0 0 18px rgba(255,255,255,0.05)',
            }}
          />
          <span className="text-[15px] font-semibold tracking-tight text-fg">{PRODUCT_NAME}</span>
        </div>
        <Card depth="modal">
          <CardContent className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Agency portal
            </p>
            <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-fg">
              Sign in with a magic link
            </h1>
            <p className="mt-1 text-sm text-fg-dim">
              We&apos;ll email you a single-use link that expires in 15 minutes.
            </p>
            <form action={requestMagicLink} className="mt-5 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-fg-muted">
                  Email
                </span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="h-9 rounded-md border border-line bg-base px-3 text-sm text-fg placeholder:text-fg-faint shadow-depth-flat focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-line-strong"
                />
              </label>
              <Button type="submit" className="mt-2 w-full">
                Send magic link
              </Button>
              {searchParams.sent ? (
                <p className="text-[13px] text-fg-dim">
                  If that address matches an account, a link is on the way.
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
