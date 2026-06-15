import Link from 'next/link';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-content">
        <div className="footer-links">
          <Link href="/docs" className="footer-link">
            Documentation
          </Link>
          <Link href="/submit" className="footer-link">
            Submit
          </Link>
        </div>
        <p className="footer-copy">&copy; {new Date().getFullYear().toString()} TIMPS. All rights reserved.</p>
      </div>
    </footer>
  );
}
