import { signIn } from '@/auth';
import { Button, Card, CardContent } from '@xcrm/ui';
import { PRODUCT_NAME } from '@xcrm/shared/constants';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const next = searchParams.next ?? '/';

  async function action(formData: FormData) {
    'use server';
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: next,
    });
  }

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
              Ops console
            </p>
            <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-fg">
              Sign in
            </h1>
            <p className="mt-1 text-sm text-fg-dim">
              Founders, partners, and VAs only. Portal users use a magic link.
            </p>
            <form action={action} className="mt-5 flex flex-col gap-3">
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
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-fg-muted">
                  Password
                </span>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="current-password"
                  className="h-9 rounded-md border border-line bg-base px-3 text-sm text-fg placeholder:text-fg-faint shadow-depth-flat focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-line-strong"
                />
              </label>
              {searchParams.error ? (
                <p className="text-[13px] text-destructive">
                  Sign-in failed. Check your credentials.
                </p>
              ) : null}
              <Button type="submit" className="mt-2 w-full">
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
