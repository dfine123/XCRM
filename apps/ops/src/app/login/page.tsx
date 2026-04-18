import { signIn } from '@/auth';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@xcrm/ui';
import { PRODUCT_NAME } from '@xcrm/shared/constants';

export default function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
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
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{PRODUCT_NAME} · sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Email</span>
              <input
                name="email"
                type="email"
                required
                className="rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Password</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            {searchParams.error ? (
              <p className="text-sm text-destructive">Sign-in failed. Check your credentials.</p>
            ) : null}
            <Button type="submit" className="mt-2">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
