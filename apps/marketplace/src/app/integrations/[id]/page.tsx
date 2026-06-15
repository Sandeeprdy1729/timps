import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { integrationMap } from '@/data/integrations';
import { ConnectButton } from '@/components/ConnectButton';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const integration = integrationMap[id];
  if (!integration) return { title: 'Not Found' };
  return {
    title: `${integration.name} - TIMPS Marketplace`,
    description: integration.description,
  };
}

export default async function IntegrationPage({ params }: PageProps) {
  const { id } = await params;
  const integration = integrationMap[id];
  if (!integration) notFound();

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
          <div className="detail-icon">{integration.icon}</div>
          <div className="detail-info">
            <h1 className="detail-title">{integration.name}</h1>
            <p className="detail-description">{integration.description}</p>
            <div className="detail-meta">
              <span className="detail-badge">{integration.category}</span>
              <span className="detail-stat">
                {(integration.downloads / 1000).toFixed(0)}k downloads
              </span>
              <span className="detail-stat">
                ⭐ {integration.rating} ({integration.reviews} reviews)
              </span>
              <span className="detail-stat">
                Maintained by {integration.maintainer}
              </span>
            </div>
          </div>
        </div>
        <section className="detail-section">
          <h2>Overview</h2>
          <p>{integration.fullDescription}</p>
        </section>
        <section className="detail-section">
          <h2>Features</h2>
          <ul>
            {integration.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </section>
        <section className="detail-section">
          <h2>Installation</h2>
          <pre className="code-block">{integration.installation}</pre>
        </section>
        <section className="detail-section">
          <h2>Configuration</h2>
          <pre className="code-block">{integration.configuration}</pre>
        </section>
        <section className="detail-section">
          <h2>npm Package</h2>
          <pre className="code-block">{integration.npmPackage}</pre>
        </section>
        <section className="detail-actions">
          <ConnectButton integrationId={integration.id} integrationName={integration.name} />
          <Link href={integration.npmPackage.startsWith('@') ? `https://www.npmjs.com/package/${integration.npmPackage}` : '#'} className="btn btn-secondary">
            View on npm
          </Link>
        </section>
        <section className="detail-section">
          <h2>API Actions</h2>
          <div className="api-actions-grid">
            <div className="api-action-card">
              <p className="api-action-name">Test Connection</p>
              <p className="api-action-desc">Verify your credentials are working</p>
            </div>
            <div className="api-action-card">
              <p className="api-action-name">List Data</p>
              <p className="api-action-desc">Fetch data from {integration.name}</p>
            </div>
            <div className="api-action-card">
              <p className="api-action-name">Create</p>
              <p className="api-action-desc">Create new items in {integration.name}</p>
            </div>
          </div>
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
