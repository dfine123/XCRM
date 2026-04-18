import type { Metadata } from 'next';
import { PRODUCT_NAME } from '@xcrm/shared/constants';
import '@xcrm/ui/globals.css';

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} — ops`,
  description: 'X management CRM',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
