import { Card, CardContent, CardHeader, CardTitle } from '@xcrm/ui';

export default function Overview() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Roster and headline stats.</p>
      </header>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ['Accounts', '—'],
          ['30d follower growth', '—'],
          ['Posts published', '—'],
          ['Engagement rate', '—'],
        ].map(([k, v]) => (
          <Card key={k}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{k}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{v}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
