import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { pluginMap } from '@/data/plugins';
import { RunPluginButton } from '@/components/RunPluginButton';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const plugin = pluginMap[id];
  if (!plugin) return { title: 'Not Found' };
  return {
    title: `${plugin.name} - TIMPS Marketplace`,
    description: plugin.description,
  };
}

export default async function PluginPage({ params }: PageProps) {
  const { id } = await params;
  const plugin = pluginMap[id];
  if (!plugin) notFound();

  const isNew = plugin.version.startsWith('1.');

  return (
    <>
      <header className="nav">
        <div className="nav-container">
          <Link href="/" className="nav-logo">
            <span className="nav-logo-icon">T</span>
            TIMPS Marketplace
          </Link>
          <div className="nav-links">
            <Link href="/" className="nav-link">Integrations</Link>
            <Link href="/?type=plugins" className="nav-link">Plugins</Link>
            <Link href="/submit" className="nav-link">Submit</Link>
          </div>
        </div>
      </header>
      <main className="container">
        <div className="detail-header">
          <div className="detail-icon">{plugin.icon}</div>
          <div className="detail-info">
            <h1 className="detail-title">{plugin.name}</h1>
            <p className="detail-description">{plugin.description}</p>
            <div className="detail-meta">
              <span className="detail-badge">{plugin.category}</span>
              <span className="detail-stat">v{plugin.version}</span>
              <span className="detail-stat">
                By {plugin.author}
              </span>
              {isNew && <span className="card-badge new">New</span>}
            </div>
          </div>
        </div>
        <section className="detail-section">
          <h2>Overview</h2>
          <p>{plugin.fullDescription}</p>
        </section>
        <section className="detail-section">
          <h2>Features</h2>
          <ul>
            {plugin.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </section>
        <section className="detail-section">
          <h2>Installation</h2>
          <pre className="code-block">{plugin.installation}</pre>
        </section>
        <section className="detail-section">
          <h2>Configuration</h2>
          <pre className="code-block">{plugin.configuration}</pre>
        </section>
        <section className="detail-actions" style={{ flexDirection: 'column', gap: '16px' }}>
          <RunPluginButton pluginId={plugin.id} pluginName={plugin.name} />
          <Link href={plugin.repo} className="btn btn-secondary">
            View Repository
          </Link>
        </section>
      </main>
      <footer className="footer">
        <div className="container footer-content">
          <div className="footer-copy">&copy; {new Date().getFullYear().toString()} TIMPS Marketplace</div>
          <div className="footer-links">
            <Link href="/" className="footer-link">Home</Link>
            <Link href="/submit" className="footer-link">Submit</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
