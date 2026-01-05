// Diary module - handles diary screen rendering, filtering, and stats
// Extracted from app.js for better maintainability

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

const Diary = {
  // Initialize diary filters from localStorage
  initFilters() {
    const saved = localStorage.getItem('diaryCarFilter');
    const filters = {
      timePeriod: 'week', // week, month, year, all
      category: 'all',
      carId: saved || '__all__'
    };
    
    // Validate saved car exists
    if (filters.carId !== '__all__') {
      const carExists = window.state && window.state.cars && 
        window.state.cars.some(c => c.id === filters.carId && !c.deletedAt);
      if (!carExists) {
        filters.carId = '__all__';
        localStorage.setItem('diaryCarFilter', '__all__');
      }
    }
    
    return filters;
  },
  
  // Save car filter to localStorage
  saveCarFilter(carId) {
    localStorage.setItem('diaryCarFilter', carId);
  },
  
  // Filter expenses based on diary filters
  filterExpenses(expenses, filters, state) {
    let filtered = [...expenses];
    
    // Filter by car
    if (filters.carId !== '__all__') {
      filtered = filtered.filter(e => e.carId === filters.carId);
    } else {
      // When "__all__" is selected, show all entries (including legacy ones without carId)
      // No filtering needed
    }
    
    // Filter by category
    if (filters.category !== 'all') {
      filtered = filtered.filter(e => {
        if (e.categoryId && typeof Categories !== 'undefined' && Categories.getCategoryName) {
          const name = Categories.getCategoryName(state.categories || [], e.categoryId);
          return name === filters.category;
        }
        return e.category === filters.category;
      });
    }
    
    
    // Filter by time period
    if (filters.timePeriod !== 'all') {
      const now = new Date();
      filtered = filtered.filter(e => {
        const expDate = new Date(e.date);
        if (filters.timePeriod === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return expDate >= weekAgo;
        } else if (filters.timePeriod === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return expDate >= monthAgo;
        } else if (filters.timePeriod === 'year') {
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          return expDate >= yearAgo;
        }
        return true;
      });
    }
    
    return filtered;
  },
  
  // Filter reminders for diary view
  filterReminders(reminders, filters) {
    let filtered = reminders.filter(r => (r.status || 'active') !== 'done');
    
    // Filter by car
    if (filters.carId !== '__all__') {
      filtered = filtered.filter(r => r.carId === filters.carId);
    }
    
    // Filter by time period using dueDate
    if (filters.timePeriod !== 'all') {
      const now = new Date();
      filtered = filtered.filter(r => {
        if (!r.dueDate) return true;
        const due = new Date(r.dueDate);
        if (filters.timePeriod === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return due >= weekAgo;
        } else if (filters.timePeriod === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return due >= monthAgo;
        } else if (filters.timePeriod === 'year') {
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          return due >= yearAgo;
        }
        return true;
      });
    }
    return filtered;
  },
  
  // Calculate statistics from filtered expenses
  calculateStats(filteredExpenses) {
    const totalAmount = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    
    // Calculate average per day
    let avgPerDay = 0;
    if (filteredExpenses.length > 0) {
      const dates = filteredExpenses.map(e => e.date).filter(Boolean);
      if (dates.length > 0) {
        const firstDate = new Date(Math.min(...dates.map(d => new Date(d).getTime())));
        const lastDate = new Date(Math.max(...dates.map(d => new Date(d).getTime())));
        const daysDiff = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1);
        avgPerDay = totalAmount / daysDiff;
      }
    }
    
    return {
      totalAmount,
      avgPerDay
    };
  },
  
  // Update vehicle chip text
  updateVehicleChip(filters, state) {
    const vehicleChip = document.getElementById('diary-vehicle-chip');
    if (!vehicleChip) return;
    
    const chipText = vehicleChip.querySelector('.chip-text');
    if (!chipText) return;
    
    const cars = (state.cars || []).filter(c => !c.deletedAt);
    
    if (filters.carId === '__all__' || !filters.carId) {
      chipText.textContent = 'Все авто';
    } else {
      const car = cars.find(c => c.id === filters.carId);
      if (car) {
        const label = [car.brand, car.model].filter(Boolean).join(' ');
        const plate = car.plate ? ` · ${car.plate}` : '';
        chipText.textContent = label + plate;
      } else {
        chipText.textContent = 'Все авто';
        filters.carId = '__all__';
        Diary.saveCarFilter('__all__');
      }
    }
  },
  
  // Update category chip text
  updateCategoryChip(filters, state) {
    const categoryChip = document.getElementById('diary-category-chip');
    if (!categoryChip) return;
    
    const chipText = categoryChip.querySelector('.chip-text');
    if (!chipText) return;
    
    if (filters.category === 'all' || !filters.category) {
      chipText.textContent = 'Категория: Все';
    } else {
      // Try to get category name from Categories module
      if (filters.categoryId && typeof Categories !== 'undefined' && Categories.getCategoryName) {
        const name = Categories.getCategoryName(state.categories || [], filters.categoryId);
        chipText.textContent = `Категория: ${name}`;
      } else {
        chipText.textContent = `Категория: ${filters.category}`;
      }
    }
  },
  
  // Show vehicle selector bottom sheet
  showVehicleSelector(filters, state, onSelect) {
    const cars = (state.cars || []).filter(c => !c.deletedAt);
    
    // Create bottom sheet
    const sheet = document.createElement('div');
    sheet.className = 'ios-sheet-overlay';
    sheet.id = 'vehicle-selector-sheet';
    sheet.innerHTML = `
      <div class="ios-sheet">
        <div class="ios-sheet-header">
          <h2>Выберите автомобиль</h2>
          <button class="ios-sheet-close" data-close-sheet>
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="ios-sheet-content">
          <div class="ios-grouped-list">
            <div class="ios-group">
              <div class="ios-cell" data-select-vehicle="__all__">
                <div class="ios-cell-content">
                  <div class="ios-cell-title">Все авто</div>
                </div>
              </div>
            </div>
            ${cars.length > 0 ? `
            <div class="ios-group">
              ${cars.map(car => {
                const label = [car.brand, car.model].filter(Boolean).join(' ');
                const plate = car.plate ? ` · ${car.plate}` : '';
                return `
                  <div class="ios-cell" data-select-vehicle="${car.id}">
                    <div class="ios-cell-content">
                      <div class="ios-cell-title">${escapeHtml(label + plate)}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(sheet);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // Close handlers
    sheet.querySelector('[data-close-sheet]').addEventListener('click', () => {
      sheet.remove();
    });
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) {
        sheet.remove();
      }
    });
    
    // Selection handlers
    sheet.querySelectorAll('[data-select-vehicle]').forEach(cell => {
      cell.addEventListener('click', () => {
        const carId = cell.dataset.selectVehicle;
        onSelect(carId);
        sheet.remove();
      });
    });
  },
  
  // Show category selector bottom sheet
  showCategorySelector(filters, state, onSelect) {
    const categories = state.categories || [];
    const activeCategories = categories.filter(c => !c.isArchived);
    
    // Create bottom sheet
    const sheet = document.createElement('div');
    sheet.className = 'ios-sheet-overlay';
    sheet.id = 'category-selector-sheet';
    sheet.innerHTML = `
      <div class="ios-sheet">
        <div class="ios-sheet-header">
          <h2>Выберите категорию</h2>
          <button class="ios-sheet-close" data-close-sheet>
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="ios-sheet-content">
          <div class="ios-grouped-list">
            <div class="ios-group">
              <div class="ios-cell" data-select-category="all">
                <div class="ios-cell-content">
                  <div class="ios-cell-title">Все</div>
                </div>
              </div>
            </div>
            ${activeCategories.length > 0 ? `
            <div class="ios-group">
              ${activeCategories.map(cat => `
                <div class="ios-cell" data-select-category="${cat.id}" data-category-name="${escapeHtml(cat.name)}">
                  <div class="ios-cell-content">
                    <div class="ios-cell-title">${escapeHtml(cat.name)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(sheet);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // Close handlers
    sheet.querySelector('[data-close-sheet]').addEventListener('click', () => {
      sheet.remove();
    });
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) {
        sheet.remove();
      }
    });
    
    // Selection handlers
    sheet.querySelectorAll('[data-select-category]').forEach(cell => {
      cell.addEventListener('click', () => {
        const categoryId = cell.dataset.selectCategory;
        const categoryName = cell.dataset.categoryName || 'Все';
        onSelect(categoryId === 'all' ? 'all' : categoryId, categoryName);
        sheet.remove();
      });
    });
  },
  
  // Initialize toolbar chips and handlers
  initToolbar(container, filters, state) {
    // Update chip texts
    Diary.updateVehicleChip(filters, state);
    Diary.updateCategoryChip(filters, state);
    
    // Vehicle chip click handler
    const vehicleChip = document.getElementById('diary-vehicle-chip');
    if (vehicleChip) {
      vehicleChip.addEventListener('click', () => {
        Diary.showVehicleSelector(filters, state, (carId) => {
          filters.carId = carId;
          Diary.saveCarFilter(carId);
          Diary.updateVehicleChip(filters, state);
          document.dispatchEvent(new CustomEvent('diaryFilterChanged', { detail: { carId } }));
        });
      });
    }
    
    // Category chip click handler
    const categoryChip = document.getElementById('diary-category-chip');
    if (categoryChip) {
      categoryChip.addEventListener('click', () => {
        Diary.showCategorySelector(filters, state, (categoryId, categoryName) => {
          filters.category = categoryId === 'all' ? 'all' : categoryName;
          filters.categoryId = categoryId === 'all' ? null : categoryId;
          Diary.updateCategoryChip(filters, state);
          document.dispatchEvent(new CustomEvent('diaryFilterChanged'));
        });
      });
    }
    
    // Date button click handler - will be handled in app.js
  }
};

// Export to window for global access
window.Diary = Diary;

