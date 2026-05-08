import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TIMPS Marketplace | Discover Plugins & Integrations',
  description: 'Browse and install plugins and integrations for TIMPS - the AI coding agent that remembers.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}