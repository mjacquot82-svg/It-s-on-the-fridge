import { useEffect, useMemo, useRef, useState } from 'react';
import { useOrder } from '../context/useOrder';
import MagnetPreview from '../components/MagnetPreview';
import {
  createMagnetTemplate,
  createTemplateCategory,
  deleteMagnetTemplate,
  deleteTemplateCategory,
  emptyTemplateLibrary,
  loadTemplateLibrary,
  reorderMagnetTemplates,
  reorderTemplateCategories,
  updateTemplateCategory,
  updateMagnetTemplate,
} from '../utils/templateAdmin';
import { optimizeImageFile } from '../utils/cropUtils';
import '../styles/SettingsPage.css';

const SETTINGS_PIN = '08311984';

const emptyCategoryForm = {
  name: '',
  visible: true,
};

const emptyTemplateForm = {
  title: '',
  categoryId: '',
  shape: 'rectangle',
  visible: true,
  featured: false,
};

const templateLibraryViewOptions = [
  { id: 'large', label: 'Large View' },
  { id: 'medium', label: 'Medium View' },
  { id: 'compact', label: 'Compact View' },
];

function getTemplateDisplayOrder(template) {
  return Number.isFinite(template.displayOrder) ? template.displayOrder : 0;
}

function compareTemplatesByDisplayOrder(a, b) {
  const orderDifference = getTemplateDisplayOrder(a) - getTemplateDisplayOrder(b);

  if (orderDifference !== 0) {
    return orderDifference;
  }

  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

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
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCategoryManagementOpen, setIsCategoryManagementOpen] = useState(false);
  const [draggedCategoryId, setDraggedCategoryId] = useState('');
  const [categoryEditTarget, setCategoryEditTarget] = useState(null);
  const [categoryEditName, setCategoryEditName] = useState('');
  const [categoryDeleteTarget, setCategoryDeleteTarget] = useState(null);
  const [categoryDeleteAction, setCategoryDeleteAction] = useState('move');
  const [templateDeleteTarget, setTemplateDeleteTarget] = useState(null);
  const [templateLibraryView, setTemplateLibraryView] = useState('default');
  const [draggedTemplateId, setDraggedTemplateId] = useState('');
  const categoryDragRef = useRef({
    categoryId: '',
    orderedIds: [],
    originalIds: [],
    initialCategories: [],
  });
  const templateDragRef = useRef({
    templateId: '',
    orderedIds: [],
    originalIds: [],
    initialTemplates: [],
  });

  useEffect(() => {
    setPinError('');
    setSaveMessage('');
    setTemplateMessage('');
    setTemplateStatus('idle');
  }, []);

  const userCategories = useMemo(() => (
    templateLibrary.categories.filter(category => !category.isSystem)
  ), [templateLibrary.categories]);

  const filteredTemplates = useMemo(() => {
    let nextTemplates;

    if (categoryFilter === 'all') {
      nextTemplates = templateLibrary.templates;
    } else if (categoryFilter === 'uncategorized') {
      nextTemplates = templateLibrary.templates.filter(template => !template.categoryId || template.categoryIsSystem);
    } else {
      nextTemplates = templateLibrary.templates.filter(template => template.categoryId === categoryFilter);
    }

    return categoryFilter === 'all'
      ? nextTemplates
      : [...nextTemplates].sort(compareTemplatesByDisplayOrder);
  }, [categoryFilter, templateLibrary.templates]);

  const categoryTemplateCounts = useMemo(() => (
    templateLibrary.templates.reduce((counts, template) => {
      if (template.categoryId) {
        counts[template.categoryId] = (counts[template.categoryId] || 0) + 1;
      }

      return counts;
    }, {})
  ), [templateLibrary.templates]);
  const templateLibraryGridClassName = templateLibraryView === 'default'
    ? 'template-library-grid'
    : `template-library-grid template-library-grid-${templateLibraryView}`;
  const canReorderTemplates = categoryFilter !== 'all';
  const reorderCategoryMode = categoryFilter === 'uncategorized' ? 'uncategorized' : 'category';
  const reorderCategoryId = reorderCategoryMode === 'category' ? categoryFilter : null;

  const applyCategoryOrder = (orderedIds) => {
    setTemplateLibrary(prev => {
      const normalCategories = orderedIds
        .map((categoryId, index) => {
          const category = prev.categories.find(item => item.id === categoryId);
          return category ? { ...category, sortOrder: index + 1 } : null;
        })
        .filter(Boolean);
      const systemCategories = prev.categories.filter(category => category.isSystem);

      return {
        ...prev,
        categories: [...normalCategories, ...systemCategories],
      };
    });
  };

  const handleUnlock = (event) => {
    event.preventDefault();
    if (pin === SETTINGS_PIN) {
      setFormValues(pricingSettings);
      setPinError('');
      setSaveMessage('');
      setTemplateMessage('');
      setIsUnlocked(true);
      return;
    }

    setPinError('Incorrect PIN.');
  };

  const handlePinChange = (event) => {
    setPin(event.target.value);
    setPinError('');
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

  const handleOpenCategoryModal = () => {
    setCategoryForm(emptyCategoryForm);
    setTemplateMessage('');
    setIsCategoryModalOpen(true);
  };

  const handleCloseCategoryModal = () => {
    setCategoryForm(emptyCategoryForm);
    setIsCategoryModalOpen(false);
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();
    setTemplateStatus('saving');
    setTemplateMessage('');

    try {
      const { category } = await createTemplateCategory(pin, categoryForm);
      setTemplateLibrary(prev => ({
        ...prev,
        categories: [...prev.categories.filter(item => !item.isSystem), category, ...prev.categories.filter(item => item.isSystem)],
      }));
      setCategoryForm(emptyCategoryForm);
      setTemplateForm(prev => ({
        ...prev,
        categoryId: category.id,
      }));
      setIsCategoryModalOpen(false);
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

    if (name === 'categoryId' && value === '__create__') {
      handleOpenCategoryModal();
      return;
    }

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

      if (userCategories.length > 0 && !templateForm.categoryId) {
        throw new Error('Choose a category for this template.');
      }

      const optimizedImage = await optimizeImageFile(templateImageFile);
      const { template } = await createMagnetTemplate(pin, {
        ...templateForm,
        imageDataUrl: optimizedImage.dataUrl,
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

  const handleCategoryDragStart = (event, categoryId) => {
    if (templateStatus === 'saving') {
      return;
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);
    const orderedIds = userCategories.map(category => category.id);
    categoryDragRef.current = {
      categoryId,
      orderedIds,
      originalIds: orderedIds,
      initialCategories: templateLibrary.categories,
    };
    setDraggedCategoryId(categoryId);
    setTemplateMessage('');
  };

  const handleCategoryDragMove = (event) => {
    const { categoryId, orderedIds } = categoryDragRef.current;

    if (!categoryId) {
      return;
    }

    const targetRow = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest('[data-category-id]');
    const targetId = targetRow?.dataset.categoryId;

    if (!targetId || targetId === categoryId || !orderedIds.includes(targetId)) {
      return;
    }

    const nextIds = orderedIds.filter(id => id !== categoryId);
    nextIds.splice(nextIds.indexOf(targetId), 0, categoryId);
    categoryDragRef.current.orderedIds = nextIds;
    applyCategoryOrder(nextIds);
  };

  const handleCategoryDragEnd = async (event) => {
    const { categoryId, orderedIds, originalIds, initialCategories } = categoryDragRef.current;

    if (!categoryId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    categoryDragRef.current = {
      categoryId: '',
      orderedIds: [],
      originalIds: [],
      initialCategories: [],
    };
    setDraggedCategoryId('');

    if (orderedIds.join('|') === originalIds.join('|')) {
      return;
    }

    setTemplateStatus('saving');
    setTemplateMessage('');

    try {
      const { categories } = await reorderTemplateCategories(pin, orderedIds);
      setTemplateLibrary(prev => ({
        ...prev,
        categories,
      }));
      setTemplateStatus('ready');
      setTemplateMessage('Category order saved.');
    } catch (error) {
      setTemplateLibrary(prev => ({
        ...prev,
        categories: initialCategories,
      }));
      setTemplateStatus('error');
      setTemplateMessage(error.message || 'Unable to reorder categories.');
    }
  };

  const handleOpenCategoryEdit = (category) => {
    setCategoryEditTarget(category);
    setCategoryEditName(category.name);
    setTemplateMessage('');
  };

  const handleCloseCategoryEdit = () => {
    setCategoryEditTarget(null);
    setCategoryEditName('');
  };

  const handleUpdateCategory = async (event) => {
    event.preventDefault();

    if (!categoryEditTarget) {
      return;
    }

    setTemplateStatus('saving');
    setTemplateMessage('');

    try {
      const { category } = await updateTemplateCategory(pin, {
        categoryId: categoryEditTarget.id,
        name: categoryEditName,
      });
      setTemplateLibrary(prev => ({
        ...prev,
        categories: prev.categories.map(item => (
          item.id === category.id ? category : item
        )),
        templates: prev.templates.map(template => (
          template.categoryId === category.id
            ? { ...template, categoryName: category.name }
            : template
        )),
      }));
      setTemplateStatus('ready');
      setTemplateMessage('Category updated.');
      handleCloseCategoryEdit();
    } catch (error) {
      setTemplateStatus('error');
      setTemplateMessage(error.message || 'Unable to update category.');
    }
  };

  const applyTemplateOrder = (orderedIds) => {
    setTemplateLibrary(prev => ({
      ...prev,
      templates: prev.templates.map(template => {
        const nextIndex = orderedIds.indexOf(template.id);

        return nextIndex === -1
          ? template
          : { ...template, displayOrder: nextIndex };
      }),
    }));
  };

  const handleTemplateDragStart = (event, templateId) => {
    if (!canReorderTemplates || templateStatus === 'saving') {
      return;
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);
    const orderedIds = filteredTemplates.map(template => template.id);
    templateDragRef.current = {
      templateId,
      orderedIds,
      originalIds: orderedIds,
      initialTemplates: templateLibrary.templates,
    };
    setDraggedTemplateId(templateId);
    setTemplateMessage('');
  };

  const handleTemplateDragMove = (event) => {
    const { templateId, orderedIds } = templateDragRef.current;

    if (!templateId) {
      return;
    }

    const targetCard = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest('[data-template-id]');
    const targetId = targetCard?.dataset.templateId;

    if (!targetId || targetId === templateId || !orderedIds.includes(targetId)) {
      return;
    }

    const nextIds = orderedIds.filter(id => id !== templateId);
    nextIds.splice(nextIds.indexOf(targetId), 0, templateId);
    templateDragRef.current.orderedIds = nextIds;
    applyTemplateOrder(nextIds);
  };

  const handleTemplateDragEnd = async (event) => {
    const { templateId, orderedIds, originalIds, initialTemplates } = templateDragRef.current;

    if (!templateId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    templateDragRef.current = {
      templateId: '',
      orderedIds: [],
      originalIds: [],
      initialTemplates: [],
    };
    setDraggedTemplateId('');

    if (orderedIds.join('|') === originalIds.join('|')) {
      return;
    }

    setTemplateStatus('saving');
    setTemplateMessage('');

    try {
      const library = await reorderMagnetTemplates(pin, reorderCategoryMode, reorderCategoryId, orderedIds);
      setTemplateLibrary(library);
      setTemplateStatus('ready');
      setTemplateMessage('Template order saved.');
    } catch (error) {
      setTemplateLibrary(prev => ({
        ...prev,
        templates: initialTemplates,
      }));
      setTemplateStatus('error');
      setTemplateMessage(error.message || 'Unable to reorder templates.');
    }
  };

  const handleOpenCategoryDelete = (category) => {
    setCategoryDeleteTarget(category);
    setCategoryDeleteAction('move');
    setTemplateMessage('');
  };

  const handleCloseCategoryDelete = () => {
    setCategoryDeleteTarget(null);
    setCategoryDeleteAction('move');
  };

  const handleDeleteCategory = async (event) => {
    event.preventDefault();

    if (!categoryDeleteTarget) {
      return;
    }

    setTemplateStatus('saving');
    setTemplateMessage('');

    try {
      const library = await deleteTemplateCategory(pin, categoryDeleteTarget.id, categoryDeleteAction);
      setTemplateLibrary(library);
      setTemplateForm(prev => ({
        ...prev,
        categoryId: prev.categoryId === categoryDeleteTarget.id ? '' : prev.categoryId,
      }));
      setCategoryFilter(prev => (prev === categoryDeleteTarget.id ? 'all' : prev));
      setTemplateStatus('ready');
      setTemplateMessage('Category deleted.');
      handleCloseCategoryDelete();
    } catch (error) {
      setTemplateStatus('error');
      setTemplateMessage(error.message || 'Unable to delete category.');
    }
  };

  const handleDeleteTemplate = async (event) => {
    event.preventDefault();

    if (!templateDeleteTarget) {
      return;
    }

    setTemplateStatus('saving');
    setTemplateMessage('');

    try {
      await deleteMagnetTemplate(pin, templateDeleteTarget.id);
      setTemplateLibrary(prev => ({
        ...prev,
        templates: prev.templates.filter(template => template.id !== templateDeleteTarget.id),
      }));
      setTemplateStatus('ready');
      setTemplateMessage(`Template ${templateDeleteTarget.templateNumber} deleted.`);
      setTemplateDeleteTarget(null);
    } catch (error) {
      setTemplateStatus('error');
      setTemplateMessage(error.message || 'Unable to delete template.');
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
                onChange={handlePinChange}
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

              <div className="template-admin-workflow">
                <form className="settings-form template-panel upload-template-panel" onSubmit={handleCreateTemplate}>
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
                      required={userCategories.length > 0}
                    >
                      <option value="">Choose category</option>
                      {userCategories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                      <option value="__create__">+ Create New Category</option>
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
                  <div className="form-group">
                    <label htmlFor="templateShape">Magnet Shape</label>
                    <select
                      id="templateShape"
                      name="shape"
                      value={templateForm.shape}
                      onChange={handleTemplateChange}
                      required
                    >
                      <option value="rectangle">Rectangle</option>
                      <option value="round">Round</option>
                    </select>
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

                <div className="category-management-wrap">
                  <button
                    type="button"
                    className="manage-categories-button"
                    aria-expanded={isCategoryManagementOpen}
                    onClick={() => setIsCategoryManagementOpen(prev => !prev)}
                  >
                    <span>{isCategoryManagementOpen ? 'Hide Categories' : 'Manage Categories'}</span>
                    <span aria-hidden="true">{isCategoryManagementOpen ? '▲' : '▼'}</span>
                  </button>

                  {isCategoryManagementOpen && (
                    <form className="settings-form template-panel category-management-panel" onSubmit={handleCreateCategory}>
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
                      <button type="submit" className="next-button" disabled={templateStatus === 'saving'}>
                        Create Category
                      </button>

                      <p className="category-reorder-help">Drag categories to change their order.</p>
                      <div className="category-list" aria-label="Template categories">
                        {userCategories.length === 0 ? (
                          <p>No categories yet.</p>
                        ) : (
                          userCategories.map(category => (
                            <div
                              className={draggedCategoryId === category.id ? 'category-row is-dragging' : 'category-row'}
                              data-category-id={category.id}
                              key={category.id}
                            >
                              <button
                                type="button"
                                className="category-drag-handle"
                                aria-label={`Drag ${category.name}`}
                                disabled={templateStatus === 'saving'}
                                onPointerDown={(event) => handleCategoryDragStart(event, category.id)}
                                onPointerMove={handleCategoryDragMove}
                                onPointerUp={handleCategoryDragEnd}
                                onPointerCancel={handleCategoryDragEnd}
                              >
                                ⋮⋮
                              </button>
                              <div className="category-row-main">
                                <span>{category.name}</span>
                                <small>{category.visible ? 'Visible' : 'Hidden'}</small>
                              </div>
                              <button
                                type="button"
                                className="category-edit-button"
                                aria-label={`Edit ${category.name}`}
                                disabled={templateStatus === 'saving'}
                                onClick={() => handleOpenCategoryEdit(category)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="danger-icon-button"
                                aria-label={`Delete ${category.name}`}
                                disabled={templateStatus === 'saving'}
                                onClick={() => handleOpenCategoryDelete(category)}
                              >
                                X
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {isCategoryModalOpen && (
                <div className="settings-modal-backdrop" role="presentation">
                  <form className="settings-form settings-modal" onSubmit={handleCreateCategory}>
                    <div className="settings-modal-header">
                      <h3>Create New Category</h3>
                      <button type="button" className="modal-close-button" onClick={handleCloseCategoryModal}>
                        X
                      </button>
                    </div>
                    <div className="form-group">
                      <label htmlFor="modalCategoryName">Category Name</label>
                      <input
                        id="modalCategoryName"
                        name="name"
                        value={categoryForm.name}
                        onChange={handleCategoryChange}
                        required
                      />
                    </div>
                    <div className="settings-toggle template-toggle">
                      <input
                        id="modalCategoryVisible"
                        name="visible"
                        type="checkbox"
                        checked={categoryForm.visible}
                        onChange={handleCategoryChange}
                      />
                      <label htmlFor="modalCategoryVisible">Visible</label>
                    </div>
                    <div className="settings-modal-actions">
                      <button type="button" className="back-button" onClick={handleCloseCategoryModal}>
                        Cancel
                      </button>
                      <button type="submit" className="next-button" disabled={templateStatus === 'saving'}>
                        {templateStatus === 'saving' ? 'Creating...' : 'Create Category'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {categoryEditTarget && (
                <div className="settings-modal-backdrop" role="presentation">
                  <form className="settings-form settings-modal" onSubmit={handleUpdateCategory}>
                    <div className="settings-modal-header">
                      <h3>Edit Category</h3>
                      <button type="button" className="modal-close-button" onClick={handleCloseCategoryEdit}>
                        X
                      </button>
                    </div>
                    <div className="form-group">
                      <label htmlFor="editCategoryName">Category Name</label>
                      <input
                        id="editCategoryName"
                        value={categoryEditName}
                        onChange={(event) => {
                          setTemplateMessage('');
                          setCategoryEditName(event.target.value);
                        }}
                        required
                      />
                    </div>
                    <div className="settings-modal-actions">
                      <button type="button" className="back-button" onClick={handleCloseCategoryEdit}>
                        Cancel
                      </button>
                      <button type="submit" className="next-button" disabled={templateStatus === 'saving'}>
                        {templateStatus === 'saving' ? 'Saving...' : 'Save Category'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {categoryDeleteTarget && (
                <div className="settings-modal-backdrop" role="presentation">
                  <form className="settings-form settings-modal" onSubmit={handleDeleteCategory}>
                    <div className="settings-modal-header">
                      <h3>Delete Category?</h3>
                      <button type="button" className="modal-close-button" onClick={handleCloseCategoryDelete}>
                        X
                      </button>
                    </div>
                    <div className="delete-confirmation-copy">
                      <p><strong>Category:</strong> {categoryDeleteTarget.name}</p>
                      <p>This category contains {categoryTemplateCounts[categoryDeleteTarget.id] || 0} templates.</p>
                      <p>What would you like to do?</p>
                    </div>
                    <div className="delete-choice-group">
                      <label>
                        <input
                          type="radio"
                          name="categoryDeleteAction"
                          value="move"
                          checked={categoryDeleteAction === 'move'}
                          onChange={(event) => setCategoryDeleteAction(event.target.value)}
                        />
                        Move templates to Uncategorized
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="categoryDeleteAction"
                          value="delete"
                          checked={categoryDeleteAction === 'delete'}
                          onChange={(event) => setCategoryDeleteAction(event.target.value)}
                        />
                        Delete all templates in this category
                      </label>
                    </div>
                    <div className="settings-modal-actions">
                      <button type="button" className="back-button" onClick={handleCloseCategoryDelete}>
                        Cancel
                      </button>
                      <button type="submit" className="danger-button" disabled={templateStatus === 'saving'}>
                        {templateStatus === 'saving' ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {templateDeleteTarget && (
                <div className="settings-modal-backdrop" role="presentation">
                  <form className="settings-form settings-modal" onSubmit={handleDeleteTemplate}>
                    <div className="settings-modal-header">
                      <h3>Delete Template?</h3>
                      <button type="button" className="modal-close-button" onClick={() => setTemplateDeleteTarget(null)}>
                        X
                      </button>
                    </div>
                    <div className="delete-confirmation-copy">
                      <p><strong>{templateDeleteTarget.templateNumber}</strong></p>
                      <p>{templateDeleteTarget.title}</p>
                      <p>This cannot be undone.</p>
                    </div>
                    <div className="settings-modal-actions">
                      <button type="button" className="back-button" onClick={() => setTemplateDeleteTarget(null)}>
                        Cancel
                      </button>
                      <button type="submit" className="danger-button" disabled={templateStatus === 'saving'}>
                        {templateStatus === 'saving' ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

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
                    {userCategories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="template-library-view-control" aria-label="Template library grid view">
                  {templateLibraryViewOptions.map(option => (
                    <button
                      type="button"
                      className={
                        templateLibraryView === option.id
                          ? 'gallery-view-button is-active'
                          : 'gallery-view-button'
                      }
                      aria-pressed={templateLibraryView === option.id}
                      key={option.id}
                      onClick={() => setTemplateLibraryView(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {canReorderTemplates && filteredTemplates.length > 1 && (
                <p className="template-reorder-help">Drag template handles to save a custom order for this category.</p>
              )}

              <div className={templateLibraryGridClassName}>
                {filteredTemplates.length === 0 ? (
                  <div className="empty-template-library">
                    No templates to show.
                  </div>
                ) : (
                  filteredTemplates.map(template => (
                    <article
                      className={draggedTemplateId === template.id ? 'template-card is-dragging' : 'template-card'}
                      data-template-id={template.id}
                      key={template.id}
                    >
                      {canReorderTemplates && (
                        <button
                          type="button"
                          className="template-drag-handle"
                          aria-label={`Drag ${template.title}`}
                          disabled={templateStatus === 'saving'}
                          onPointerDown={(event) => handleTemplateDragStart(event, template.id)}
                          onPointerMove={handleTemplateDragMove}
                          onPointerUp={handleTemplateDragEnd}
                          onPointerCancel={handleTemplateDragEnd}
                        >
                          ⋮⋮
                        </button>
                      )}
                      <MagnetPreview
                        imageUrl={template.imageUrl}
                        title={template.title}
                        shape={template.shape}
                        size="card"
                      />
                      <div className="template-card-body">
                        <div className="template-card-heading">
                          <strong>{template.templateNumber}</strong>
                          <span>{template.featured ? 'Featured' : 'Standard'}</span>
                        </div>
                        <h3>{template.title}</h3>
                        <p>{template.categoryName || 'Uncategorized'}</p>
                        <p>{template.shape === 'round' ? 'Round Magnet' : 'Rectangle Magnet'}</p>
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
                        <button
                          type="button"
                          className="template-delete-button"
                          disabled={templateStatus === 'saving'}
                          onClick={() => setTemplateDeleteTarget(template)}
                        >
                          Delete Template
                        </button>
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
