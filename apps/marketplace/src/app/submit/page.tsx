'use client';

import { useState } from 'react';

export default function SubmitPage() {
  const [formData, setFormData] = useState({
    name: '',
    type: 'integration',
    description: '',
    category: '',
    repository: '',
    npmPackage: '',
    website: '',
    sourceUrl: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Thank you for your submission! We will review it shortly.');
  };

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
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
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
                  <option value="ai">AI & LLMs</option>
                  <option value="communication">Communication</option>
                  <option value="developer-tools">Developer Tools</option>
                  <option value="productivity">Productivity</option>
                  <option value="database">Database</option>
                  <option value="security">Security</option>
                  <option value="analytics">Analytics</option>
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
            <button type="submit" className="btn btn-primary btn-large">
              Submit
            </button>
          </form>
        </div>
      </main>
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
      `}</style>
    </>
  );
}