import Link from 'next/link';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-content">
        <div className="footer-links">
          <Link href="/docs" className="footer-link">
            Documentation
          </Link>
          <Link href="/blog" className="footer-link">
            Blog
          </Link>
          <Link href="/community" className="footer-link">
            Community
          </Link>
          <Link href="/status" className="footer-link">
            Status
          </Link>
        </div>
        <p className="footer-copy">© 2024 TIMPS. All rights reserved.</p>
      </div>
    </footer>
  );
}