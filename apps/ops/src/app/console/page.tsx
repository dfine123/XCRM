import { Card, CardContent, CardHeader, CardTitle } from '@xcrm/ui';

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Phase 0 shell. Feature dashboards land in Phase 1.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          ['Accounts', '—'],
          ['Posts today', '—'],
          ['Active VAs', '—'],
          ['Runway at risk', '—'],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{value}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
