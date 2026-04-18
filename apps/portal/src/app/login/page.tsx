import { Button, Card, CardContent, CardHeader, CardTitle } from '@xcrm/ui';
import { PRODUCT_NAME } from '@xcrm/shared/constants';
import { prisma } from '@xcrm/db';
import crypto from 'node:crypto';
import { z } from 'zod';

const emailSchema = z.string().email();

async function requestMagicLink(formData: FormData) {
  'use server';
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) return;
  const user = await prisma.agencyUser.findUnique({ where: { email: parsed.data } });
  if (!user || user.deletedAt) return; // silent — don't leak account existence
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
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{PRODUCT_NAME} · agency portal</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={requestMagicLink} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Email</span>
              <input
                name="email"
                type="email"
                required
                className="rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <Button type="submit" className="mt-2">
              Send magic link
            </Button>
            {searchParams.sent ? (
              <p className="text-sm text-muted-foreground">
                If that address matches an account, a link is on the way.
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
