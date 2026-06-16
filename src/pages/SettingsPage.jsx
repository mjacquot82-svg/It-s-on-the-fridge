import { useEffect, useMemo, useState } from 'react';
import { useOrder } from '../context/useOrder';
import {
  createMagnetTemplate,
  createTemplateCategory,
  emptyTemplateLibrary,
  loadTemplateLibrary,
  readImageAsDataUrl,
  updateMagnetTemplate,
} from '../utils/templateAdmin';
import '../styles/SettingsPage.css';

const SETTINGS_PIN = '2468';

const emptyCategoryForm = {
  name: '',
  sortOrder: 0,
  visible: true,
};

const emptyTemplateForm = {
  title: '',
  categoryId: '',
  visible: true,
  featured: false,
};

export default function SettingsPage({ onExit }) {
  const { pricingSettings, pricingSettingsStatus, updatePricingSettings } = useOrder();
  const [pin, setPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinError, setPinError] = useState('');
  const [formValues, setFormValues] = useState(pricingSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [templateLibrary, setTemplateLibrary] = useState(emptyTemplateLibrary);
  const [templateStatus, setTemplateStatus] = useState('idle');
  const [templateMessage, setTemplateMessage] = useState('');
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [templateImageFile, setTemplateImageFile] = useState(null);
  const [createdTemplateNumber, setCreatedTemplateNumber] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredTemplates = useMemo(() => {
    if (categoryFilter === 'all') {
      return templateLibrary.templates;
    }

    if (categoryFilter === 'uncategorized') {
      return templateLibrary.templates.filter(template => !template.categoryId);
    }

    return templateLibrary.templates.filter(template => template.categoryId === categoryFilter);
  }, [categoryFilter, templateLibrary.templates]);

  const handleUnlock = (event) => {
    event.preventDefault();
    if (pin === SETTINGS_PIN) {
      setFormValues(pricingSettings);
      setIsUnlocked(true);
      setPinError('');
      return;
    }

    setPinError('Incorrect PIN.');
  };

  useEffect(() => {
    if (!isUnlocked) {
      return;
    }

    let isCurrent = true;

    async function fetchTemplateLibrary() {
      setTemplateStatus('loading');
      setTemplateMessage('');

      try {
        const library = await loadTemplateLibrary(pin);

        if (isCurrent) {
          setTemplateLibrary(library);
          setTemplateStatus('ready');
        }
      } catch (error) {
        if (isCurrent) {
          setTemplateStatus('error');
          setTemplateMessage(error.message || 'Unable to load template library.');
        }
      }
    }

    fetchTemplateLibrary();

    return () => {
      isCurrent = false;
    };
  }, [isUnlocked, pin]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setSaveMessage('');
    setFormValues(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveMessage('');
    try {
      await updatePricingSettings({
        ...formValues,
        roundMagnetPrice: Number(formValues.roundMagnetPrice),
        rectangleMagnetPrice: Number(formValues.rectangleMagnetPrice),
      }, pin);
      setSaveMessage('Settings saved.');
    } catch (error) {
      setSaveMessage('');
      setPinError(error.message || 'Unable to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCategoryChange = (event) => {
    const { name, value, type, checked } = event.target;
    setTemplateMessage('');
    setCategoryForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();
    setTemplateStatus('saving');
    setTemplateMessage('');

    try {
      const { category } = await createTemplateCategory(pin, {
        ...categoryForm,
        sortOrder: Number(categoryForm.sortOrder),
      });
      setTemplateLibrary(prev => ({
        ...prev,
        categories: [...prev.categories, category].sort((a, b) => {
          if (a.sortOrder !== b.sortOrder) {
            return a.sortOrder - b.sortOrder;
          }

          return a.name.localeCompare(b.name);
        }),
      }));
      setCategoryForm(emptyCategoryForm);
      setTemplateStatus('ready');
      setTemplateMessage('Category created.');
    } catch (error) {
      setTemplateStatus('error');
      setTemplateMessage(error.message || 'Unable to create category.');
    }
  };

  const handleTemplateChange = (event) => {
    const { name, value, type, checked } = event.target;
    setTemplateMessage('');
    setCreatedTemplateNumber('');
    setTemplateForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleTemplateImageChange = (event) => {
    setTemplateMessage('');
    setCreatedTemplateNumber('');
    setTemplateImageFile(event.target.files?.[0] || null);
  };

  const handleCreateTemplate = async (event) => {
    event.preventDefault();
    setTemplateStatus('saving');
    setTemplateMessage('');
    setCreatedTemplateNumber('');

    try {
      if (!templateImageFile) {
        throw new Error('Template image is required.');
      }

      if (templateLibrary.categories.length > 0 && !templateForm.categoryId) {
        throw new Error('Choose a category for this template.');
      }

      const imageDataUrl = await readImageAsDataUrl(templateImageFile);
      const { template } = await createMagnetTemplate(pin, {
        ...templateForm,
        imageDataUrl,
        fileName: templateImageFile.name,
      });

      setTemplateLibrary(prev => ({
        ...prev,
        templates: [template, ...prev.templates],
      }));
      setTemplateForm(emptyTemplateForm);
      setTemplateImageFile(null);
      event.target.reset();
      setCreatedTemplateNumber(template.templateNumber);
      setTemplateStatus('ready');
      setTemplateMessage(`Template ${template.templateNumber} uploaded.`);
    } catch (error) {
      setTemplateStatus('error');
      setTemplateMessage(error.message || 'Unable to upload template.');
    }
  };

  const handleTemplateToggle = async (templateId, changes) => {
    setTemplateStatus('saving');
    setTemplateMessage('');

    try {
      const { template } = await updateMagnetTemplate(pin, {
        id: templateId,
        ...changes,
      });
      setTemplateLibrary(prev => ({
        ...prev,
        templates: prev.templates.map(item => (
          item.id === template.id ? template : item
        )),
      }));
      setTemplateStatus('ready');
      setTemplateMessage(`Template ${template.templateNumber} updated.`);
    } catch (error) {
      setTemplateStatus('error');
      setTemplateMessage(error.message || 'Unable to update template.');
    }
  };

  return (
    <div className="settings-screen">
      <div className="settings-content">
        <h1>Settings</h1>
        <p className="subtitle">Update prices and promotions.</p>
        {pricingSettingsStatus === 'fallback' && (
          <div className="settings-warning" role="status">
            Supabase settings are unavailable. Defaults are shown until the connection is restored.
          </div>
        )}

        {!isUnlocked ? (
          <form className="settings-form" onSubmit={handleUnlock}>
            <div className="form-group">
              <label htmlFor="settingsPin">PIN</label>
              <input
                id="settingsPin"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            {pinError && <div className="settings-error" role="alert">{pinError}</div>}
            <div className="action-buttons">
              <button type="button" className="back-button" onClick={onExit}>
                Back
              </button>
              <button type="submit" className="next-button">
                Unlock
              </button>
            </div>
          </form>
        ) : (
          <div className="settings-admin">
            <section className="settings-section">
              <h2>Pricing</h2>
              <form className="settings-form" onSubmit={handleSave}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="roundMagnetPrice">Round Magnet Price</label>
                    <input
                      id="roundMagnetPrice"
                      name="roundMagnetPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formValues.roundMagnetPrice}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="rectangleMagnetPrice">Rectangle Magnet Price</label>
                    <input
                      id="rectangleMagnetPrice"
                      name="rectangleMagnetPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formValues.rectangleMagnetPrice}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="settings-toggle">
                  <input
                    id="promotionEnabled"
                    name="promotionEnabled"
                    type="checkbox"
                    checked={formValues.promotionEnabled}
                    onChange={handleChange}
                  />
                  <label htmlFor="promotionEnabled">Promotion Enabled</label>
                </div>

                <div className="form-group">
                  <label htmlFor="promotionText">Promotion Text</label>
                  <textarea
                    id="promotionText"
                    name="promotionText"
                    value={formValues.promotionText}
                    onChange={handleChange}
                    placeholder="Example: Buy 3 magnets, get 1 free."
                  />
                </div>

                {saveMessage && <div className="settings-success" role="status">{saveMessage}</div>}

                <div className="settings-actions">
                  <button type="submit" className="next-button" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </section>

            <section className="settings-section template-admin-section">
              <div className="settings-section-header">
                <div>
                  <h2>Ready-Made Templates</h2>
                  <p>Manage reusable magnet designs.</p>
                </div>
                <span className="template-count">{templateLibrary.templates.length} templates</span>
              </div>

              {templateStatus === 'loading' && (
                <div className="settings-warning" role="status">
                  Loading template library...
                </div>
              )}
              {templateStatus === 'error' && templateMessage && (
                <div className="settings-error" role="alert">{templateMessage}</div>
              )}
              {templateStatus !== 'error' && templateMessage && (
                <div className="settings-success" role="status">{templateMessage}</div>
              )}
              {createdTemplateNumber && (
                <div className="template-number-banner" role="status">
                  Assigned template number: <strong>{createdTemplateNumber}</strong>
                </div>
              )}

              <div className="template-admin-grid">
                <form className="settings-form template-panel" onSubmit={handleCreateCategory}>
                  <h3>Categories</h3>
                  <div className="form-group">
                    <label htmlFor="categoryName">Category Name</label>
                    <input
                      id="categoryName"
                      name="name"
                      value={categoryForm.name}
                      onChange={handleCategoryChange}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="categorySortOrder">Sort Order</label>
                      <input
                        id="categorySortOrder"
                        name="sortOrder"
                        type="number"
                        step="1"
                        value={categoryForm.sortOrder}
                        onChange={handleCategoryChange}
                      />
                    </div>
                    <div className="settings-toggle template-toggle">
                      <input
                        id="categoryVisible"
                        name="visible"
                        type="checkbox"
                        checked={categoryForm.visible}
                        onChange={handleCategoryChange}
                      />
                      <label htmlFor="categoryVisible">Visible</label>
                    </div>
                  </div>
                  <button type="submit" className="next-button" disabled={templateStatus === 'saving'}>
                    Create Category
                  </button>

                  <div className="category-list" aria-label="Template categories">
                    {templateLibrary.categories.length === 0 ? (
                      <p>No categories yet.</p>
                    ) : (
                      templateLibrary.categories.map(category => (
                        <div className="category-row" key={category.id}>
                          <span>{category.name}</span>
                          <small>
                            Sort {category.sortOrder} · {category.visible ? 'Visible' : 'Hidden'}
                          </small>
                        </div>
                      ))
                    )}
                  </div>
                </form>

                <form className="settings-form template-panel" onSubmit={handleCreateTemplate}>
                  <h3>Upload Template</h3>
                  <div className="form-group">
                    <label htmlFor="templateTitle">Title</label>
                    <input
                      id="templateTitle"
                      name="title"
                      value={templateForm.title}
                      onChange={handleTemplateChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="templateCategory">Category</label>
                    <select
                      id="templateCategory"
                      name="categoryId"
                      value={templateForm.categoryId}
                      onChange={handleTemplateChange}
                      required={templateLibrary.categories.length > 0}
                    >
                      <option value="">Choose category</option>
                      {templateLibrary.categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="templateImage">Template Image</label>
                    <input
                      id="templateImage"
                      type="file"
                      accept="image/*"
                      onChange={handleTemplateImageChange}
                      required
                    />
                  </div>
                  <div className="template-toggle-row">
                    <div className="settings-toggle template-toggle">
                      <input
                        id="templateVisible"
                        name="visible"
                        type="checkbox"
                        checked={templateForm.visible}
                        onChange={handleTemplateChange}
                      />
                      <label htmlFor="templateVisible">Visible</label>
                    </div>
                    <div className="settings-toggle template-toggle">
                      <input
                        id="templateFeatured"
                        name="featured"
                        type="checkbox"
                        checked={templateForm.featured}
                        onChange={handleTemplateChange}
                      />
                      <label htmlFor="templateFeatured">Featured</label>
                    </div>
                  </div>
                  <button type="submit" className="next-button" disabled={templateStatus === 'saving'}>
                    {templateStatus === 'saving' ? 'Saving...' : 'Upload Template'}
                  </button>
                </form>
              </div>

              <div className="template-library-toolbar">
                <div className="form-group">
                  <label htmlFor="templateCategoryFilter">Filter by Category</label>
                  <select
                    id="templateCategoryFilter"
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                  >
                    <option value="all">All categories</option>
                    <option value="uncategorized">Uncategorized</option>
                    {templateLibrary.categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="template-library-grid">
                {filteredTemplates.length === 0 ? (
                  <div className="empty-template-library">
                    No templates to show.
                  </div>
                ) : (
                  filteredTemplates.map(template => (
                    <article className="template-card" key={template.id}>
                      <img src={template.imageUrl} alt={template.title} />
                      <div className="template-card-body">
                        <div className="template-card-heading">
                          <strong>{template.templateNumber}</strong>
                          <span>{template.featured ? 'Featured' : 'Standard'}</span>
                        </div>
                        <h3>{template.title}</h3>
                        <p>{template.categoryName || 'Uncategorized'}</p>
                        <div className="template-status-row">
                          <span className={template.visible ? 'status-pill is-visible' : 'status-pill'}>
                            {template.visible ? 'Visible' : 'Hidden'}
                          </span>
                          <span className={template.featured ? 'status-pill is-featured' : 'status-pill'}>
                            {template.featured ? 'Featured' : 'Not Featured'}
                          </span>
                        </div>
                        <div className="template-card-toggles">
                          <label>
                            <input
                              type="checkbox"
                              checked={template.visible}
                              disabled={templateStatus === 'saving'}
                              onChange={(event) => handleTemplateToggle(template.id, {
                                visible: event.target.checked,
                              })}
                            />
                            Visible
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={template.featured}
                              disabled={templateStatus === 'saving'}
                              onChange={(event) => handleTemplateToggle(template.id, {
                                featured: event.target.checked,
                              })}
                            />
                            Featured
                          </label>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <div className="action-buttons settings-exit-actions">
              <button type="button" className="back-button" onClick={onExit} disabled={isSaving}>
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
