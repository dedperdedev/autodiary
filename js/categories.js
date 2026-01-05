// Categories and Subcategories module
// Handles 2-level hierarchy for expense categorization

const Categories = {
  // Default categories with subcategories
  getDefaults() {
    return {
      categories: [
        { id: 'cat-fuel', name: 'Заправка', icon: 'fuel', sortOrder: 1, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'cat-service', name: 'Сервис', icon: 'wrench', sortOrder: 2, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'cat-repair', name: 'Ремонт', icon: 'tool', sortOrder: 3, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'cat-parts', name: 'Запчасти', icon: 'package', sortOrder: 4, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'cat-insurance', name: 'Страхование', icon: 'shield', sortOrder: 5, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'cat-taxes', name: 'Налоги/Регистрация', icon: 'file-text', sortOrder: 6, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'cat-wash', name: 'Мойка', icon: 'droplet', sortOrder: 7, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'cat-parking', name: 'Парковка/Платные дороги', icon: 'map-pin', sortOrder: 8, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'cat-tires', name: 'Шины', icon: 'circle', sortOrder: 9, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'cat-fines', name: 'Штрафы', icon: 'alert-circle', sortOrder: 10, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'cat-other', name: 'Прочее', icon: 'more-horizontal', sortOrder: 99, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      ],
      subcategories: [
        // Fuel subcategories
        { id: 'sub-fuel-gas', categoryId: 'cat-fuel', name: 'Бензин', sortOrder: 1, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-fuel-diesel', categoryId: 'cat-fuel', name: 'Дизель', sortOrder: 2, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-fuel-lpg', categoryId: 'cat-fuel', name: 'Газ', sortOrder: 3, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-fuel-ev', categoryId: 'cat-fuel', name: 'Электрозарядка', sortOrder: 4, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-fuel-additives', categoryId: 'cat-fuel', name: 'Присадки', sortOrder: 5, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        // Service subcategories
        { id: 'sub-svc-oil', categoryId: 'cat-service', name: 'Масло', sortOrder: 1, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-svc-oil-filter', categoryId: 'cat-service', name: 'Масляный фильтр', sortOrder: 2, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-svc-air-filter', categoryId: 'cat-service', name: 'Воздушный фильтр', sortOrder: 3, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-svc-cabin-filter', categoryId: 'cat-service', name: 'Фильтр салона', sortOrder: 4, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-svc-spark-plugs', categoryId: 'cat-service', name: 'Свечи зажигания', sortOrder: 5, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-svc-diagnostics', categoryId: 'cat-service', name: 'Диагностика', sortOrder: 6, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        // Repair subcategories
        { id: 'sub-rep-engine', categoryId: 'cat-repair', name: 'Двигатель', sortOrder: 1, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-rep-transmission', categoryId: 'cat-repair', name: 'КПП', sortOrder: 2, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-rep-suspension', categoryId: 'cat-repair', name: 'Подвеска', sortOrder: 3, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-rep-steering', categoryId: 'cat-repair', name: 'Рулевое', sortOrder: 4, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-rep-electrical', categoryId: 'cat-repair', name: 'Электрика', sortOrder: 5, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        // Parts subcategories
        { id: 'sub-parts-oem', categoryId: 'cat-parts', name: 'Оригинал', sortOrder: 1, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-parts-aftermarket', categoryId: 'cat-parts', name: 'Неоригинал', sortOrder: 2, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-parts-used', categoryId: 'cat-parts', name: 'Б/У', sortOrder: 3, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        // Insurance subcategories
        { id: 'sub-ins-osago', categoryId: 'cat-insurance', name: 'ОСАГО', sortOrder: 1, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-ins-kasko', categoryId: 'cat-insurance', name: 'КАСКО', sortOrder: 2, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-ins-green', categoryId: 'cat-insurance', name: 'Зеленая карта', sortOrder: 3, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        // Taxes subcategories
        { id: 'sub-tax-reg', categoryId: 'cat-taxes', name: 'Регистрация', sortOrder: 1, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-tax-tax', categoryId: 'cat-taxes', name: 'Налог', sortOrder: 2, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-tax-inspection', categoryId: 'cat-taxes', name: 'Техосмотр', sortOrder: 3, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        // Wash subcategories
        { id: 'sub-wash-wash', categoryId: 'cat-wash', name: 'Мойка', sortOrder: 1, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-wash-detail', categoryId: 'cat-wash', name: 'Детейлинг', sortOrder: 2, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-wash-polish', categoryId: 'cat-wash', name: 'Полировка', sortOrder: 3, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        // Parking subcategories
        { id: 'sub-park-parking', categoryId: 'cat-parking', name: 'Парковка', sortOrder: 1, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-park-tolls', categoryId: 'cat-parking', name: 'Платные дороги', sortOrder: 2, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-park-impound', categoryId: 'cat-parking', name: 'Эвакуация', sortOrder: 3, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        // Tires subcategories
        { id: 'sub-tire-purchase', categoryId: 'cat-tires', name: 'Покупка', sortOrder: 1, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-tire-service', categoryId: 'cat-tires', name: 'Шиномонтаж', sortOrder: 2, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-tire-storage', categoryId: 'cat-tires', name: 'Хранение', sortOrder: 3, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        // Fines subcategories
        { id: 'sub-fine-camera', categoryId: 'cat-fines', name: 'Камера', sortOrder: 1, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-fine-parking', categoryId: 'cat-fines', name: 'Парковка', sortOrder: 2, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-fine-police', categoryId: 'cat-fines', name: 'ГИБДД', sortOrder: 3, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        // Other subcategories
        { id: 'sub-other-accessories', categoryId: 'cat-other', name: 'Аксессуары', sortOrder: 1, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'sub-other-subscriptions', categoryId: 'cat-other', name: 'Подписки', sortOrder: 2, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      ]
    };
  },
  
  // Normalize name for comparison (trim + lowercase)
  normalizeName(name) {
    return (name || '').trim().toLowerCase();
  },
  
  // Find category by normalized name
  findCategoryByName(categories, name) {
    const normalized = Categories.normalizeName(name);
    return categories.find(c => !c.isArchived && Categories.normalizeName(c.name) === normalized);
  },
  
  // Find subcategory by normalized name within category
  findSubcategoryByName(subcategories, categoryId, name) {
    const normalized = Categories.normalizeName(name);
    return subcategories.find(s => !s.isArchived && s.categoryId === categoryId && Categories.normalizeName(s.name) === normalized);
  },
  
  // Get active categories
  getActive(categories) {
    return categories.filter(c => !c.isArchived).sort((a, b) => a.sortOrder - b.sortOrder);
  },
  
  // Get active subcategories for category
  getSubcategoriesForCategory(subcategories, categoryId) {
    return subcategories.filter(s => !s.isArchived && s.categoryId === categoryId).sort((a, b) => a.sortOrder - b.sortOrder);
  },
  
  // Get category name by id
  getCategoryName(categories, categoryId) {
    const cat = categories.find(c => c.id === categoryId);
    return cat ? cat.name : 'Неизвестная категория';
  },
  
  // Get subcategory name by id
  getSubcategoryName(subcategories, subcategoryId) {
    if (!subcategoryId) return null;
    const sub = subcategories.find(s => s.id === subcategoryId);
    return sub ? sub.name : null;
  },
  
  // Get display text for expense (Category • Subcategory or Category • Unspecified)
  getDisplayText(categories, subcategories, categoryId, subcategoryId) {
    const catName = Categories.getCategoryName(categories, categoryId);
    if (!subcategoryId) {
      return catName + ' • Не указано';
    }
    const subName = Categories.getSubcategoryName(subcategories, subcategoryId);
    return subName ? catName + ' • ' + subName : catName + ' • Не указано';
  },
  
  // Get recent category+subcategory combos for car (last 5)
  getRecentCombos(expenses, carId, limit = 5) {
    const carExpenses = expenses.filter(e => e.carId === carId && e.categoryId && !e.deletedAt);
    const combos = [];
    const seen = new Set();
    
    // Sort by date descending
    const sorted = [...carExpenses].sort((a, b) => {
      const dateA = new Date(a.date + ' ' + (a.time || '00:00'));
      const dateB = new Date(b.date + ' ' + (b.time || '00:00'));
      return dateB - dateA;
    });
    
    for (const exp of sorted) {
      const key = `${exp.categoryId}:${exp.subcategoryId || ''}`;
      if (!seen.has(key) && combos.length < limit) {
        seen.add(key);
        combos.push({
          categoryId: exp.categoryId,
          subcategoryId: exp.subcategoryId || null
        });
      }
    }
    
    return combos;
  },
  
  // Get frequent categories for car (top 8 by usage last 90 days)
  getFrequentCategories(expenses, carId, categories, limit = 8) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    
    const carExpenses = expenses.filter(e => {
      if (e.carId !== carId || !e.categoryId || e.deletedAt) return false;
      const expDate = new Date(e.date + ' ' + (e.time || '00:00'));
      return expDate >= cutoffDate;
    });
    
    // Count by category
    const counts = {};
    carExpenses.forEach(exp => {
      counts[exp.categoryId] = (counts[exp.categoryId] || 0) + 1;
    });
    
    // Sort by count and get top N
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([categoryId]) => categories.find(c => c.id === categoryId))
      .filter(Boolean);
  },
  
  // Get frequent subcategories for category (last 90 days)
  getFrequentSubcategories(expenses, carId, categoryId, subcategories, limit = 5) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    
    const carExpenses = expenses.filter(e => {
      if (e.carId !== carId || e.categoryId !== categoryId || !e.subcategoryId || e.deletedAt) return false;
      const expDate = new Date(e.date + ' ' + (e.time || '00:00'));
      return expDate >= cutoffDate;
    });
    
    // Count by subcategory
    const counts = {};
    carExpenses.forEach(exp => {
      counts[exp.subcategoryId] = (counts[exp.subcategoryId] || 0) + 1;
    });
    
    // Sort by count and get top N
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([subcategoryId]) => subcategories.find(s => s.id === subcategoryId))
      .filter(Boolean);
  },
  
  // Create new category
  createCategory(name, icon = 'more-horizontal', sortOrder = null) {
    const categories = state.categories || [];
    const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sortOrder || 0)) : 0;
    
    return {
      id: 'cat-' + Date.now(),
      name: name.trim(),
      icon: icon,
      sortOrder: sortOrder !== null ? sortOrder : maxOrder + 1,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  },
  
  // Create new subcategory
  createSubcategory(categoryId, name, sortOrder = null) {
    const subcategories = state.subcategories || [];
    const categorySubs = subcategories.filter(s => s.categoryId === categoryId);
    const maxOrder = categorySubs.length > 0 ? Math.max(...categorySubs.map(s => s.sortOrder || 0)) : 0;
    
    return {
      id: 'sub-' + Date.now(),
      categoryId: categoryId,
      name: name.trim(),
      sortOrder: sortOrder !== null ? sortOrder : maxOrder + 1,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  },
  
  // Check if category name is unique
  isCategoryNameUnique(categories, name, excludeId = null) {
    const normalized = Categories.normalizeName(name);
    return !categories.some(c => 
      c.id !== excludeId && 
      !c.isArchived && 
      Categories.normalizeName(c.name) === normalized
    );
  },
  
  // Check if subcategory name is unique within category
  isSubcategoryNameUnique(subcategories, categoryId, name, excludeId = null) {
    const normalized = Categories.normalizeName(name);
    return !subcategories.some(s => 
      s.id !== excludeId && 
      s.categoryId === categoryId && 
      !s.isArchived && 
      Categories.normalizeName(s.name) === normalized
    );
  },
  
  // Update category
  updateCategory(categoryId, updates, state) {
    const category = (state.categories || []).find(c => c.id === categoryId);
    if (!category) return false;
    
    if (updates.name !== undefined) {
      if (!Categories.isCategoryNameUnique(state.categories || [], updates.name, categoryId)) {
        return false; // Duplicate name
      }
      category.name = updates.name.trim();
    }
    if (updates.icon !== undefined) {
      category.icon = updates.icon;
    }
    category.updatedAt = new Date().toISOString();
    return true;
  },
  
  // Update subcategory
  updateSubcategory(subcategoryId, updates, state) {
    const subcategory = (state.subcategories || []).find(s => s.id === subcategoryId);
    if (!subcategory) return false;
    
    if (updates.name !== undefined) {
      if (!Categories.isSubcategoryNameUnique(state.subcategories || [], subcategory.categoryId, updates.name, subcategoryId)) {
        return false; // Duplicate name
      }
      subcategory.name = updates.name.trim();
    }
    subcategory.updatedAt = new Date().toISOString();
    return true;
  },
  
  // Archive/unarchive category
  archiveCategory(categoryId, archive, state) {
    const category = (state.categories || []).find(c => c.id === categoryId);
    if (!category) return false;
    category.isArchived = archive;
    category.updatedAt = new Date().toISOString();
    return true;
  },
  
  // Archive/unarchive subcategory
  archiveSubcategory(subcategoryId, archive, state) {
    const subcategory = (state.subcategories || []).find(s => s.id === subcategoryId);
    if (!subcategory) return false;
    subcategory.isArchived = archive;
    subcategory.updatedAt = new Date().toISOString();
    return true;
  },
  
  // Move category up/down
  moveCategory(categoryId, direction, state) {
    const categories = (state.categories || []).filter(c => !c.isArchived).sort((a, b) => a.sortOrder - b.sortOrder);
    const index = categories.findIndex(c => c.id === categoryId);
    if (index === -1) return false;
    
    if (direction === 'up' && index > 0) {
      const temp = categories[index].sortOrder;
      categories[index].sortOrder = categories[index - 1].sortOrder;
      categories[index - 1].sortOrder = temp;
    } else if (direction === 'down' && index < categories.length - 1) {
      const temp = categories[index].sortOrder;
      categories[index].sortOrder = categories[index + 1].sortOrder;
      categories[index + 1].sortOrder = temp;
    } else {
      return false;
    }
    
    categories[index].updatedAt = new Date().toISOString();
    if (direction === 'up' && index > 0) {
      categories[index - 1].updatedAt = new Date().toISOString();
    } else if (direction === 'down' && index < categories.length - 1) {
      categories[index + 1].updatedAt = new Date().toISOString();
    }
    
    return true;
  },
  
  // Move subcategory up/down
  moveSubcategory(subcategoryId, direction, state) {
    const subcategory = (state.subcategories || []).find(s => s.id === subcategoryId);
    if (!subcategory) return false;
    
    const subcategories = (state.subcategories || [])
      .filter(s => !s.isArchived && s.categoryId === subcategory.categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const index = subcategories.findIndex(s => s.id === subcategoryId);
    if (index === -1) return false;
    
    if (direction === 'up' && index > 0) {
      const temp = subcategories[index].sortOrder;
      subcategories[index].sortOrder = subcategories[index - 1].sortOrder;
      subcategories[index - 1].sortOrder = temp;
    } else if (direction === 'down' && index < subcategories.length - 1) {
      const temp = subcategories[index].sortOrder;
      subcategories[index].sortOrder = subcategories[index + 1].sortOrder;
      subcategories[index + 1].sortOrder = temp;
    } else {
      return false;
    }
    
    subcategories[index].updatedAt = new Date().toISOString();
    if (direction === 'up' && index > 0) {
      subcategories[index - 1].updatedAt = new Date().toISOString();
    } else if (direction === 'down' && index < subcategories.length - 1) {
      subcategories[index + 1].updatedAt = new Date().toISOString();
    }
    
    return true;
  }
};

// Export to window for global access
window.Categories = Categories;

