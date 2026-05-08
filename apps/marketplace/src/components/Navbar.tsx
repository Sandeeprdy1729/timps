import Link from 'next/link';

export function Navbar() {
  return (
    <nav className="nav">
      <div className="nav-container">
        <Link href="/" className="nav-logo">
          <span className="nav-logo-icon">T</span>
          TIMPS Marketplace
        </Link>
        <div className="nav-links">
          <Link href="/?type=integrations" className="nav-link">
            Integrations
          </Link>
          <Link href="/?type=plugins" className="nav-link">
            Plugins
          </Link>
          <Link href="/submit" className="nav-link">
            Submit
          </Link>
          <Link href="/docs" className="nav-link">
            Docs
          </Link>
        </div>
        <div className="nav-actions">
          <Link href="/search" className="btn btn-ghost">
            Search
          </Link>
          <Link href="https://github.com/anomalyco/timps" className="btn btn-secondary">
            GitHub
          </Link>
          <Link href="https://docs.timps.ai" className="btn btn-primary">
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}