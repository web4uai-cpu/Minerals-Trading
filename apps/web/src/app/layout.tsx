import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Mineral Trade — India\'s AI-Powered Mineral Trade Platform',
  description:
    'B2B marketplace for verified mineral trading with AI-powered discovery, compliance verification, and structured dispute arbitration.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
