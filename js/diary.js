// Diary module - handles diary screen rendering, filtering, and stats
// Extracted from app.js for better maintainability

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
  
  // Render car filter dropdown
  renderCarFilter(container, filters, state) {
    const filterRow = container.querySelector('.filter');
    if (!filterRow) return;
    
    // Remove existing car filter if present
    const existingCarFilter = document.getElementById('diary-car-filter');
    if (existingCarFilter) {
      existingCarFilter.remove();
    }
    
    const cars = (state.cars || []).filter(c => !c.deletedAt);
    
    // Don't show filter if no cars
    if (cars.length === 0) return;
    
    // Create car filter select
    const carSelect = document.createElement('select');
    carSelect.id = 'diary-car-filter';
    carSelect.className = 'diary-car-filter';
    
    // Add "All cars" option
    const allOption = document.createElement('option');
    allOption.value = '__all__';
    allOption.textContent = 'Все авто';
    carSelect.appendChild(allOption);
    
    // Add car options
    cars.forEach(car => {
      const option = document.createElement('option');
      option.value = car.id;
      const label = [car.brand, car.model].filter(Boolean).join(' ');
      const plate = car.plate ? ` · ${car.plate}` : '';
      option.textContent = label + plate;
      carSelect.appendChild(option);
    });
    
    // Set current value
    carSelect.value = filters.carId || '__all__';
    
    // Add change handler
    carSelect.addEventListener('change', () => {
      const selectedCarId = carSelect.value;
      filters.carId = selectedCarId;
      Diary.saveCarFilter(selectedCarId);
      // Trigger diary re-render
      const event = new CustomEvent('diaryFilterChanged', { detail: { carId: selectedCarId } });
      document.dispatchEvent(event);
    });
    
    // Insert before category filter
    const categoryFilter = filterRow.querySelector('#diary-category-filter');
    if (categoryFilter) {
      filterRow.insertBefore(carSelect, categoryFilter);
    } else {
      filterRow.insertBefore(carSelect, filterRow.firstChild);
    }
  }
};

// Export to window for global access
window.Diary = Diary;

