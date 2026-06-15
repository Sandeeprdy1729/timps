'use client';

import { useState } from 'react';

interface Submission {
  id: string;
  name: string;
  type: 'integration' | 'plugin';
  description: string;
  category: string;
  repository: string;
  npmPackage: string;
  website: string;
  sourceUrl: string;
  submittedAt: number;
}

export default function SubmitPage() {
  const [formData, setFormData] = useState({
    name: '',
    type: 'integration' as 'integration' | 'plugin',
    description: '',
    category: '',
    repository: '',
    npmPackage: '',
    website: '',
    sourceUrl: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const submission: Submission = {
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ...formData,
        submittedAt: Date.now(),
      };

      const existing = JSON.parse(localStorage.getItem('timps_submissions') || '[]');
      existing.push(submission);
      localStorage.setItem('timps_submissions', JSON.stringify(existing));

      setSubmitted(true);
      setFormData({
        name: '',
        type: 'integration',
        description: '',
        category: '',
        repository: '',
        npmPackage: '',
        website: '',
        sourceUrl: '',
      });
    } catch {
      setError('Failed to save submission. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <>
        <header className="nav">
          <div className="nav-container">
            <a href="/" className="nav-logo">
              <span className="nav-logo-icon">T</span>
              TIMPS Marketplace
            </a>
            <div className="nav-links">
              <a href="/" className="nav-link">Integrations</a>
              <a href="/?type=plugins" className="nav-link">Plugins</a>
              <a href="/submit" className="nav-link">Submit</a>
            </div>
          </div>
        </header>
        <main className="container">
          <div className="form-page" style={{ textAlign: 'center', padding: '96px 0' }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>🎉</div>
            <h1 className="form-title">Thank You!</h1>
            <p className="form-subtitle" style={{ marginBottom: '32px' }}>
              Your {formData.type} has been submitted. The TIMPS team will review it shortly.
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button onClick={() => setSubmitted(false)} className="btn btn-secondary">
                Submit Another
              </button>
              <a href="/" className="btn btn-primary">
                Back to Marketplace
              </a>
            </div>
          </div>
        </main>
        <footer className="footer">
          <div className="container footer-content">
            <div className="footer-copy">&copy; {new Date().getFullYear().toString()} TIMPS Marketplace</div>
            <div className="footer-links">
              <a href="/" className="footer-link">Home</a>
              <a href="/submit" className="footer-link">Submit</a>
            </div>
          </div>
        </footer>
      </>
    );
  }

  return (
    <>
      <header className="nav">
        <div className="nav-container">
          <a href="/" className="nav-logo">
            <span className="nav-logo-icon">T</span>
            TIMPS Marketplace
          </a>
          <div className="nav-links">
            <a href="/" className="nav-link">Integrations</a>
            <a href="/?type=plugins" className="nav-link">Plugins</a>
            <a href="/submit" className="nav-link">Submit</a>
          </div>
        </div>
      </header>
      <main className="container">
        <div className="form-page">
          <h1 className="form-title">Submit an Integration or Plugin</h1>
          <p className="form-subtitle">
            Share your integration or plugin with the TIMPS community
          </p>
          {error && (
            <div style={{ color: 'var(--error)', marginBottom: '16px', textAlign: 'center' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="form">
            <div className="form-group">
              <label htmlFor="name">Name *</label>
              <input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Integration"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="type">Type *</label>
                <select
                  id="type"
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'integration' | 'plugin' })}
                >
                  <option value="integration">Integration</option>
                  <option value="plugin">Plugin</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="category">Category *</label>
                <select
                  id="category"
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="">Select category</option>
                  <option value="Developer Tools">Developer Tools</option>
                  <option value="Communication">Communication</option>
                  <option value="AI & LLMs">AI & LLMs</option>
                  <option value="Productivity">Productivity</option>
                  <option value="Database">Database</option>
                  <option value="Security">Security</option>
                  <option value="Analytics">Analytics</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what your integration or plugin does..."
              />
            </div>
            <div className="form-group">
              <label htmlFor="repository">Repository URL *</label>
              <input
                id="repository"
                type="url"
                required
                value={formData.repository}
                onChange={(e) => setFormData({ ...formData, repository: e.target.value })}
                placeholder="https://github.com/username/repo"
              />
            </div>
            <div className="form-group">
              <label htmlFor="npmPackage">npm Package Name</label>
              <input
                id="npmPackage"
                type="text"
                value={formData.npmPackage}
                onChange={(e) => setFormData({ ...formData, npmPackage: e.target.value })}
                placeholder="@username/timps-integration"
              />
            </div>
            <div className="form-group">
              <label htmlFor="sourceUrl">Source URL</label>
              <input
                id="sourceUrl"
                type="url"
                value={formData.sourceUrl}
                onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                placeholder="https://source.example.com"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>
      </main>
      <footer className="footer">
        <div className="container footer-content">
          <div className="footer-copy">&copy; {new Date().getFullYear().toString()} TIMPS Marketplace</div>
          <div className="footer-links">
            <a href="/" className="footer-link">Home</a>
            <a href="/submit" className="footer-link">Submit</a>
          </div>
        </div>
      </footer>
      <style jsx>{`
        .form-page {
          max-width: 600px;
          margin: 48px auto;
          padding-bottom: 96px;
        }
        .form-title {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 8px;
          text-align: center;
        }
        .form-subtitle {
          font-size: 16px;
          color: var(--muted-foreground);
          text-align: center;
          margin-bottom: 32px;
        }
        .form {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 32px;
        }
        .form-group {
          margin-bottom: 24px;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 8px;
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 12px 16px;
          font-size: 16px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--background);
          outline: none;
        }
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .btn-large {
          width: 100%;
          padding: 16px;
          font-size: 16px;
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
}
