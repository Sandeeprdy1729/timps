import { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { IntegrationGrid } from '@/components/IntegrationGrid';
import { PluginGrid } from '@/components/PluginGrid';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'TIMPS Marketplace',
  description: 'Discover plugins and integrations for TIMPS',
};

interface PageProps {
  searchParams: Promise<{ category?: string; type?: string; q?: string }>;
}

export default async function MarketplacePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const category = params.category || 'all';
  const type = params.type || 'integrations';
  const query = params.q || '';

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        {type === 'integrations' ? (
          <IntegrationGrid category={category} searchQuery={query} />
        ) : (
          <PluginGrid category={category} searchQuery={query} />
        )}
      </main>
      <Footer />
    </>
  );
}