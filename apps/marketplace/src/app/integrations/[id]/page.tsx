import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';

const integrations: Record<string, {
  id: string;
  name: string;
  description: string;
  fullDescription: string;
  icon: string;
  category: string;
  downloads: number;
  rating: number;
  reviews: number;
  maintainer: string;
  npmPackage: string;
  features: string[];
  installation: string;
  configuration: string;
  supported: string;
}> = {
  github: {
    id: 'github',
    name: 'GitHub',
    description: 'Automate PR reviews, issue management, and repository workflows',
    fullDescription: 'The GitHub integration enables TIMPS to interact with GitHub repositories, manage issues, review pull requests, and automate workflows.',
    icon: '🐙',
    category: 'Developer Tools',
    downloads: 45000,
    rating: 4.9,
    reviews: 328,
    maintainer: 'TIMPS Team',
    npmPackage: '@timps/github',
    features: [
      'Automated PR reviews',
      'Issue creation and management',
      'Repository statistics',
      'Workflow automation',
      'Release management',
    ],
    installation: 'npm install @timps/github',
    configuration: 'timps connect github',
    supported: true,
  },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const integration = integrations[id];
  if (!integration) return { title: 'Not Found' };
  return {
    title: `${integration.name} - TIMPS Marketplace`,
    description: integration.description,
  };
}

export default async function IntegrationPage({ params }: PageProps) {
  const { id } = await params;
  const integration = integrations[id];
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
        <section className="detail-actions">
          <Link href="/docs/integrations/github" className="btn btn-primary">
            Read Documentation
          </Link>
          <button className="btn btn-secondary">Install</button>
        </section>
      </main>
    </>
  );
}