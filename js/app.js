    // Utility: Escape HTML to prevent XSS
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Utility: Show toast notification
    function showToast(message, duration = 3000) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.add('active');
      setTimeout(() => toast.classList.remove('active'), duration);
    }

    // Utility: Show modal confirmation
    function showModal(title, text, onConfirm) {
      const overlay = document.getElementById('modal-overlay');
      const modalTitle = document.getElementById('modal-title');
      const modalText = document.getElementById('modal-text');
      const confirmBtn = document.getElementById('modal-confirm');
      const cancelBtn = document.getElementById('modal-cancel');
      
      modalTitle.textContent = title;
      modalText.textContent = text;
      overlay.classList.add('active');
      
      const cleanup = () => {
        overlay.classList.remove('active');
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
        overlay.onclick = null;
      };
      
      confirmBtn.onclick = () => {
        cleanup();
        if(onConfirm) onConfirm();
      };
      
      cancelBtn.onclick = cleanup;
      overlay.onclick = (e) => {
        if(e.target === overlay) cleanup();
      };
    }

    // Data storage with error handling
    const Storage = {
      get(key, def = []) {
        try {
          const item = localStorage.getItem(key);
          return item ? JSON.parse(item) : def;
        } catch (e) {
          console.error('Storage get error:', e);
          return def;
        }
      },
      set(key, value) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (e) {
          if(e.name === 'QuotaExceededError') {
            showToast('РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РјРµСЃС‚Р° РІ С…СЂР°РЅРёР»РёС‰Рµ', 5000);
          } else {
            console.error('Storage set error:', e);
            showToast('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ РґР°РЅРЅС‹С…', 3000);
          }
          return false;
        }
      }
    };

    // State
    let currentCarId = null;
    let editingExpenseId = null;
    let editingCarId = null;
    let editingReminderId = null;
    let diaryFilters = {
      timePeriod: 'week', // week, month, year, all
      category: 'all',
      search: '',
      carId: 'all'
    };

    const state = {
      cars: Storage.get('autodiary:cars', []),
      expenses: Storage.get('autodiary:expenses', []),
      maintenance: Storage.get('autodiary:maintenance', {}),
      intervals: Storage.get('autodiary:intervals', {}),
      reminders: Storage.get('autodiary:reminders', [])
    };

    // View switching
    let views = [];
    let tabs = [];

    function showView(id){
      // Initialize views and tabs if not already done
      if(views.length === 0) {
        views = [...document.querySelectorAll('.view')];
      }
      if(tabs.length === 0) {
        tabs = [...document.querySelectorAll('.tab')];
      }
      [...document.querySelectorAll('.view')].forEach(v=>v.classList.toggle('active',v.id===id));
      tabs.forEach(t=>t.classList.toggle('active',t.dataset.goto===id || (id==='screen-garage-empty' && t.dataset.goto==='screen-garage')));
      window.scrollTo({top:0,behavior:'instant'});
      
      if(id==='screen-garage'){
        // Reload state from storage before checking
        state.cars = Storage.get('autodiary:cars', []);
        if(state.cars.length === 0){
          showView('screen-garage-empty');
          return;
        }
        renderGarage();
      } else if(id==='screen-diary'){
        renderDiary();
      } else if(id==='screen-settings'){
        refreshSettingsScreen();
      } else if(id==='screen-reminders'){
        renderReminders();
      } else if(id==='screen-add-reminder'){
        populateReminderCarSelect();
      } else if(id==='screen-export'){
        // Export screen ready
      }
    }

    // Calculate metrics for car
    function calculateCarMetrics(carId) {
      const expenses = state.expenses.filter(e => e.carId === carId && e.odometer > 0);
      const fuelExpenses = expenses.filter(e => e.category === 'Заправка' || e.category === 'Электрозарядка');
      
      let fuelConsumption = 0;
      let costPerKm = 0;
      let avgDay = 0;
      
      // Calculate fuel consumption (L/100km)
      if(fuelExpenses.length >= 2) {
        const sorted = [...fuelExpenses].sort((a,b) => a.odometer - b.odometer);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const distance = last.odometer - first.odometer;
        if(distance > 0) {
          // Assuming average fuel price, simplified calculation
          const totalFuel = fuelExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
          fuelConsumption = (totalFuel / distance * 100);
        }
      }
      
      // Calculate cost per km
      if(expenses.length > 0) {
        const sorted = [...expenses].sort((a,b) => a.odometer - b.odometer);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const distance = last.odometer - first.odometer;
        if(distance > 0) {
          const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
          costPerKm = (total / distance);
        }
      }
      
      // Calculate average per day
      const allExpenses = state.expenses.filter(e => e.carId === carId);
      if(allExpenses.length > 0) {
        const total = allExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
        const firstDate = new Date(Math.min(...allExpenses.map(e => new Date(e.date).getTime())));
        const days = Math.max(1, Math.floor((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
        avgDay = total / days;
      }
      
      return { fuelConsumption, costPerKm, avgDay };
    }

    // Render garage
    function renderGarage(){
      // Reload state from storage to ensure we have latest data
      state.cars = Storage.get('autodiary:cars', []);
      state.expenses = Storage.get('autodiary:expenses', []);
      
      const container = document.querySelector('#screen-garage .main-pad');
      if(!container) {
        console.error('Garage container not found');
        return;
      }
      
      console.log('Rendering garage, cars in state:', state.cars.length, state.cars);
      
      if(state.cars.length === 0){
        container.innerHTML = '';
        console.log('No cars found, clearing container');
        return;
      }
      
      console.log('Rendering garage with', state.cars.length, 'cars');
      
      // Create iOS grouped list container
      const groupedList = document.createElement('div');
      groupedList.className = 'ios-grouped-list';
      
      state.cars.forEach((car, index) => {
        const expenses = state.expenses.filter(e => e.carId === car.id);
        const metrics = calculateCarMetrics(car.id);
        
        // Format metrics
        const fuelConsumption = (typeof metrics.fuelConsumption === 'number' && !isNaN(metrics.fuelConsumption)) ? 
          metrics.fuelConsumption.toFixed(1) : '—';
        const costPerKm = (typeof metrics.costPerKm === 'number' && !isNaN(metrics.costPerKm)) ? 
          metrics.costPerKm.toFixed(2) : '—';
        const avgDay = (typeof metrics.avgDay === 'number' && !isNaN(metrics.avgDay)) ? 
          Math.round(metrics.avgDay).toLocaleString('ru-RU') : '—';
        
        // Create iOS group for each car
        const group = document.createElement('div');
        group.className = 'ios-group';
        
        // Main car cell (clickable, opens details or adds expense)
        const carCell = document.createElement('div');
        carCell.className = 'ios-cell ios-cell-car';
        carCell.dataset.carId = car.id;
        
        // Car icon
        const iconDiv = document.createElement('div');
        iconDiv.className = 'ios-cell-icon ios-cell-icon-car';
        iconDiv.innerHTML = '<i data-lucide="car"></i>';
        
        // Car content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'ios-cell-content';
        contentDiv.innerHTML = `
          <div class="ios-cell-title">${escapeHtml(car.brand)} ${escapeHtml(car.model)}</div>
          <div class="ios-cell-subtitle">${car.year} • ${escapeHtml(car.fuel)} • ${expenses.length} ${expenses.length === 1 ? 'расход' : expenses.length < 5 ? 'расхода' : 'расходов'}</div>
        `;
        
        // Trailing metrics
        const trailingDiv = document.createElement('div');
        trailingDiv.className = 'ios-cell-trailing';
        trailingDiv.innerHTML = `
          <div class="car-metrics-compact">
            <div class="car-metric-item">
              <span class="car-metric-value">${fuelConsumption}</span>
              <span class="car-metric-unit">л/100км</span>
            </div>
            <div class="car-metric-item">
              <span class="car-metric-value">${costPerKm}</span>
              <span class="car-metric-unit">₴/км</span>
            </div>
          </div>
        `;
        
        // Swipe actions (hidden by default)
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'ios-cell-actions';
        actionsDiv.style.display = 'none';
        actionsDiv.innerHTML = `
          <button data-edit-car="${car.id}" title="Редактировать" class="ios-cell-action-btn">
            <i data-lucide="pencil"></i>
          </button>
          <button data-delete-car="${car.id}" title="Удалить" class="ios-cell-action-btn ios-cell-action-btn-danger">
            <i data-lucide="trash-2"></i>
          </button>
        `;
        
        trailingDiv.appendChild(actionsDiv);
        
        carCell.appendChild(iconDiv);
        carCell.appendChild(contentDiv);
        carCell.appendChild(trailingDiv);
        
        // Add swipe handler for edit/delete
        let startX = 0;
        let currentX = 0;
        let isSwiping = false;
        
        carCell.addEventListener('touchstart', (e) => {
          startX = e.touches[0].clientX;
          isSwiping = true;
        });
        
        carCell.addEventListener('touchmove', (e) => {
          if (!isSwiping) return;
          currentX = e.touches[0].clientX - startX;
          if (currentX < -50) {
            carCell.style.transform = `translateX(${currentX}px)`;
            actionsDiv.style.display = 'flex';
          } else if (currentX > 0) {
            carCell.style.transform = 'translateX(0)';
            actionsDiv.style.display = 'none';
          }
        });
        
        carCell.addEventListener('touchend', () => {
          if (currentX < -100) {
            carCell.style.transform = 'translateX(-80px)';
            actionsDiv.style.display = 'flex';
          } else {
            carCell.style.transform = 'translateX(0)';
            actionsDiv.style.display = 'none';
          }
          isSwiping = false;
        });
        
        // Click handler - open car details
        carCell.addEventListener('click', (e) => {
          const isActionBtn = e.target.closest('.ios-cell-action-btn');
          if (isActionBtn) {
            e.stopPropagation();
            return;
          }
          if (actionsDiv.style.display === 'flex') {
            carCell.style.transform = 'translateX(0)';
            actionsDiv.style.display = 'none';
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          // Open car details
          loadCarDetails(car.id);
          showView('screen-car-details');
        });
        
        group.appendChild(carCell);
        
        // Quick action buttons (iOS style compact buttons)
        const quickActions = document.createElement('div');
        quickActions.className = 'car-quick-actions';
        quickActions.dataset.ignoreClick = 'true';
        quickActions.innerHTML = `
          <button class="ios-button-compact ios-button-primary" data-goto="screen-expense-form" data-car-id="${car.id}" title="Добавить расход">
            <i data-lucide="plus"></i>
            <span>Расход</span>
          </button>
          <button class="ios-button-compact ios-button-accent" data-goto="screen-expense-form" data-car-id="${car.id}" data-scroll="#section-fuel" title="Добавить заправку">
            <i data-lucide="fuel"></i>
            <span>Заправка</span>
          </button>
        `;
        
        group.appendChild(quickActions);
        groupedList.appendChild(group);
      });
      
      // Add "Add Car" button at the end
      const addCarBtn = document.createElement('button');
      addCarBtn.className = 'ios-button ios-button-primary';
      addCarBtn.style.cssText = 'width: 100%; margin-top: var(--space-md); padding: var(--space-md);';
      addCarBtn.dataset.goto = 'screen-add-car';
      addCarBtn.innerHTML = `
        <i data-lucide="plus" style="width: 20px; height: 20px; margin-right: 8px;"></i>
        <span>Добавить авто</span>
      `;
      
      // Clear container and add content
      container.innerHTML = '';
      container.appendChild(groupedList);
      container.appendChild(addCarBtn);
      
      console.log('Garage rendered, cars:', state.cars.length, 'button added:', !!addCarBtn);
    }

    // Filter expenses
    function filterExpenses(expenses) {
      let filtered = [...expenses];
      
      // Filter by car
      if(diaryFilters.carId !== 'all') {
        filtered = filtered.filter(e => e.carId === diaryFilters.carId);
      }
      
      // Filter by category
      if(diaryFilters.category !== 'all') {
        filtered = filtered.filter(e => e.category === diaryFilters.category);
      }
      
      // Filter by search
      if(diaryFilters.search) {
        const searchLower = diaryFilters.search.toLowerCase();
        filtered = filtered.filter(e => 
          (e.category && e.category.toLowerCase().includes(searchLower)) ||
          (e.notes && e.notes.toLowerCase().includes(searchLower))
        );
      }
      
      // Filter by time period
      if(diaryFilters.timePeriod !== 'all') {
        const now = new Date();
        filtered = filtered.filter(e => {
          const expDate = new Date(e.date);
          if(diaryFilters.timePeriod === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return expDate >= weekAgo;
          } else if(diaryFilters.timePeriod === 'month') {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return expDate >= monthAgo;
          } else if(diaryFilters.timePeriod === 'year') {
            const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            return expDate >= yearAgo;
          }
          return true;
        });
      }
      
      return filtered;
    }

    // Filter reminders for diary view
    function filterReminders(reminders) {
      let filtered = reminders.filter(r => (r.status || 'active') !== 'done');
      
      // Filter by car
      if(diaryFilters.carId !== 'all') {
        filtered = filtered.filter(r => r.carId === diaryFilters.carId);
      }
      
      // Filter by search
      if(diaryFilters.search) {
        const searchLower = diaryFilters.search.toLowerCase();
        filtered = filtered.filter(r =>
          (r.title && r.title.toLowerCase().includes(searchLower)) ||
          (r.notes && r.notes.toLowerCase().includes(searchLower))
        );
      }
      
      // Filter by time period using dueDate
      if(diaryFilters.timePeriod !== 'all') {
        const now = new Date();
        filtered = filtered.filter(r => {
          if(!r.dueDate) return true;
          const due = new Date(r.dueDate);
          if(diaryFilters.timePeriod === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return due >= weekAgo;
          } else if(diaryFilters.timePeriod === 'month') {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return due >= monthAgo;
          } else if(diaryFilters.timePeriod === 'year') {
            const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            return due >= yearAgo;
          }
          return true;
        });
      }
      return filtered;
    }

    // Get category icon name for Lucide
    function getCategoryIcon(category) {
      if (!category) return 'more-horizontal';
      
      const icons = {
        'Заправка': 'fuel',
        'Электрозарядка': 'zap',
        'Техническое обслуживание': 'wrench',
        'Ремонт и детали': 'tool',
        'Шиномонтаж': 'circle',
        'Уход': 'sparkles',
        'Админ-расходы': 'file-text'
      };
      
      for (const key in icons) {
        if (category.includes(key)) {
          return icons[key];
        }
      }
      return 'more-horizontal';
    }

    // Render diary
    function renderDiary(){
      const container = document.querySelector('#screen-diary');
      if(!container) return;
      
      // Update filter UI
      const timeFilterBtns = container.querySelectorAll('.time-filter button');
      timeFilterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim() === 
          (diaryFilters.timePeriod === 'week' ? 'Неделя' : 
           diaryFilters.timePeriod === 'month' ? 'Месяц' : 
           diaryFilters.timePeriod === 'year' ? 'Год' : 'Все'));
      });
      
      // Populate category filter
      const categorySelect = document.getElementById('diary-category-filter');
      if(categorySelect) {
        const categories = ['Все', ...new Set(state.expenses.map(e => e.category).filter(Boolean))];
        if(categorySelect.options.length === 1) {
          categories.slice(1).forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categorySelect.appendChild(option);
          });
        }
        categorySelect.value = diaryFilters.category === 'all' ? 'all' : diaryFilters.category;
      }
      
      const searchInput = container.querySelector('.filter .search-box input');
      const searchBox = container.querySelector('.filter .search-box');
      const filterContainer = container.querySelector('.filter');
      
      if(searchInput && searchBox && filterContainer) {
        searchInput.value = diaryFilters.search;
        
        // Remove old listeners and add new one with debounce
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        
        let searchTimeout;
        newSearchInput.addEventListener('input', () => {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            diaryFilters.search = newSearchInput.value.trim();
            renderDiary();
          }, 300);
        });
        
        // Expand search box on focus
        newSearchInput.addEventListener('focus', () => {
          searchBox.classList.add('expanded');
          filterContainer.classList.add('search-expanded');
        });
        
        // Collapse search box on blur if empty
        newSearchInput.addEventListener('blur', () => {
          if (!newSearchInput.value.trim()) {
            searchBox.classList.remove('expanded');
            filterContainer.classList.remove('search-expanded');
          }
        });
      }
      
      // Remove existing records, empty messages, and grouped lists
      const existingRecords = container.querySelectorAll('.record');
      existingRecords.forEach(r => r.remove());
      const existingEmpty = container.querySelector('.empty-wrap');
      if(existingEmpty) existingEmpty.remove();
      const existingGroupedList = container.querySelector('.ios-grouped-list');
      if(existingGroupedList) existingGroupedList.remove();
      
      // Filter and sort expenses
      const filtered = filterExpenses(state.expenses);
      const sorted = filtered.sort((a, b) => {
        try {
          const dateA = new Date(a.date + ' ' + (a.time || '00:00'));
          const dateB = new Date(b.date + ' ' + (b.time || '00:00'));
          return dateB - dateA;
        } catch {
          return 0;
        }
      });
      
      // Filter and sort reminders
      const filteredReminders = filterReminders(state.reminders);
      const sortedReminders = filteredReminders.sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate) : new Date(a.createdAt || 0);
        const db = b.dueDate ? new Date(b.dueDate) : new Date(b.createdAt || 0);
        return db - da;
      });
      
      // Calculate and render statistics
      const statsContainer = document.getElementById('diary-stats');
      if(statsContainer) {
        const totalAmount = sorted.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const count = sorted.length;
        
        // Calculate average per day
        let avgPerDay = 0;
        if(sorted.length > 0) {
          const dates = sorted.map(e => e.date).filter(Boolean);
          if(dates.length > 0) {
            const firstDate = new Date(Math.min(...dates.map(d => new Date(d).getTime())));
            const lastDate = new Date(Math.max(...dates.map(d => new Date(d).getTime())));
            const daysDiff = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1);
            avgPerDay = totalAmount / daysDiff;
          }
        }
        
        // Show stats container
        statsContainer.style.display = 'flex';
        
        statsContainer.innerHTML = `
          <div class="diary-stat-item">
            <div class="diary-stat-value">${totalAmount.toLocaleString('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ₴</div>
            <div class="diary-stat-label">Всего</div>
          </div>
          <div class="diary-stat-item">
            <div class="diary-stat-value">${Math.round(avgPerDay).toLocaleString('ru-RU')} ₴</div>
            <div class="diary-stat-label">В день</div>
          </div>
          <div class="diary-stat-item">
            <div class="diary-stat-value">${count}</div>
            <div class="diary-stat-label">${count === 1 ? 'запись' : count < 5 ? 'записи' : 'записей'}</div>
          </div>
        `;
      }
      
      if(sorted.length === 0 && sortedReminders.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-wrap';
        emptyMsg.innerHTML = '<div class="empty-text">Нет расходов и напоминаний</div>';
        container.appendChild(emptyMsg);
        // Hide stats when empty
        if(statsContainer) statsContainer.style.display = 'none';
        return;
      }
      
      // Create iOS Grouped List container
      const groupedList = document.createElement('div');
      groupedList.className = 'ios-grouped-list';
      container.appendChild(groupedList);

      // Render reminders group if present
      if(sortedReminders.length > 0) {
        const group = document.createElement('div');
        group.className = 'ios-group reminder-group';

        const header = document.createElement('div');
        header.className = 'ios-group-header';
        header.textContent = 'Напоминания';
        group.appendChild(header);

        sortedReminders.forEach(rem => {
          const car = state.cars.find(c => c.id === rem.carId);
          const carName = car ? `${car.brand} ${car.model}` : '';
          const dueText = rem.dueDate ? new Date(rem.dueDate).toLocaleDateString('ru-RU', {year:'numeric', month:'short', day:'numeric'}) : 'Без даты';
          const odoText = rem.dueOdometer ? `${rem.dueOdometer} км` : '';

          const cell = document.createElement('div');
          cell.className = 'ios-cell reminder-cell';

          const iconDiv = document.createElement('div');
          iconDiv.className = 'ios-cell-icon reminder-icon';
          iconDiv.innerHTML = `<i data-lucide="bell"></i>`;

          const contentDiv = document.createElement('div');
          contentDiv.className = 'ios-cell-content';
          contentDiv.innerHTML = `
            <div class="ios-cell-title">${escapeHtml(rem.title || 'Напоминание')}</div>
            <div class="ios-cell-subtitle">${carName ? escapeHtml(carName) + ' • ' : ''}${dueText}${odoText ? ' • ' + odoText : ''}</div>
          `;

          const trailingDiv = document.createElement('div');
          trailingDiv.className = 'ios-cell-trailing';

          const actionsDiv = document.createElement('div');
          actionsDiv.className = 'record-actions';
          actionsDiv.style.display = 'none';
          actionsDiv.innerHTML = `
            <button data-done-reminder="${rem.id}" title="Выполнено" class="ios-cell-action-btn ios-cell-action-btn-success">
              <i data-lucide="check"></i>
            </button>
            <button data-postpone-reminder="${rem.id}" title="Перенести" class="ios-cell-action-btn ios-cell-action-btn-warning">
              <i data-lucide="clock"></i>
            </button>
            <button data-edit-reminder="${rem.id}" title="Редактировать" class="ios-cell-action-btn">
              <i data-lucide="pencil"></i>
            </button>
            <button data-delete-reminder="${rem.id}" title="Удалить" class="ios-cell-action-btn ios-cell-action-btn-danger">
              <i data-lucide="trash-2"></i>
            </button>
          `;
          trailingDiv.appendChild(actionsDiv);

          cell.appendChild(iconDiv);
          cell.appendChild(contentDiv);
          cell.appendChild(trailingDiv);

          // Add swipe handler for reminders (same as expenses)
          let startX = 0;
          let currentX = 0;
          let isSwiping = false;
          
          cell.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isSwiping = true;
          });
          
          cell.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            currentX = e.touches[0].clientX - startX;
            if (currentX < -50) {
              cell.style.transform = `translateX(${currentX}px)`;
              actionsDiv.style.display = 'flex';
            } else if (currentX > 0) {
              cell.style.transform = 'translateX(0)';
              actionsDiv.style.display = 'none';
            }
          });
          
          cell.addEventListener('touchend', () => {
            if (currentX < -100) {
              cell.style.transform = 'translateX(-80px)';
              actionsDiv.style.display = 'flex';
            } else {
              cell.style.transform = 'translateX(0)';
              actionsDiv.style.display = 'none';
            }
            isSwiping = false;
          });
          
          // Click to close actions (only if actions are visible)
          cell.addEventListener('click', (e) => {
            const isActionBtn = e.target.closest('.ios-cell-action-btn');
            if (isActionBtn) {
              e.stopPropagation();
              return;
            }
            if (actionsDiv.style.display === 'flex') {
              cell.style.transform = 'translateX(0)';
              actionsDiv.style.display = 'none';
              e.preventDefault();
              e.stopPropagation();
            }
          }, true);

          group.appendChild(cell);
        });

        groupedList.appendChild(group);
      }
      
      // Group expenses by date
      const groupedByDate = {};
      sorted.forEach(exp => {
        const dateKey = exp.date || 'no-date';
        if(!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push(exp);
      });
      
      // Render groups
      Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a)).forEach(dateKey => {
        const group = document.createElement('div');
        group.className = 'ios-group';
        
        const expenses = groupedByDate[dateKey];
        const firstExp = expenses[0];
        const date = new Date(firstExp.date + ' ' + (firstExp.time || '00:00'));
          const dateStr = date.toLocaleDateString('ru-RU', {weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'});
        const dateHeader = date.toLocaleDateString('ru-RU', {year: 'numeric', month: 'long', day: 'numeric'});
        
        // Add group header
        const header = document.createElement('div');
        header.className = 'ios-group-header';
        header.textContent = dateHeader;
        group.appendChild(header);
        
        expenses.forEach(exp => {
          try {
          const amountStr = (exp.amount || 0).toLocaleString('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2});
          const car = state.cars.find(c => c.id === exp.carId);
          const carName = car ? `${car.brand} ${car.model}` : '';
          
          const record = document.createElement('div');
            record.className = 'ios-cell';
          record.dataset.expenseId = exp.id;
          
            const iconDiv = document.createElement('div');
            iconDiv.className = 'ios-cell-icon';
            const iconPath = getCategoryIcon(exp.category);
            iconDiv.innerHTML = `<i data-lucide="${iconPath}"></i>`;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'ios-cell-content';
            const timeStr = exp.time ? ', ' + exp.time.substring(0, 5) : '';
            contentDiv.innerHTML = `
              <div class="ios-cell-title">${escapeHtml(exp.category || 'Расход')}</div>
              <div class="ios-cell-subtitle">${carName ? escapeHtml(carName) + ' • ' : ''}${exp.odometer ? exp.odometer + ' км' : ''}${timeStr}</div>
            `;
            
            const trailingDiv = document.createElement('div');
            trailingDiv.className = 'ios-cell-trailing';
            trailingDiv.innerHTML = `
              <strong style="font-size:var(--font-size-body);font-weight:600;color:var(--text)">${amountStr} ₴</strong>
            `;
          
          const actionsDiv = document.createElement('div');
          actionsDiv.className = 'record-actions';
            actionsDiv.style.display = 'none';
          actionsDiv.innerHTML = `
              <button data-edit-expense="${exp.id}" title="Редактировать" class="ios-cell-action-btn">
                <i data-lucide="pencil"></i>
              </button>
              <button data-delete-expense="${exp.id}" title="Удалить" class="ios-cell-action-btn ios-cell-action-btn-danger">
                <i data-lucide="trash-2"></i>
              </button>
            `;
            
            trailingDiv.appendChild(actionsDiv);
            
            // Add swipe handler
            let startX = 0;
            let currentX = 0;
            let isSwiping = false;
            
            record.addEventListener('touchstart', (e) => {
              startX = e.touches[0].clientX;
              isSwiping = true;
            });
            
            record.addEventListener('touchmove', (e) => {
              if (!isSwiping) return;
              currentX = e.touches[0].clientX - startX;
              if (currentX < -50) {
                record.style.transform = `translateX(${currentX}px)`;
                actionsDiv.style.display = 'flex';
              } else if (currentX > 0) {
                record.style.transform = 'translateX(0)';
                actionsDiv.style.display = 'none';
              }
            });
            
            record.addEventListener('touchend', () => {
              if (currentX < -100) {
                record.style.transform = 'translateX(-80px)';
                actionsDiv.style.display = 'flex';
              } else {
                record.style.transform = 'translateX(0)';
                actionsDiv.style.display = 'none';
              }
              isSwiping = false;
            });
            
            // Click to close actions (only if actions are visible)
            record.addEventListener('click', (e) => {
              const isActionBtn = e.target.closest('.ios-cell-action-btn');
              if (isActionBtn) {
                e.stopPropagation();
                return;
              }
              if (actionsDiv.style.display === 'flex') {
                record.style.transform = 'translateX(0)';
                actionsDiv.style.display = 'none';
                e.preventDefault();
                e.stopPropagation();
              }
            }, true);
            
            record.appendChild(iconDiv);
            record.appendChild(contentDiv);
            record.appendChild(trailingDiv);
            group.appendChild(record);
        } catch(e) {
          console.error('Error rendering expense:', e);
        }
        });
        
        groupedList.appendChild(group);
      });
    }

    // Save car
    function saveCar(form){
      const inputs = form.querySelectorAll('input');
      const brand = inputs[0]?.value?.trim();
      const model = inputs[1]?.value?.trim();
      const year = inputs[2]?.value?.trim();
      
      const selects = form.querySelectorAll('select');
      const fuelSelect = selects[0];
      const fuel = fuelSelect?.value?.trim() || '';
      const fuelValue = fuelSelect?.options[fuelSelect.selectedIndex]?.textContent || fuel;
      
      if(!brand || !model || !year || !fuel){
        showToast('Заполните все обязательные поля');
        return false;
      }
      
      const allInputs = form.querySelectorAll('input');
      const plate = allInputs[3]?.value?.trim() || '';
      const vin = allInputs[4]?.value?.trim() || '';
      const notes = allInputs[5]?.value?.trim() || '';
      const purchasePrice = parseFloat(allInputs[6]?.value || 0);
      const purchaseDate = form.querySelector('input[type="date"]')?.value || '';
      
      const car = {
        id: editingCarId || Date.now().toString(),
        brand,
        model,
        year: parseInt(year),
        fuel: fuelValue,
        plate,
        vin,
        notes,
        purchasePrice,
        purchaseDate
      };
      
      if(editingCarId) {
        const index = state.cars.findIndex(c => c.id === editingCarId);
        if(index !== -1) {
          state.cars[index] = car;
          showToast('Автомобиль обновлен');
        }
        editingCarId = null;
      } else {
        state.cars.push(car);
        showToast('Автомобиль добавлен');
      }
      
      if(!Storage.set('autodiary:cars', state.cars)) {
        return false;
      }
      
      // Reset form
      const allFormInputs = form.querySelectorAll('input');
      allFormInputs.forEach((input) => {
        if (input.type !== 'date') {
          input.value = '';
        } else {
          input.value = '';
        }
      });
      if (fuelSelect) fuelSelect.selectedIndex = 0;
      
      renderGarage();
      return true;
    }

    // Validate odometer
    function validateOdometer(carId, newOdometer) {
      if(!newOdometer || newOdometer === 0) return { valid: true };
      
      const carExpenses = state.expenses.filter(e => e.carId === carId && e.odometer > 0);
      if(carExpenses.length === 0) return { valid: true };
      
      const maxOdometer = Math.max(...carExpenses.map(e => e.odometer));
      if(newOdometer < maxOdometer) {
        return {
          valid: false,
          message: `РџСЂРѕР±РµРі (${newOdometer} РєРј) РјРµРЅСЊС€Рµ РїСЂРµРґС‹РґСѓС‰РµРіРѕ РјР°РєСЃРёРјР°Р»СЊРЅРѕРіРѕ (${maxOdometer} РєРј). РџСЂРѕРґРѕР»Р¶РёС‚СЊ?`
        };
      }
      
      return { valid: true };
    }

    // Save expense
    function saveExpense(form){
      const odometer = parseInt(form.querySelector('#odometer')?.value || 0);
      const amount = parseFloat(form.querySelector('#amount')?.value || 0);
      const date = form.querySelector('#date')?.value;
      const time = form.querySelector('#time')?.value || '';
      const category = document.getElementById('expense-category-value')?.textContent?.trim();
      const notes = form.querySelector('#notes')?.value?.trim() || '';
      const carId = currentCarId || state.cars[0]?.id || '';
      
      if(!amount || !date || category === 'Р’С‹Р±СЂР°С‚СЊ' || !carId){
        showToast('Р—Р°РїРѕР»РЅРёС‚Рµ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹Рµ РїРѕР»СЏ: СЃС‚РѕРёРјРѕСЃС‚СЊ, РґР°С‚Р°, РєР°С‚РµРіРѕСЂРёСЏ');
        return false;
      }
      
      // Validate odometer
      if(odometer > 0) {
        const validation = validateOdometer(carId, odometer);
        if(!validation.valid) {
          showModal('РџСЂРµРґСѓРїСЂРµР¶РґРµРЅРёРµ', validation.message, () => {
            proceedSaveExpense(odometer, amount, date, time, category, notes, carId, form);
          });
          return false;
        }
      }
      
      return proceedSaveExpense(odometer, amount, date, time, category, notes, carId, form);
    }

    function proceedSaveExpense(odometer, amount, date, time, category, notes, carId, form) {
      const expense = {
        id: editingExpenseId || Date.now().toString(),
        carId,
        category,
        amount,
        odometer: odometer || 0,
        date,
        time,
        notes
      };
      
      if(editingExpenseId) {
        const index = state.expenses.findIndex(e => e.id === editingExpenseId);
        if(index !== -1) {
          state.expenses[index] = expense;
          showToast('Р Р°СЃС…РѕРґ РѕР±РЅРѕРІР»РµРЅ');
        }
        editingExpenseId = null;
      } else {
        state.expenses.push(expense);
        showToast('Р Р°СЃС…РѕРґ РґРѕР±Р°РІР»РµРЅ');
      }
      
      if(!Storage.set('autodiary:expenses', state.expenses)) {
        return false;
      }
      
      // Reset form
      form.querySelector('#odometer').value = '';
      form.querySelector('#amount').value = '';
      form.querySelector('#date').value = '';
      form.querySelector('#time').value = '';
      form.querySelector('#notes').value = '';
      const categoryValue = document.getElementById('expense-category-value');
      if(categoryValue) categoryValue.textContent = 'Выбрать';
      const amountSub = document.getElementById('amount-sub');
      if(amountSub) amountSub.textContent = '0,00 ₴';
      
      renderDiary();
      return true;
    }

    // Edit expense
    function editExpense(expenseId) {
      const expense = state.expenses.find(e => e.id === expenseId);
      if(!expense) return;
      
      editingExpenseId = expenseId;
      currentCarId = expense.carId;
      
      const form = document.querySelector('#screen-expense-form');
      if(form) {
        form.querySelector('#odometer').value = expense.odometer || '';
        form.querySelector('#amount').value = expense.amount || '';
        form.querySelector('#date').value = expense.date || '';
        form.querySelector('#time').value = expense.time || '';
        form.querySelector('#notes').value = expense.notes || '';
        document.getElementById('expense-category-value').textContent = expense.category || 'Р’С‹Р±СЂР°С‚СЊ';
        const amountSubEl = document.getElementById('amount-sub');
        if(amountSubEl) amountSubEl.textContent = (expense.amount || 0).toLocaleString('ru-RU', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' ₴';
        
        showView('screen-expense-form');
      }
    }

    // Delete expense
    function deleteExpense(expenseId) {
      const expense = state.expenses.find(e => e.id === expenseId);
      if(!expense) return;
      
      showModal('Удалить расход?', `Вы уверены, что хотите удалить расход "${expense.category}" на ${expense.amount} ₴?`, () => {
        state.expenses = state.expenses.filter(e => e.id !== expenseId);
        if(Storage.set('autodiary:expenses', state.expenses)) {
          showToast('Расход удален');
          renderDiary();
        }
      });
    }

    // Edit car
    function editCar(carId) {
      const car = state.cars.find(c => c.id === carId);
      if(!car) return;
      
      editingCarId = carId;
      const form = document.querySelector('#screen-add-car');
      if(form) {
        const inputs = form.querySelectorAll('input');
        if(inputs[0]) inputs[0].value = car.brand || '';
        if(inputs[1]) inputs[1].value = car.model || '';
        if(inputs[2]) inputs[2].value = car.year || '';
        const fuelSelect = form.querySelector('select');
        if(fuelSelect) {
          const options = Array.from(fuelSelect.options);
          const fuelIndex = options.findIndex(opt => opt.textContent === car.fuel);
          if(fuelIndex >= 0) fuelSelect.selectedIndex = fuelIndex;
        }
        if(inputs[3]) inputs[3].value = car.plate || '';
        if(inputs[4]) inputs[4].value = car.vin || '';
        if(inputs[5]) inputs[5].value = car.notes || '';
        if(inputs[6]) inputs[6].value = car.purchasePrice || '';
        const dateInput = form.querySelector('input[type="date"]');
        if(dateInput) dateInput.value = car.purchaseDate || '';
        
        showView('screen-add-car');
      }
    }

    // Delete car
    function deleteCar(carId) {
      const car = state.cars.find(c => c.id === carId);
      if(!car) return;
      
      const expensesCount = state.expenses.filter(e => e.carId === carId).length;
      
      showModal('РЈРґР°Р»РёС‚СЊ Р°РІС‚РѕРјРѕР±РёР»СЊ?', `Р’С‹ СѓРІРµСЂРµРЅС‹, С‡С‚Рѕ С…РѕС‚РёС‚Рµ СѓРґР°Р»РёС‚СЊ "${car.brand} ${car.model}"? Р’СЃРµ СЃРІСЏР·Р°РЅРЅС‹Рµ СЂР°СЃС…РѕРґС‹ (${expensesCount}) С‚Р°РєР¶Рµ Р±СѓРґСѓС‚ СѓРґР°Р»РµРЅС‹.`, () => {
        state.cars = state.cars.filter(c => c.id !== carId);
        state.expenses = state.expenses.filter(e => e.carId !== carId);
        delete state.maintenance[carId];
        delete state.intervals[carId];
        
        if(Storage.set('autodiary:cars', state.cars) && 
           Storage.set('autodiary:expenses', state.expenses) &&
           Storage.set('autodiary:maintenance', state.maintenance) &&
           Storage.set('autodiary:intervals', state.intervals)) {
          showToast('РђРІС‚РѕРјРѕР±РёР»СЊ СѓРґР°Р»РµРЅ');
          renderGarage();
          if(currentCarId === carId) {
            currentCarId = null;
            showView('screen-garage');
          }
        }
      });
    }

    // Save maintenance
    function saveMaintenance(carId){
      const section = document.querySelector('#screen-car-details');
      if(!section) return;
      
      const maintenance = {};
      section.querySelectorAll('.section').forEach(sec => {
        sec.querySelectorAll('.field').forEach(field => {
          const label = field.querySelector('label')?.textContent?.trim();
          if(!label) return;
          const inputs = field.querySelectorAll('input');
          if(inputs.length === 2){
            const odometer = inputs[0].value ? parseInt(inputs[0].value) : null;
            const date = inputs[1].value || null;
            if(odometer || date){
              maintenance[label] = {odometer, date};
            }
          }
        });
      });
      
      state.maintenance[carId] = maintenance;
      Storage.set('autodiary:maintenance', state.maintenance);
      return true;
    }

    // Save intervals
    function saveIntervals(carId){
      const section = document.querySelector('#screen-car-settings');
      if(!section) return;
      
      const intervals = {};
      section.querySelectorAll('.section').forEach(sec => {
        sec.querySelectorAll('.field').forEach(field => {
          const label = field.querySelector('label')?.textContent?.trim();
          if(!label) return;
          const inputs = field.querySelectorAll('input');
          if(inputs.length === 2){
            const km = inputs[0].value ? parseInt(inputs[0].value) : null;
            const months = inputs[1].value ? parseInt(inputs[1].value) : null;
            if(km || months){
              intervals[label] = {km, months};
            }
          }
        });
      });
      
      state.intervals[carId] = intervals;
      Storage.set('autodiary:intervals', state.intervals);
      return true;
    }

    // Load car details
    function loadCarDetails(carId){
      const car = state.cars.find(c => c.id === carId);
      if(!car) return;
      
      currentCarId = carId;
      const name = `${car.brand} ${car.model}`;
      const sub = `${car.year} вЂў ${car.fuel}`;
      
      document.getElementById('car-name').textContent = name;
      document.getElementById('car-sub-line').textContent = sub;
      document.getElementById('car-name-settings').textContent = 'РРЅС‚РµСЂРІР°Р»С‹ РўРћ вЂ” ' + name;
      document.getElementById('car-sub-settings').textContent = sub;
      
      // Load maintenance data
      const maint = state.maintenance[carId] || {};
      const section = document.querySelector('#screen-car-details');
      if(section){
        section.querySelectorAll('.field').forEach(field => {
          const label = field.querySelector('label')?.textContent?.trim();
          if(maint[label]){
            const inputs = field.querySelectorAll('input');
            if(inputs[0] && maint[label].odometer) inputs[0].value = maint[label].odometer;
            if(inputs[1] && maint[label].date) inputs[1].value = maint[label].date;
          }
        });
      }
      
      // Load intervals
      const intervals = state.intervals[carId] || {};
      const intervalSection = document.querySelector('#screen-car-settings');
      if(intervalSection){
        intervalSection.querySelectorAll('.field').forEach(field => {
          const label = field.querySelector('label')?.textContent?.trim();
          if(intervals[label]){
            const inputs = field.querySelectorAll('input');
            if(inputs[0] && intervals[label].km) inputs[0].value = intervals[label].km;
            if(inputs[1] && intervals[label].months) inputs[1].value = intervals[label].months;
          }
        });
      }
      
      // Update metrics
      const metrics = calculateCarMetrics(carId);
      document.getElementById('md1').textContent = metrics.fuelConsumption || '0';
      document.getElementById('md2').textContent = metrics.costPerKm || '0';
      document.getElementById('md3').textContent = metrics.avgDay || '0';
    }

    // Reminders functions
    function renderReminders() {
      const container = document.getElementById('reminders-list');
      if(!container) return;
      
      container.innerHTML = '';
      
      if(state.reminders.length === 0) {
        container.innerHTML = '<div class="empty-text">РќРµС‚ РЅР°РїРѕРјРёРЅР°РЅРёР№</div>';
        return;
      }
      
      state.reminders.forEach(reminder => {
        const car = state.cars.find(c => c.id === reminder.carId);
        const reminderDiv = document.createElement('div');
        reminderDiv.className = 'section';
        reminderDiv.style.marginBottom = '12px';
        
        const isOverdue = reminder.dueDate && new Date(reminder.dueDate) < new Date();
        const status = reminder.status || 'active';
        
        reminderDiv.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
            <div>
              <strong>${escapeHtml(reminder.title)}</strong>
              <div style="font-size:12px;color:#888;margin-top:4px">
                ${car ? escapeHtml(car.brand + ' ' + car.model) : ''}
                ${reminder.dueDate ? ' вЂў ' + new Date(reminder.dueDate).toLocaleDateString('ru-RU') : ''}
                ${reminder.dueOdometer ? ' вЂў ' + reminder.dueOdometer + ' РєРј' : ''}
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn" style="background:#333;padding:6px 12px;font-size:12px" data-edit-reminder="${reminder.id}">вњЏпёЏ</button>
              <button class="btn btn-danger" style="padding:6px 12px;font-size:12px" data-delete-reminder="${reminder.id}">рџ—‘пёЏ</button>
            </div>
          </div>
          ${reminder.notes ? '<div style="font-size:13px;color:#aaa;margin-top:8px">' + escapeHtml(reminder.notes) + '</div>' : ''}
          ${isOverdue && status === 'active' ? '<div style="color:var(--danger);font-size:12px;margin-top:8px">РџСЂРѕСЃСЂРѕС‡РµРЅРѕ</div>' : ''}
        `;
        
        container.appendChild(reminderDiv);
      });
    }

    function populateReminderCarSelect() {
      const select = document.getElementById('reminder-car');
      if(!select) return;
      
      select.innerHTML = '<option value="">Р’С‹Р±РµСЂРёС‚Рµ Р°РІС‚Рѕ</option>';
      state.cars.forEach(car => {
        const option = document.createElement('option');
        option.value = car.id;
        option.textContent = `${car.brand} ${car.model}`;
        if(editingReminderId) {
          const reminder = state.reminders.find(r => r.id === editingReminderId);
          if(reminder && reminder.carId === car.id) {
            option.selected = true;
          }
        }
        select.appendChild(option);
      });
    }

    function saveReminder() {
      const title = document.getElementById('reminder-title')?.value?.trim();
      const carId = document.getElementById('reminder-car')?.value;
      const date = document.getElementById('reminder-date')?.value;
      const odometer = parseInt(document.getElementById('reminder-odometer')?.value || 0);
      const notes = document.getElementById('reminder-notes')?.value?.trim() || '';
      
      if(!title || !carId) {
        showToast('Р—Р°РїРѕР»РЅРёС‚Рµ РЅР°Р·РІР°РЅРёРµ Рё РІС‹Р±РµСЂРёС‚Рµ Р°РІС‚РѕРјРѕР±РёР»СЊ');
        return;
      }
      
      const reminder = {
        id: editingReminderId || Date.now().toString(),
        carId,
        title,
        dueDate: date || null,
        dueOdometer: odometer || null,
        notes,
        status: 'active',
        createdAt: editingReminderId ? state.reminders.find(r => r.id === editingReminderId)?.createdAt || new Date().toISOString() : new Date().toISOString()
      };
      
      if(editingReminderId) {
        const index = state.reminders.findIndex(r => r.id === editingReminderId);
        if(index !== -1) {
          state.reminders[index] = reminder;
          showToast('РќР°РїРѕРјРёРЅР°РЅРёРµ РѕР±РЅРѕРІР»РµРЅРѕ');
        }
        editingReminderId = null;
      } else {
        state.reminders.push(reminder);
        showToast('РќР°РїРѕРјРёРЅР°РЅРёРµ РґРѕР±Р°РІР»РµРЅРѕ');
      }
      
      if(Storage.set('autodiary:reminders', state.reminders)) {
        showView('screen-reminders');
        renderReminders();
      }
    }

    function deleteReminder(reminderId) {
      const reminder = state.reminders.find(r => r.id === reminderId);
      if(!reminder) return;
      
      showModal('Удалить напоминание?', `Вы уверены, что хотите удалить напоминание "${reminder.title}"?`, () => {
        state.reminders = state.reminders.filter(r => r.id !== reminderId);
        if(Storage.set('autodiary:reminders', state.reminders)) {
          showToast('Напоминание удалено');
          renderReminders();
          renderDiary();
        }
      });
    }

    function markReminderDone(reminderId) {
      const reminder = state.reminders.find(r => r.id === reminderId);
      if(!reminder) return;
      
      reminder.status = 'done';
      if(Storage.set('autodiary:reminders', state.reminders)) {
        showToast('Напоминание отмечено как выполненное');
        renderReminders();
        renderDiary();
      }
    }

    function postponeReminder(reminderId) {
      const reminder = state.reminders.find(r => r.id === reminderId);
      if(!reminder) return;
      
      // Postpone by 1 week
      if(reminder.dueDate) {
        const currentDate = new Date(reminder.dueDate);
        currentDate.setDate(currentDate.getDate() + 7);
        reminder.dueDate = currentDate.toISOString().split('T')[0];
      } else {
        // If no date, set to 1 week from now
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        reminder.dueDate = nextWeek.toISOString().split('T')[0];
      }
      
      if(Storage.set('autodiary:reminders', state.reminders)) {
        showToast('Напоминание перенесено на неделю');
        renderReminders();
        renderDiary();
      }
    }

    // Export functions
    function exportCSV() {
      const headers = ['Р”Р°С‚Р°', 'Р’СЂРµРјСЏ', 'РђРІС‚РѕРјРѕР±РёР»СЊ', 'РљР°С‚РµРіРѕСЂРёСЏ', 'РЎСѓРјРјР°', 'РџСЂРѕР±РµРі', 'Р—Р°РјРµС‚РєРё'];
      const rows = state.expenses.map(exp => {
        const car = state.cars.find(c => c.id === exp.carId);
        const carName = car ? `${car.brand} ${car.model}` : '';
        return [
          exp.date || '',
          exp.time || '',
          carName,
          exp.category || '',
          exp.amount || 0,
          exp.odometer || 0,
          (exp.notes || '').replace(/"/g, '""')
        ];
      });
      
      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `autodiary_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      showToast('CSV СЌРєСЃРїРѕСЂС‚РёСЂРѕРІР°РЅ');
    }

    function exportJSON() {
      const data = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        cars: state.cars,
        expenses: state.expenses,
        maintenance: state.maintenance,
        intervals: state.intervals,
        reminders: state.reminders
      };
      
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `autodiary_backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      showToast('JSON СЌРєСЃРїРѕСЂС‚РёСЂРѕРІР°РЅ');
    }

    function importJSON() {
      const input = document.getElementById('import-file-input');
      if(input) {
        input.click();
        input.onchange = (e) => {
          const file = e.target.files[0];
          if(!file) return;
          
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const data = JSON.parse(event.target.result);
              
              if(data.cars) state.cars = data.cars;
              if(data.expenses) state.expenses = data.expenses;
              if(data.maintenance) state.maintenance = data.maintenance;
              if(data.intervals) state.intervals = data.intervals;
              if(data.reminders) state.reminders = data.reminders;
              
              Storage.set('autodiary:cars', state.cars);
              Storage.set('autodiary:expenses', state.expenses);
              Storage.set('autodiary:maintenance', state.maintenance);
              Storage.set('autodiary:intervals', state.intervals);
              Storage.set('autodiary:reminders', state.reminders);
              
              showToast('Р”Р°РЅРЅС‹Рµ РёРјРїРѕСЂС‚РёСЂРѕРІР°РЅС‹');
              renderGarage();
              renderDiary();
              renderReminders();
            } catch(e) {
              showToast('РћС€РёР±РєР° РёРјРїРѕСЂС‚Р°: РЅРµРІРµСЂРЅС‹Р№ С„РѕСЂРјР°С‚ С„Р°Р№Р»Р°');
              console.error(e);
            }
          };
          reader.readAsText(file);
        };
      }
    }

    // Unified click event handler to prevent conflicts
    document.body.addEventListener('click', e => {
      // Check for data-goto navigation first
      const nav = e.target.closest('[data-goto]');
      if(nav){
        e.preventDefault();
        e.stopPropagation();
        
        const id = nav.dataset.goto;
        const carId = nav.dataset.carId;
        if(carId) currentCarId = carId;
        
        // Reset editing states
        editingExpenseId = null;
        editingCarId = null;
        editingReminderId = null;
        
        // Handle save buttons
        const btn = nav.closest('button[data-goto]');
        if(btn){
          const form = btn.closest('section');
          if(form){
            if(id === 'screen-garage' && form.id === 'screen-add-car'){
              if(saveCar(form)){
                showView('screen-garage');
              }
              return;
            } else if(id === 'screen-diary' && form.id === 'screen-expense-form'){
              if(saveExpense(form)){
                showView('screen-diary');
              }
              return;
            } else if(id === 'screen-garage' && form.id === 'screen-car-details'){
              if(currentCarId){
                saveMaintenance(currentCarId);
                showView('screen-garage');
              }
              return;
            } else if(id === 'screen-car-details' && form.id === 'screen-car-settings'){
              if(currentCarId){
                saveIntervals(currentCarId);
                showView('screen-car-details');
              }
              return;
            }
          }
        }
        
        // Reset form if navigating to add screens
        if(id === 'screen-add-car') {
          const form = document.querySelector('#screen-add-car');
          if(form) {
            const inputs = form.querySelectorAll('input');
            inputs.forEach(input => {
              if(input.type !== 'date') input.value = '';
            });
            const dateInput = form.querySelector('input[type="date"]');
            if(dateInput) dateInput.value = '';
            const fuelSelect = form.querySelector('select');
            if(fuelSelect) fuelSelect.selectedIndex = 0;
          }
        } else if(id === 'screen-add-reminder') {
          const titleEl = document.getElementById('reminder-title');
          const dateEl = document.getElementById('reminder-date');
          const odometerEl = document.getElementById('reminder-odometer');
          const notesEl = document.getElementById('reminder-notes');
          if(titleEl) titleEl.value = '';
          if(dateEl) dateEl.value = '';
          if(odometerEl) odometerEl.value = '';
          if(notesEl) notesEl.value = '';
          populateReminderCarSelect();
        }
        
        // Regular navigation
        showView(id);
        const hash = nav.dataset.scroll;
        if(hash && id === 'screen-add-expense'){
          setTimeout(() => {
            const el = document.querySelector(hash);
            if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
          }, 60);
        }
        return;
      }

    // Category selection
      const item = e.target.closest('.item[data-category]');
      if(item){
        e.preventDefault();
        e.stopPropagation();
        const val = item.dataset.category || item.querySelector('label')?.textContent?.trim();
        const target = document.getElementById('expense-category-value');
        if(val && target){
          target.textContent = val;
        }
        showView('screen-expense-form');
        return;
      }
      
      // Car card click (only if not a button)
      const card = e.target.closest('.car-card');
      const ignoreInside = e.target.closest('[data-ignore-click]') || e.target.closest('button') || e.target.closest('[data-goto]');
      if(card && !ignoreInside){
        e.preventDefault();
        e.stopPropagation();
        const carId = card.dataset.carId;
        if(carId){
          loadCarDetails(carId);
          showView('screen-car-details');
        }
        return;
      }
    });

    // Filter handlers
    document.addEventListener('click', (e) => {
      // Time filter buttons
      const timeBtn = e.target.closest('.time-filter button');
      if(timeBtn) {
        e.stopPropagation();
        const text = timeBtn.textContent.trim();
        diaryFilters.timePeriod = text === 'Неделя' ? 'week' : text === 'Месяц' ? 'month' : text === 'Год' ? 'year' : 'all';
        renderDiary();
        return;
      }
      
      // Category filter
      const categorySelect = e.target.closest('#diary-category-filter');
      if(categorySelect) {
        e.stopPropagation();
        diaryFilters.category = categorySelect.value === 'all' ? 'all' : categorySelect.value;
        renderDiary();
        return;
      }
    });

    // Edit/Delete expense handlers
    document.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit-expense]');
      if(editBtn) {
        e.preventDefault();
        e.stopPropagation();
        editExpense(editBtn.dataset.editExpense);
        return;
      }
      
      const deleteBtn = e.target.closest('[data-delete-expense]');
      if(deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        deleteExpense(deleteBtn.dataset.deleteExpense);
        return;
      }
      
      const editCarBtn = e.target.closest('[data-edit-car]');
      if(editCarBtn) {
        e.preventDefault();
        e.stopPropagation();
        editCar(editCarBtn.dataset.editCar);
        return;
      }
      
      const deleteCarBtn = e.target.closest('[data-delete-car]');
      if(deleteCarBtn) {
        e.preventDefault();
        e.stopPropagation();
        deleteCar(deleteCarBtn.dataset.deleteCar);
        return;
      }
      
      const editReminderBtn = e.target.closest('[data-edit-reminder]');
      if(editReminderBtn) {
        e.preventDefault();
        e.stopPropagation();
        editingReminderId = editReminderBtn.dataset.editReminder;
        const reminder = state.reminders.find(r => r.id === editingReminderId);
        if(reminder) {
          document.getElementById('reminder-title').value = reminder.title || '';
          document.getElementById('reminder-date').value = reminder.dueDate || '';
          document.getElementById('reminder-odometer').value = reminder.dueOdometer || '';
          document.getElementById('reminder-notes').value = reminder.notes || '';
          populateReminderCarSelect();
          showView('screen-add-reminder');
        }
        return;
      }
      
      const deleteReminderBtn = e.target.closest('[data-delete-reminder]');
      if(deleteReminderBtn) {
        e.preventDefault();
        e.stopPropagation();
        deleteReminder(deleteReminderBtn.dataset.deleteReminder);
        return;
      }
      
      const doneReminderBtn = e.target.closest('[data-done-reminder]');
      if(doneReminderBtn) {
        e.preventDefault();
        e.stopPropagation();
        markReminderDone(doneReminderBtn.dataset.doneReminder);
        return;
      }
      
      const postponeReminderBtn = e.target.closest('[data-postpone-reminder]');
      if(postponeReminderBtn) {
        e.preventDefault();
        e.stopPropagation();
        postponeReminder(postponeReminderBtn.dataset.postponeReminder);
        return;
      }
    });

    // Export handlers
    document.addEventListener('click', (e) => {
      if(e.target.id === 'export-csv-btn') {
        e.preventDefault();
        e.stopPropagation();
        exportCSV();
      } else if(e.target.id === 'export-json-btn') {
        e.preventDefault();
        e.stopPropagation();
        exportJSON();
      } else if(e.target.id === 'import-json-btn') {
        e.preventDefault();
        e.stopPropagation();
        importJSON();
      } else if(e.target.id === 'save-reminder-btn') {
        e.preventDefault();
        e.stopPropagation();
        saveReminder();
      }
    });

    // Settings handlers
    // Initialize theme from storage or default to light
    function initTheme() {
      const savedTheme = Storage.get('autodiary:theme', null);
      if(savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else {
        // Default to light theme
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
    
    // Toggle theme
    function toggleTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      Storage.set('autodiary:theme', newTheme);
      return newTheme;
    }
    
    // Generate demo data
    function generateDemoData() {
      const demoCars = [
        {id: 'demo-1', brand: 'Volkswagen', model: 'Golf VII', year: 2018, fuel: 'Бензин', plate: 'АА1234ВВ', vin: '', notes: 'Основной автомобиль', purchasePrice: 15000, purchaseDate: '2018-05-15'},
        {id: 'demo-2', brand: 'Tesla', model: 'Model 3', year: 2022, fuel: 'Электро', plate: 'ВВ5678СС', vin: '', notes: 'Электромобиль', purchasePrice: 35000, purchaseDate: '2022-03-20'}
      ];
      
      const categories = ['Заправка', 'Зарядка', 'ТО', 'Ремонт', 'Шины', 'Уход', 'Админ', 'Другое'];
      const demoExpenses = [];
      const demoReminders = [];
      
      // Generate expenses for the last 3 months
      const now = new Date();
      const car1Id = demoCars[0].id;
      const car2Id = demoCars[1].id;
      
      // Car 1 expenses
      for(let i = 0; i < 15; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - Math.floor(Math.random() * 90));
        const category = categories[Math.floor(Math.random() * categories.length)];
        const amount = category === 'Заправка' ? 800 + Math.random() * 400 : 
                      category === 'ТО' ? 2000 + Math.random() * 3000 :
                      category === 'Ремонт' ? 1500 + Math.random() * 5000 :
                      category === 'Шины' ? 3000 + Math.random() * 2000 :
                      200 + Math.random() * 800;
        
        demoExpenses.push({
          id: 'demo-exp-' + i,
          carId: car1Id,
          category: category,
          amount: Math.round(amount),
          odometer: 50000 + i * 500 + Math.floor(Math.random() * 300),
          date: date.toISOString().split('T')[0],
          time: '',
          notes: category === 'Заправка' ? 'Полный бак' : ''
        });
      }
      
      // Car 2 expenses
      for(let i = 0; i < 10; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - Math.floor(Math.random() * 90));
        const category = categories[Math.floor(Math.random() * categories.length)];
        const amount = category === 'Зарядка' ? 200 + Math.random() * 150 :
                      category === 'ТО' ? 1500 + Math.random() * 2000 :
                      300 + Math.random() * 500;
        
        demoExpenses.push({
          id: 'demo-exp-car2-' + i,
          carId: car2Id,
          category: category,
          amount: Math.round(amount),
          odometer: 10000 + i * 300 + Math.floor(Math.random() * 200),
          date: date.toISOString().split('T')[0],
          time: '',
          notes: ''
        });
      }
      
      // Demo reminders
      demoReminders.push(
        {
          id: 'demo-rem-1',
          carId: car1Id,
          title: 'Замена масла',
          dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14).toISOString().split('T')[0],
          dueOdometer: 52000,
          notes: 'СТО "АвтоСервис", ул. Героев 12',
          status: 'active',
          createdAt: new Date().toISOString()
        },
        {
          id: 'demo-rem-2',
          carId: car1Id,
          title: 'Купить антифриз',
          dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3).toISOString().split('T')[0],
          dueOdometer: null,
          notes: 'Магазин "Автохимия", пр. Победы 45',
          status: 'active',
          createdAt: new Date().toISOString()
        },
        {
          id: 'demo-rem-3',
          carId: car2Id,
          title: 'Заменить резину',
          dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30).toISOString().split('T')[0],
          dueOdometer: 12000,
          notes: 'Шиномонтаж "FastTire", ул. Центральная 5',
          status: 'active',
          createdAt: new Date().toISOString()
        }
      );
      
      // Check for existing demo cars to avoid duplicates
      const existingDemoIds = state.cars.map(c => c.id);
      const newDemoCars = demoCars.filter(c => !existingDemoIds.includes(c.id));
      
      if(newDemoCars.length === 0 && demoReminders.length === 0) {
        showToast('Демо данные уже добавлены', 3000);
        return;
      }
      
      // Add demo cars, expenses, reminders to state
      state.cars = [...state.cars, ...newDemoCars];
      state.expenses = [...state.expenses, ...demoExpenses];
      state.reminders = [...state.reminders, ...demoReminders];
      
      // Save to storage
      const carsSaved = Storage.set('autodiary:cars', state.cars);
      const expensesSaved = Storage.set('autodiary:expenses', state.expenses);
      const remindersSaved = Storage.set('autodiary:reminders', state.reminders);
      
      if(!carsSaved || !expensesSaved || !remindersSaved) {
        showToast('Ошибка сохранения данных', 3000);
        return;
      }
      
      // Reload state from storage to ensure consistency
      state.cars = Storage.get('autodiary:cars', []);
      state.expenses = Storage.get('autodiary:expenses', []);
      state.reminders = Storage.get('autodiary:reminders', []);
      
      showToast(`Демо данные добавлены: ${newDemoCars.length} авто, ${demoExpenses.length} расходов, ${demoReminders.length} напоминаний`, 3000);
      
      // Refresh views
      refreshSettingsScreen();
      renderDiary();
      renderGarage();
      renderReminders();
      
      // Switch to garage view if cars were added
      if(state.cars.length > 0) {
        showView('screen-garage');
      }
    }
    
    function refreshSettingsScreen(){
      const carsCount = state.cars.length;
      const categories = new Set(state.expenses.map(e => e.category)).size;
      const elCars = document.getElementById('set-cars-count');
      const elCats = document.getElementById('set-cats-count');
      if(elCars) elCars.textContent = String(carsCount);
      if(elCats) elCats.textContent = categories > 0 ? String(categories) : '—';

      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const color = Storage.get('autodiary:color', 'blue');

      const themeBtn = document.getElementById('set-theme');
      const colorBtn = document.getElementById('set-color');
      const colorDot = document.getElementById('set-color-dot');

      if(themeBtn) themeBtn.textContent = currentTheme === 'light' ? 'Светлая' : 'Тёмная';
      if(colorBtn) colorBtn.textContent = color === 'blue' ? 'Синий' : color;
      if(colorDot) colorDot.style.background = color === 'blue' ? '#0A84FF' : color;
    }

    document.addEventListener('click', (e)=>{
      if(e.target && e.target.id === 'set-theme'){
        const newTheme = toggleTheme();
        refreshSettingsScreen();
        showToast(newTheme === 'light' ? 'Светлая тема' : 'Тёмная тема');
      }
      if(e.target && e.target.id === 'set-color'){
        const cur = Storage.get('autodiary:color', 'blue');
        const pool = ['blue','#00ff9c','#f59e0b','#ef4444'];
        const next = pool[(pool.indexOf(cur)+1)%pool.length];
        Storage.set('autodiary:color', next);
        refreshSettingsScreen();
      }
      const demoBtn = e.target.closest('#add-demo-data-btn');
      if(demoBtn){
        e.preventDefault();
        e.stopPropagation();
        showModal('Добавить демо данные?', 'Будут добавлены 2 автомобиля и несколько десятков записей расходов за последние 3 месяца. Существующие данные не будут удалены.', () => {
          generateDemoData();
        });
      }
    });
    
    // Initialize theme on load
    initTheme();
    
    // Initialize demo data button
    document.addEventListener('DOMContentLoaded', () => {
      const demoBtn = document.getElementById('add-demo-data-btn');
      if(demoBtn) {
        demoBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          showModal('Добавить демо данные?', 'Будут добавлены 2 автомобиля и несколько десятков записей расходов за последние 3 месяца. Существующие данные не будут удалены.', () => {
            generateDemoData();
          });
        });
      }
    });
    
    // Also handle click event delegation (fallback)
    const demoBtn = document.getElementById('add-demo-data-btn');
    if(demoBtn) {
      demoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showModal('Добавить демо данные?', 'Будут добавлены 2 автомобиля и несколько десятков записей расходов за последние 3 месяца. Существующие данные не будут удалены.', () => {
          generateDemoData();
        });
      });
    }

    // Reset editing states when navigating away - handled in main click handler
    
    // Initialize app when DOM is ready
    function initApp() {
      // Initialize views and tabs
      views = [...document.querySelectorAll('.view')];
      tabs = [...document.querySelectorAll('.tab')];
      
    // Set default date
    const dateInput = document.querySelector('#screen-expense-form #date');
    if(dateInput && !dateInput.value){
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
    }
    
      // Initialize amount formatting
      const amountInput = document.getElementById('amount');
      const amountSub = document.getElementById('amount-sub');
      if(amountInput && amountSub){
        amountInput.addEventListener('input',()=>{
          const v = amountInput.value || '0';
          const formatted = Number(v).toLocaleString('ru-RU', {minimumFractionDigits:2, maximumFractionDigits:2});
          amountSub.textContent = formatted + ' ₴';
        });
      }
      
      // Initialize expense category sheet handlers
      const expenseCategorySheet = document.getElementById('expense-category-sheet');
      const diaryAddBtn = document.getElementById('diary-add-btn');
      
      if(diaryAddBtn) {
        diaryAddBtn.addEventListener('click', () => {
          if(expenseCategorySheet) {
            expenseCategorySheet.classList.add('active');
          }
        });
      }
      
      // Close sheet on overlay click
      if(expenseCategorySheet) {
        expenseCategorySheet.addEventListener('click', (e) => {
          if(e.target === expenseCategorySheet) {
            expenseCategorySheet.classList.remove('active');
          }
        });
        
        // Handle category selection
        expenseCategorySheet.addEventListener('click', (e) => {
          const categoryItem = e.target.closest('.expense-category-item');
          if(!categoryItem) return;
          
          // Quick path for reminder
          if(categoryItem.dataset.reminder === 'true') {
            expenseCategorySheet.classList.remove('active');
            showView('screen-add-reminder');
            return;
          }
          
          const category = categoryItem.dataset.category;
          const scrollTo = categoryItem.dataset.scroll;
          
          // Set category in form
          const categoryValue = document.getElementById('expense-category-value');
          if(categoryValue) {
            categoryValue.textContent = category;
          }
          
          // Close sheet
          expenseCategorySheet.classList.remove('active');
          
          // Open expense form
          showView('screen-expense-form');
          
          // Scroll to specific section if needed (for fuel)
          if(scrollTo) {
            setTimeout(() => {
              const section = document.querySelector(scrollTo);
              if(section) {
                section.scrollIntoView({behavior: 'smooth', block: 'start'});
              }
            }, 300);
          }
        });
      }
    
    // Initial render
    renderGarage();
    renderDiary();
    renderReminders();
    showView('screen-diary');
    
      // Initialize Lucide icons once (render functions also call createIcons as needed)
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
