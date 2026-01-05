// js/search.js
// Advanced search and filtering module

const Search = {
  // Advanced filters state
  advancedFilters: {
    carId: 'all',
    type: 'all',
    dateFrom: null,
    dateTo: null,
    amountFrom: null,
    amountTo: null,
    hasReceipt: false,
    tags: []
  },

  // Reset filters to default
  resetFilters() {
    this.advancedFilters = {
      carId: 'all',
      type: 'all',
      dateFrom: null,
      dateTo: null,
      amountFrom: null,
      amountTo: null,
      hasReceipt: false,
      tags: []
    };
  },

  // Apply advanced filters to expenses
  filterExpenses(expenses, filters = this.advancedFilters, state = window.state) {
    let filtered = [...expenses];

    // Filter by car
    if (filters.carId && filters.carId !== 'all') {
      filtered = filtered.filter(exp => exp.carId === filters.carId);
    }

    // Filter by type
    if (filters.type && filters.type !== 'all') {
      filtered = filtered.filter(exp => {
        if (filters.type === 'expense') return !exp.type || exp.type === 'expense';
        if (filters.type === 'fuel') return exp.type === 'fuel';
        if (filters.type === 'service') return exp.type === 'service';
        if (filters.type === 'reminder') return exp.type === 'reminder';
        return true;
      });
    }

    // Filter by date range
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(exp => {
        if (!exp.date) return false;
        const expDate = new Date(exp.date);
        expDate.setHours(0, 0, 0, 0);
        return expDate >= fromDate;
      });
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(exp => {
        if (!exp.date) return false;
        const expDate = new Date(exp.date);
        expDate.setHours(0, 0, 0, 0);
        return expDate <= toDate;
      });
    }

    // Filter by amount range
    if (filters.amountFrom !== null && filters.amountFrom !== '') {
      const amountFrom = parseFloat(filters.amountFrom);
      if (!isNaN(amountFrom)) {
        filtered = filtered.filter(exp => {
          const amount = parseFloat(exp.amount) || 0;
          return amount >= amountFrom;
        });
      }
    }

    if (filters.amountTo !== null && filters.amountTo !== '') {
      const amountTo = parseFloat(filters.amountTo);
      if (!isNaN(amountTo)) {
        filtered = filtered.filter(exp => {
          const amount = parseFloat(exp.amount) || 0;
          return amount <= amountTo;
        });
      }
    }

    // Filter by receipt presence
    if (filters.hasReceipt) {
      filtered = filtered.filter(exp => {
        return (exp.receipts && exp.receipts.length > 0) || 
               (exp.receiptImages && exp.receiptImages.length > 0);
      });
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(exp => {
        const expTags = (exp.tags || []).map(t => t.toLowerCase());
        const searchTags = filters.tags.map(t => t.toLowerCase().trim()).filter(Boolean);
        return searchTags.some(tag => 
          expTags.some(expTag => expTag.includes(tag))
        );
      });
    }

    return filtered;
  },

  // Global search across all fields
  globalSearch(query, items, state = window.state) {
    if (!query || !query.trim()) return items;

    const searchLower = query.toLowerCase().trim();
    const searchTerms = searchLower.split(/\s+/);

    return items.filter(item => {
      // Search in notes
      const notes = (item.notes || '').toLowerCase();
      if (searchTerms.some(term => notes.includes(term))) return true;

      // Search in category name
      if (item.categoryId && typeof Categories !== 'undefined') {
        const catName = Categories.getCategoryName(item.categoryId, state);
        if (catName && searchTerms.some(term => catName.toLowerCase().includes(term))) {
          return true;
        }
      }
      if (item.category && searchTerms.some(term => item.category.toLowerCase().includes(term))) {
        return true;
      }

      // Search in shop/station
      if (item.shop && searchTerms.some(term => item.shop.toLowerCase().includes(term))) {
        return true;
      }
      if (item.station && searchTerms.some(term => item.station.toLowerCase().includes(term))) {
        return true;
      }

      // Search in reminder title
      if (item.title && searchTerms.some(term => item.title.toLowerCase().includes(term))) {
        return true;
      }

      // Search in tags
      if (item.tags && Array.isArray(item.tags)) {
        const tagsStr = item.tags.join(' ').toLowerCase();
        if (searchTerms.some(term => tagsStr.includes(term))) {
          return true;
        }
      }

      return false;
    });
  }
};

window.Search = Search;

