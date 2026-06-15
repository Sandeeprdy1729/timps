import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Submit Integration | TIMPS Marketplace',
  description: 'Submit an integration or plugin to TIMPS Marketplace',
};

export default function SubmitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
