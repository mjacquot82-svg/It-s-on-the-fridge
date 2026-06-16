import { useEffect, useMemo, useState } from 'react';
import {
  emptyCustomerTemplateLibrary,
  fetchCustomerTemplateLibrary,
} from '../utils/templates';
import '../styles/ReadyMadeDesigns.css';

export default function ReadyMadeDesigns({ onBack }) {
  const [templateLibrary, setTemplateLibrary] = useState(emptyCustomerTemplateLibrary);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    let isCurrent = true;

    async function loadTemplates() {
      setStatus('loading');
      setMessage('');

      try {
        const library = await fetchCustomerTemplateLibrary();

        if (isCurrent) {
          setTemplateLibrary(library);
          setStatus('ready');
        }
      } catch (error) {
        if (isCurrent) {
          setStatus('error');
          setMessage(error.message || 'Unable to load ready-made designs.');
        }
      }
    }

    loadTemplates();

    return () => {
      isCurrent = false;
    };
  }, []);

  const filteredTemplates = useMemo(() => {
    const visibleTemplates = templateLibrary.templates.filter(template => template.visible);

    if (selectedCategory === 'all') {
      return visibleTemplates;
    }

    if (selectedCategory === 'featured') {
      return visibleTemplates.filter(template => template.featured);
    }

    return visibleTemplates.filter(template => template.categoryId === selectedCategory);
  }, [selectedCategory, templateLibrary.templates]);

  const featuredTemplates = filteredTemplates.filter(template => template.featured);
  const standardTemplates = filteredTemplates.filter(template => !template.featured);
  const hasTemplates = filteredTemplates.length > 0;

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
  };

  const renderTemplateCard = (template) => (
    <article className="ready-template-card" key={template.id}>
      <button
        type="button"
        className="ready-template-button"
        onClick={() => handleSelectTemplate(template)}
      >
        <img src={template.imageUrl} alt={template.title} />
        <span className="template-number">{template.templateNumber}</span>
        {template.featured && <span className="featured-badge">Featured</span>}
      </button>
      <div className="ready-template-body">
        <h3>{template.title}</h3>
        <p>{template.templateNumber}</p>
      </div>
    </article>
  );

  return (
    <div className="ready-made-screen">
      <div className="ready-made-content">
        <header className="ready-made-header">
          <button type="button" className="back-button ready-back-button" onClick={onBack}>
            Back
          </button>
          <div>
            <h1>Ready-Made Designs</h1>
            <p>Browse pre-made magnet designs.</p>
          </div>
        </header>

        <div className="category-filter-bar" aria-label="Ready-made design categories">
          <button
            type="button"
            className={selectedCategory === 'all' ? 'filter-chip is-active' : 'filter-chip'}
            onClick={() => setSelectedCategory('all')}
          >
            All
          </button>
          <button
            type="button"
            className={selectedCategory === 'featured' ? 'filter-chip is-active' : 'filter-chip'}
            onClick={() => setSelectedCategory('featured')}
          >
            Featured
          </button>
          {templateLibrary.categories.map(category => (
            <button
              type="button"
              className={selectedCategory === category.id ? 'filter-chip is-active' : 'filter-chip'}
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>

        {selectedTemplate && (
          <div className="template-placeholder-message" role="status">
            Template ordering coming next.
          </div>
        )}

        {status === 'loading' && (
          <div className="ready-made-message" role="status">
            Loading ready-made designs...
          </div>
        )}

        {status === 'error' && (
          <div className="ready-made-message is-error" role="alert">
            {message}
          </div>
        )}

        {status === 'ready' && !hasTemplates && (
          <div className="ready-made-message">
            No ready-made designs are available yet.
          </div>
        )}

        {status === 'ready' && featuredTemplates.length > 0 && (
          <section className="template-section">
            <h2>Featured</h2>
            <div className="ready-template-grid">
              {featuredTemplates.map(renderTemplateCard)}
            </div>
          </section>
        )}

        {status === 'ready' && standardTemplates.length > 0 && (
          <section className="template-section">
            <h2>{featuredTemplates.length > 0 ? 'More Designs' : 'Designs'}</h2>
            <div className="ready-template-grid">
              {standardTemplates.map(renderTemplateCard)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
