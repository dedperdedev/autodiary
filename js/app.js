    // Modules are loaded via script tags in HTML
    // Storage, SoftDelete, Fuel, Service are now global

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
    
    // Show date range picker bottom sheet
    function showDateRangePicker(filters) {
      const sheet = document.createElement('div');
      sheet.className = 'ios-sheet-overlay';
      sheet.id = 'date-range-picker-sheet';
      
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const yearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
      
      sheet.innerHTML = `
        <div class="ios-sheet">
          <div class="ios-sheet-header">
            <h2>Период</h2>
            <button class="ios-sheet-close" data-close-sheet>
              <i data-lucide="x"></i>
            </button>
          </div>
          <div class="ios-sheet-content">
            <div class="ios-grouped-list">
              <div class="ios-group">
                <div class="ios-cell" data-select-period="month">
                  <div class="ios-cell-content">
                    <div class="ios-cell-title">Месяц</div>
                  </div>
                </div>
                <div class="ios-cell" data-select-period="quarter">
                  <div class="ios-cell-content">
                    <div class="ios-cell-title">Квартал</div>
                  </div>
                </div>
                <div class="ios-cell" data-select-period="year">
                  <div class="ios-cell-content">
                    <div class="ios-cell-title">Год</div>
                  </div>
                </div>
                <div class="ios-cell" data-select-period="all">
                  <div class="ios-cell-content">
                    <div class="ios-cell-title">Все время</div>
                  </div>
                </div>
              </div>
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
      sheet.querySelectorAll('[data-select-period]').forEach(cell => {
        cell.addEventListener('click', () => {
          const period = cell.dataset.selectPeriod;
          filters.timePeriod = period;
          sheet.remove();
          renderDiary();
        });
      });
    }

    // Compatibility wrapper for old Storage API (autodiary:key format)
    const StorageCompat = {
      get(key, def = []) {
        // Remove 'autodiary:' prefix if present for new Storage API
        const cleanKey = key.replace('autodiary:', '');
        if (typeof Storage !== 'undefined' && Storage.get) {
          return Storage.get(cleanKey, def);
        }
        // Fallback to direct localStorage
        try {
          const item = localStorage.getItem(key);
          return item ? JSON.parse(item) : def;
        } catch (e) {
          return def;
        }
      },
      set(key, value) {
        const cleanKey = key.replace('autodiary:', '');
        if (typeof Storage !== 'undefined' && Storage.set) {
          const result = Storage.set(cleanKey, value);
          if (result && result.error) {
            showToast(result.message || 'Ошибка сохранения', 3000);
            return false;
          }
          return true;
        }
        // Fallback to direct localStorage
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (e) {
          showToast('Ошибка сохранения', 3000);
          return false;
        }
      }
    };

    // State
    let currentCarId = null;
    let editingExpenseId = null;
    let editingCarId = null;
    let editingReminderId = null;
    let editingFuelId = null;
    let editingServiceId = null;
    // Initialize diary filters using Diary module
    let diaryFilters = typeof Diary !== 'undefined' && Diary.initFilters ? 
      Diary.initFilters() : {
        timePeriod: 'month',
        category: 'all',
        carId: '__all__'
      };

    // Initialize state with migration support
    let state = {
      cars: [],
      expenses: [],
      maintenance: {},
      intervals: {},
      reminders: [],
      fuel: [],
      service: [],
      categories: [],
      subcategories: [],
      templates: [],
      recurringRules: [],
      settings: {
        units: { distance: 'km', fuel: 'L/100km', currency: '₴' },
        darkMode: false,
        autoBackup: false
      }
    };

    // Show recovery screen for corrupted data
    function showRecoveryScreen(errorData) {
      // Show recovery screen (use setTimeout to ensure showView is defined)
      setTimeout(() => {
        if (typeof showView === 'function') {
          showView('screen-recovery');
        } else {
          // Fallback: manually show the screen
          const recoveryScreen = document.getElementById('screen-recovery');
          if (recoveryScreen) {
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            recoveryScreen.classList.add('active');
          }
        }
      }, 0);
      
      // Display error message if available
      const errorMsg = document.getElementById('recovery-error-message');
      const errorText = document.getElementById('recovery-error-text');
      if (errorMsg && errorText && errorData && errorData.error) {
        errorText.textContent = errorData.error;
        errorMsg.style.display = 'block';
      } else if (errorMsg) {
        errorMsg.style.display = 'none';
      }
      
      // Setup recovery actions
      const downloadRaw = document.getElementById('recovery-download-raw');
      const importBackup = document.getElementById('recovery-import-backup');
      const resetData = document.getElementById('recovery-reset');
      const importInput = document.getElementById('recovery-import-input');
      
      if (downloadRaw) {
        downloadRaw.onclick = () => {
          try {
            const rawData = {};
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key.startsWith('autodiary:')) {
                rawData[key] = localStorage.getItem(key);
              }
            }
            const blob = new Blob([JSON.stringify(rawData, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `autodiary_raw_backup_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            showToast('Сырые данные скачаны');
          } catch (e) {
            showToast('Ошибка при скачивании данных');
            console.error(e);
          }
        };
      }
      
      if (importBackup && importInput) {
        importBackup.onclick = () => {
          importInput.click();
        };
        
        importInput.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const data = JSON.parse(event.target.result);
              if (typeof importBackup !== 'undefined' && typeof Storage !== 'undefined') {
                // Try to import using Storage module
                if (typeof window.importBackup === 'function') {
                  window.importBackup(data);
                } else {
                  // Fallback: clear and restore
                  localStorage.clear();
                  if (typeof data === 'object') {
                    Object.keys(data).forEach(key => {
                      if (typeof data[key] === 'string') {
                        localStorage.setItem(key, data[key]);
                      } else {
                        localStorage.setItem(key, JSON.stringify(data[key]));
                      }
                    });
                  }
                  location.reload();
                }
              }
            } catch (e) {
              showToast('Ошибка импорта: неверный формат файла');
              console.error(e);
            }
          };
          reader.readAsText(file);
        };
      }
      
      if (resetData) {
        resetData.onclick = () => {
          showModal('Сбросить все данные?', 'Это действие удалит все данные приложения и нельзя будет отменить. Продолжить?', () => {
            try {
              localStorage.clear();
              location.reload();
            } catch (e) {
              showToast('Ошибка при сбросе данных');
              console.error(e);
            }
          });
        };
      }
    }

    // Load state on initialization - wait for modules to load
    function initializeState() {
      try {
        if (typeof loadState === 'function') {
          const loadResult = loadState();
          if (loadResult && loadResult.success) {
            state = loadResult.data;
            return;
          } else if (loadResult && loadResult.corrupted) {
            // Show recovery screen
            if (typeof showRecoveryScreen === 'function') {
              showRecoveryScreen(loadResult);
            } else {
              console.error('Recovery screen function not available');
            }
            return;
          }
        }
      } catch(e) {
        console.error('Failed to load state:', e);
        // Show recovery screen on error
        if (typeof showRecoveryScreen === 'function') {
          showRecoveryScreen({ error: e.message, data: null });
        } else {
          console.error('Recovery screen function not available');
        }
        return;
      }
      
      // Fallback to old format
      if (typeof Storage !== 'undefined' && Storage.get) {
        state = {
          cars: StorageCompat.get('autodiary:cars', []),
          expenses: StorageCompat.get('autodiary:expenses', []),
          maintenance: StorageCompat.get('autodiary:maintenance', {}),
          intervals: StorageCompat.get('autodiary:intervals', {}),
          reminders: StorageCompat.get('autodiary:reminders', []),
          fuel: [],
          service: [],
          categories: StorageCompat.get('autodiary:categories', []),
          subcategories: StorageCompat.get('autodiary:subcategories', []),
          settings: {
            units: { distance: 'km', fuel: 'L/100km', currency: '₴' },
            darkMode: false,
            autoBackup: false
          }
        };
        // Save in new format if saveState is available
        if (typeof saveState === 'function') {
          try {
            saveState(state);
          } catch(e) {
            console.error('Failed to save state:', e);
          }
        }
      } else {
        // Ultimate fallback - use localStorage directly
        try {
          state = {
            cars: JSON.parse(localStorage.getItem('autodiary:cars') || '[]'),
            expenses: JSON.parse(localStorage.getItem('autodiary:expenses') || '[]'),
            maintenance: JSON.parse(localStorage.getItem('autodiary:maintenance') || '{}'),
            intervals: JSON.parse(localStorage.getItem('autodiary:intervals') || '{}'),
            reminders: JSON.parse(localStorage.getItem('autodiary:reminders') || '[]'),
            fuel: [],
            service: [],
            categories: JSON.parse(localStorage.getItem('autodiary:categories') || '[]'),
            subcategories: JSON.parse(localStorage.getItem('autodiary:subcategories') || '[]'),
            settings: {
              units: { distance: 'km', fuel: 'L/100km', currency: '₴' },
              darkMode: false,
              autoBackup: false
            }
          };
        } catch(e) {
          console.error('Failed to parse state:', e);
          state = {
            cars: [],
            expenses: [],
            maintenance: {},
            intervals: {},
            reminders: [],
            fuel: [],
            service: [],
            categories: [],
            subcategories: [],
            settings: {
              units: { distance: 'km', fuel: 'L/100km', currency: '₴' },
              darkMode: false,
              autoBackup: false
            }
          };
        }
      }
    }
    
    // Initialize state immediately
    initializeState();
    
    // Initialize advanced filters after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeAdvancedFilters, 100);
      });
    } else {
      setTimeout(initializeAdvancedFilters, 100);
    }

    // Helper function to save state
    function saveAppState() {
      const result = saveState(state);
      if (!result.success) {
        showToast(result.error || 'Ошибка сохранения данных', 3000);
        return false;
      }
      return true;
    }

    // View switching
    let views = [];
    let tabs = [];

    function showView(id){
      // Initialize views and tabs if not already done
      if(views.length === 0) {
        views = [...document.querySelectorAll('.view')];
      }
      if(tabs.length === 0) {
        // support legacy .tab as well as new .ios-tab
        tabs = [...document.querySelectorAll('.tab, .ios-tab')];
      }
      [...document.querySelectorAll('.view')].forEach(v=>v.classList.toggle('active',v.id===id));
      tabs.forEach(t=>{
        const isActive = t.dataset.goto===id || (id==='screen-garage-empty' && t.dataset.goto==='screen-garage');
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      window.scrollTo({top:0,behavior:'instant'});
      
      if(id==='screen-garage'){
        // Ensure state is up to date (but don't overwrite with old format)
        // state.cars should already be current from initializeState
        if(!state.cars || state.cars.length === 0){
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
      } else if(id==='screen-expense-form'){
        // Restore notes field visibility (Прочее flow hides it; reset here for other categories)
        const notesEl = document.getElementById('notes');
        const notesField = notesEl?.closest('.field');
        if(notesField) notesField.style.display = '';
      } else if(id==='screen-add-reminder'){
        populateReminderCarSelect();
      } else if(id==='screen-export'){
        // Export screen ready
      } else if(id==='screen-trash'){
        renderTrash();
      } else if(id==='screen-reports'){
        initializeReportsScreen();
      } else if(id==='screen-templates'){
        renderTemplates();
      } else if(id==='screen-recurring'){
        renderRecurring();
      } else if(id==='screen-categories-management'){
        renderCategoriesManagement();
      } else if(id==='screen-units-settings'){
        initializeUnitsSettings();
      } else if(id==='screen-maintenance-plan'){
        renderMaintenancePlan();
        initializeMaintenancePlanHandlers();
      } else if(id==='screen-car-passport'){
        if(currentCarId) renderCarPassport(currentCarId);
      }
    }

    // Calculate metrics for car
    function calculateCarMetrics(carId) {
      const expenses = state.expenses.filter(e => e.carId === carId && e.odometer > 0);
      // Filter fuel expenses by categoryId or legacy category name
      const fuelExpenses = expenses.filter(e => {
        if(e.categoryId && typeof Categories !== 'undefined' && Categories.getCategoryName) {
          const name = Categories.getCategoryName(state.categories || [], e.categoryId);
          return name === 'Заправка' || name === 'Электрозарядка';
        }
        return e.category === 'Заправка' || e.category === 'Электрозарядка';
      });
      
      // Get fuel entries from fuel module
      const fuelEntries = (state.fuel || []).filter(f => f.carId === carId && !f.deletedAt);
      
      let fuelConsumption = 0;
      let costPerKm = 0;
      let avgDay = 0;
      
      // Calculate fuel consumption (L/100km) - prefer fuel module if available
      if(fuelEntries.length >= 2 && typeof Fuel !== 'undefined' && Fuel.getAverageConsumption) {
        const sorted = [...fuelEntries].sort((a,b) => parseFloat(a.odometer || 0) - parseFloat(b.odometer || 0));
        const avgConsumption = Fuel.getAverageConsumption(sorted);
        if(avgConsumption) {
          fuelConsumption = avgConsumption;
        }
      } else if(fuelExpenses.length >= 2) {
        // Fallback to old expense-based calculation
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
      const allExpenses = ((typeof SoftDelete !== 'undefined' && SoftDelete.getActive) ? 
        SoftDelete.getActive(state.expenses) : state.expenses.filter(e => !e.deletedAt)).filter(e => e.carId === carId);
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
      // Use current state (already loaded via initializeState)
      // Don't reload from old format as it may be out of sync
      
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
      
      const activeCars = (typeof SoftDelete !== 'undefined' && SoftDelete.getActive) ? 
        SoftDelete.getActive(state.cars) : state.cars.filter(c => !c.deletedAt);
      activeCars.forEach((car, index) => {
        const expenses = ((typeof SoftDelete !== 'undefined' && SoftDelete.getActive) ? 
          SoftDelete.getActive(state.expenses) : state.expenses.filter(e => !e.deletedAt)).filter(e => e.carId === car.id);
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
        // Calculate current odometer for display
        const allOdoEntries = [
          ...(state.expenses || []).filter(e => e.carId === car.id && e.odometer && !e.deletedAt),
          ...(state.fuel || []).filter(f => f.carId === car.id && f.odometer && !f.deletedAt),
          ...(state.service || []).filter(s => s.carId === car.id && s.odometer && !s.deletedAt)
        ];
        const carOdometer = allOdoEntries.length > 0
          ? Math.max(...allOdoEntries.map(e => parseFloat(e.odometer) || 0))
          : (car.currentOdometer || 0);

        trailingDiv.className = 'ios-cell-trailing';
        trailingDiv.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
            <span style="font-size:var(--font-size-title-3);font-weight:700;color:var(--text);">${carOdometer > 0 ? carOdometer.toLocaleString('ru-RU') : '—'}</span>
            <span style="font-size:var(--font-size-caption-1);color:var(--text-tertiary);">км</span>
          </div>
        `;

        carCell.style.cursor = 'pointer';
        carCell.addEventListener('click', () => {
          currentCarId = car.id;
          renderCarPassport(car.id);
          showView('screen-car-passport');
        });

        carCell.appendChild(iconDiv);
        carCell.appendChild(contentDiv);
        carCell.appendChild(trailingDiv);

        group.appendChild(carCell);
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

      if (typeof lucide !== 'undefined') lucide.createIcons();
      console.log('Garage rendered, cars:', state.cars.length, 'button added:', !!addCarBtn);
    }

    // Filter expenses - use Diary module if available
    function filterExpenses(expenses) {
      if (typeof Diary !== 'undefined' && Diary.filterExpenses) {
        return Diary.filterExpenses(expenses, diaryFilters, state);
      }
      // Fallback to old logic
      let filtered = [...expenses];
      if(diaryFilters.carId !== '__all__' && diaryFilters.carId !== 'all') {
        filtered = filtered.filter(e => e.carId === diaryFilters.carId);
      }
      return filtered;
    }

    // Filter reminders for diary view - use Diary module if available
    function filterReminders(reminders) {
      if (typeof Diary !== 'undefined' && Diary.filterReminders) {
        return Diary.filterReminders(reminders, diaryFilters);
      }
      // Fallback to old logic
      let filtered = reminders.filter(r => (r.status || 'active') !== 'done');
      if(diaryFilters.carId !== '__all__' && diaryFilters.carId !== 'all') {
        filtered = filtered.filter(r => r.carId === diaryFilters.carId);
      }
      return filtered;
    }

    // Get category icon name for Lucide
    function getCategoryIcon(categoryOrId) {
      if (!categoryOrId) return 'more-horizontal';
      
      // Try to find by categoryId first
      if(typeof Categories !== 'undefined' && state.categories) {
        const cat = state.categories.find(c => c.id === categoryOrId);
        if(cat && cat.icon) return cat.icon;
      }
      
      // Fallback to legacy category name matching
      const category = typeof categoryOrId === 'string' ? categoryOrId : '';
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
      
      // Initialize toolbar chips using Diary module
      if (typeof Diary !== 'undefined' && Diary.initToolbar) {
        Diary.initToolbar(container, diaryFilters, state);
      }
      
      // Render maintenance plan widget
      renderMaintenanceWidget();
      
      // Filter out deleted items
      const activeExpenses = (typeof SoftDelete !== 'undefined' && SoftDelete.getActive) ? 
        SoftDelete.getActive(state.expenses) : state.expenses.filter(e => !e.deletedAt);
      const activeReminders = (typeof SoftDelete !== 'undefined' && SoftDelete.getActive) ? 
        SoftDelete.getActive(state.reminders) : state.reminders.filter(r => !r.deletedAt);
      
      // Update filter UI
      const timeFilterBtns = container.querySelectorAll('.time-filter button');
      timeFilterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim() === 
          (diaryFilters.timePeriod === 'month' ? 'Месяц' :
           diaryFilters.timePeriod === 'quarter' ? 'Квартал' :
           diaryFilters.timePeriod === 'year' ? 'Год' : 'Все'));
      });
      
      // Remove existing records, empty messages, and grouped lists
      const existingRecords = container.querySelectorAll('.record');
      existingRecords.forEach(r => r.remove());
      const existingEmpty = container.querySelector('.empty-wrap');
      if(existingEmpty) existingEmpty.remove();
      const existingGroupedList = container.querySelector('.ios-grouped-list');
      if(existingGroupedList) existingGroupedList.remove();
      
      // Apply advanced filters if Search module is available
      let preFiltered = activeExpenses;
      if (typeof Search !== 'undefined' && Search.advancedFilters) {
        const hasActiveFilters = Object.values(Search.advancedFilters).some(v => {
          if (Array.isArray(v)) return v.length > 0;
          if (typeof v === 'boolean') return v === true;
          return v !== null && v !== '' && v !== 'all';
        });
        if (hasActiveFilters) {
          preFiltered = Search.filterExpenses(activeExpenses, Search.advancedFilters, state);
        }
      }
      
      // Filter and sort expenses
      const filtered = filterExpenses(preFiltered);
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
      const filteredReminders = filterReminders(activeReminders);
      const sortedReminders = filteredReminders.sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate) : new Date(a.createdAt || 0);
        const db = b.dueDate ? new Date(b.dueDate) : new Date(b.createdAt || 0);
        return db - da;
      });
      
      if(sorted.length === 0 && sortedReminders.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-wrap';
        emptyMsg.innerHTML = '<div class="empty-text">Нет расходов и напоминаний</div>';
        container.appendChild(emptyMsg);
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
          const iconPath = getCategoryIcon(exp.categoryId || exp.category);
          iconDiv.innerHTML = `<i data-lucide="${iconPath}"></i>`;
          
          const categoryDisplay = (exp.categoryId && typeof Categories !== 'undefined' && Categories.getDisplayText) ? 
            Categories.getDisplayText(state.categories || [], state.subcategories || [], exp.categoryId, exp.subcategoryId) :
            (exp.category || 'Расход');
          
          const contentDiv = document.createElement('div');
          contentDiv.className = 'ios-cell-content';
          const timeStr = exp.time ? ', ' + exp.time.substring(0, 5) : '';
          contentDiv.innerHTML = `
            <div class="ios-cell-title">${escapeHtml(categoryDisplay)}</div>
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
            <button data-save-template-expense="${exp.id}" title="Сохранить как шаблон" class="ios-cell-action-btn">
              <i data-lucide="file-text"></i>
            </button>
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
        purchaseDate,
        servicePlan: editingCarId ? (state.cars.find(c => c.id === editingCarId)?.servicePlan || []) : [],
        deletedAt: null
      };
      
      if(editingCarId) {
        const index = state.cars.findIndex(c => c.id === editingCarId);
        if(index !== -1) {
          // Preserve existing servicePlan and other fields
          const existingCar = state.cars[index];
          state.cars[index] = {
            ...car,
            servicePlan: existingCar.servicePlan || [],
            deletedAt: existingCar.deletedAt || null
          };
          showToast('Автомобиль обновлен');
        }
        editingCarId = null;
      } else {
        state.cars.push(car);
        showToast('Автомобиль добавлен');
      }
      
      if(!saveAppState()) {
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

    // Validate odometer (updated to include fuel and service entries)
    function validateOdometer(carId, newOdometer) {
      if(!newOdometer || newOdometer === 0) return { valid: true };
      
      // Get all entries for this car (expenses, fuel, service)
      const activeExpenses = (typeof SoftDelete !== 'undefined' && SoftDelete.getActive) ? 
        SoftDelete.getActive(state.expenses) : state.expenses.filter(e => !e.deletedAt);
      const allEntries = [
        ...activeExpenses.filter(e => e.carId === carId && e.odometer),
        ...(state.fuel || []).filter(f => f.carId === carId && f.odometer && !f.deletedAt),
        ...(state.service || []).filter(s => s.carId === carId && s.odometer && !s.deletedAt)
      ];
      
      if(allEntries.length === 0) return { valid: true };
      
      // Find max odometer
      const maxOdometer = Math.max(...allEntries.map(e => parseFloat(e.odometer) || 0));
      
      if(newOdometer < maxOdometer) {
        const diff = maxOdometer - newOdometer;
        return {
          valid: false,
          message: `Пробег (${newOdometer} км) меньше последнего зарегистрированного (${maxOdometer} км). Разница: ${diff} км. Продолжить?`
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
      const categoryId = document.getElementById('expense-category-id')?.value;
      const subcategoryId = document.getElementById('expense-subcategory-id')?.value || null;
      const notes = form.querySelector('#notes')?.value?.trim() || '';
      const carId = currentCarId || state.cars[0]?.id || '';
      
      if(!amount || !date || !categoryId || !carId){
        showToast('Заполните все обязательные поля: стоимость, дата, категория');
        return false;
      }
      
      // Validate subcategory belongs to category
      if(subcategoryId) {
        const sub = (state.subcategories || []).find(s => s.id === subcategoryId);
        if(!sub || sub.categoryId !== categoryId) {
          showToast('Подкатегория не соответствует категории');
          return false;
        }
      }
      
      // Validate odometer
      if(odometer > 0) {
        const validation = validateOdometer(carId, odometer);
        if(!validation.valid) {
          showModal('Предупреждение', validation.message, () => {
            proceedSaveExpense(odometer, amount, date, time, categoryId, subcategoryId, notes, carId, form);
          });
          return false;
        }
      }
      
      return proceedSaveExpense(odometer, amount, date, time, categoryId, subcategoryId, notes, carId, form);
    }

    function proceedSaveExpense(odometer, amount, date, time, categoryId, subcategoryId, notes, carId, form) {
      // Get category/subcategory names for display (backward compatibility)
      const categoryName = (typeof Categories !== 'undefined' && Categories.getCategoryName) ? 
        Categories.getCategoryName(state.categories || [], categoryId) : '';
      const subcategoryName = subcategoryId && (typeof Categories !== 'undefined' && Categories.getSubcategoryName) ? 
        Categories.getSubcategoryName(state.subcategories || [], subcategoryId) : null;
      
      // Get receipts from preview (stored temporarily)
      const receipts = window.tempExpenseReceipts || [];
      
      const expense = {
        id: editingExpenseId || Date.now().toString(),
        carId,
        categoryId: categoryId,
        subcategoryId: subcategoryId,
        category: categoryName, // Keep for backward compatibility
        amount,
        odometer: odometer || 0,
        date,
        time,
        notes,
        receipts: receipts.length > 0 ? receipts : undefined,
        deletedAt: null
      };
      
      if(editingExpenseId) {
        const index = state.expenses.findIndex(e => e.id === editingExpenseId);
        if(index !== -1) {
          state.expenses[index] = expense;
          showToast('Расход обновлен');
        }
        editingExpenseId = null;
      } else {
        state.expenses.push(expense);
        showToast('Расход добавлен');
      }
      
      if(!saveAppState()) {
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
      document.getElementById('expense-category-id').value = '';
      document.getElementById('expense-subcategory-id').value = '';
      const amountSub = document.getElementById('amount-sub');
      if(amountSub) amountSub.textContent = '0,00 ₴';
      
      // Clear receipts
      window.tempExpenseReceipts = [];
      renderReceiptsPreview('expense-receipts-preview', []);
      
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
        
        // Load category/subcategory
        const categoryId = expense.categoryId || null;
        const subcategoryId = expense.subcategoryId || null;
        if(categoryId) {
          document.getElementById('expense-category-id').value = categoryId;
          document.getElementById('expense-subcategory-id').value = subcategoryId || '';
          const displayText = (typeof Categories !== 'undefined' && Categories.getDisplayText) ? 
            Categories.getDisplayText(state.categories || [], state.subcategories || [], categoryId, subcategoryId) :
            (expense.category || 'Выбрать');
          document.getElementById('expense-category-value').textContent = displayText;
        } else {
          document.getElementById('expense-category-value').textContent = expense.category || 'Выбрать';
        }
        const amountSubEl = document.getElementById('amount-sub');
        if(amountSubEl) amountSubEl.textContent = (expense.amount || 0).toLocaleString('ru-RU', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' ₴';
        
        showView('screen-expense-form');
      }
    }

    // Delete expense
    function deleteExpense(expenseId) {
      const expense = state.expenses.find(e => e.id === expenseId);
      if(!expense) return;
      
      const categoryDisplay = (typeof Categories !== 'undefined' && Categories.getDisplayText && expense.categoryId) ? 
        Categories.getDisplayText(state.categories || [], state.subcategories || [], expense.categoryId, expense.subcategoryId) :
        (expense.category || 'Не указано');
      showModal('Удалить расход?', `Вы уверены, что хотите удалить расход "${categoryDisplay}" на ${expense.amount} ₴?`, () => {
        if (typeof SoftDelete !== 'undefined' && SoftDelete.delete) {
          if (typeof SoftDelete !== 'undefined' && SoftDelete.delete) {
          SoftDelete.delete(expense, 'expense', state);
        } else {
          expense.deletedAt = new Date().toISOString();
        }
        } else {
          expense.deletedAt = new Date().toISOString();
        }
        if(saveAppState()) {
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
      
      showModal('Удалить автомобиль?', `Вы уверены, что хотите удалить "${car.brand} ${car.model}"? Все связанные расходы (${expensesCount}) также будут удалены.`, () => {
        state.cars = state.cars.filter(c => c.id !== carId);
        state.expenses = state.expenses.filter(e => e.carId !== carId);
        delete state.maintenance[carId];
        delete state.intervals[carId];
        
        // Reset diary filter if deleted car was selected
        if (diaryFilters.carId === carId) {
          diaryFilters.carId = '__all__';
          if (typeof Diary !== 'undefined' && Diary.saveCarFilter) {
            Diary.saveCarFilter('__all__');
          }
        }
        
        if(saveAppState()) {
          showToast('Автомобиль удален');
          renderGarage();
          if(currentCarId === carId) {
            currentCarId = null;
            showView('screen-garage');
          }
          // Re-render diary to update filter
          renderDiary();
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
      saveAppState();
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
      saveAppState();
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
      document.getElementById('car-name-settings').textContent = 'Интервалы ТО — ' + name;
      document.getElementById('car-sub-settings').textContent = sub;
      
      // Update maintenance plan screen header
      const planNameEl = document.getElementById('maintenance-plan-car-name');
      const planSubEl = document.getElementById('maintenance-plan-car-sub');
      if (planNameEl) planNameEl.textContent = 'Регламент (ТО) — ' + name;
      if (planSubEl) planSubEl.textContent = sub;
      
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
      
      // Render fuel and service tabs
      renderFuelTab(carId);
      renderServiceTab(carId);
      
      // Initialize tabs
      initializeCarTabs();
    }
    
    // Render maintenance plan screen
    function renderMaintenancePlan() {
      if (!currentCarId) {
        showToast('Выберите автомобиль');
        showView('screen-garage');
        return;
      }
      
      const car = state.cars.find(c => c.id === currentCarId);
      if (!car) {
        showToast('Автомобиль не найден');
        showView('screen-garage');
        return;
      }

      // Auto-apply basic template if no plan exists yet
      if ((!car.servicePlan || car.servicePlan.length === 0) && typeof MaintenancePlan !== 'undefined' && MaintenancePlan.applyTemplate) {
        MaintenancePlan.applyTemplate(car, 'basic', state);
        saveAppState();
      }

      // Get current odometer (from latest service/fuel entry or expense)
      const carService = (state.service || []).filter(s => s.carId === currentCarId && !s.deletedAt);
      const carFuel = (state.fuel || []).filter(f => f.carId === currentCarId && !f.deletedAt);
      const carExpenses = (state.expenses || []).filter(e => e.carId === currentCarId && !e.deletedAt && e.odometer);
      
      let currentOdometer = 0;
      if (carService.length > 0) {
        const latestService = carService.sort((a, b) => parseFloat(b.odometer || 0) - parseFloat(a.odometer || 0))[0];
        currentOdometer = parseFloat(latestService.odometer || 0);
      }
      if (carFuel.length > 0) {
        const latestFuel = carFuel.sort((a, b) => parseFloat(b.odometer || 0) - parseFloat(a.odometer || 0))[0];
        currentOdometer = Math.max(currentOdometer, parseFloat(latestFuel.odometer || 0));
      }
      if (carExpenses.length > 0) {
        const latestExpense = carExpenses.sort((a, b) => parseFloat(b.odometer || 0) - parseFloat(a.odometer || 0))[0];
        currentOdometer = Math.max(currentOdometer, parseFloat(latestExpense.odometer || 0));
      }
      
      // Compute plan status
      const planItems = typeof MaintenancePlan !== 'undefined' 
        ? MaintenancePlan.computePlanStatus(car, new Date(), currentOdometer, state)
        : [];
      
      const container = document.getElementById('maintenance-plan-list');
      const emptyMsg = document.getElementById('maintenance-plan-empty');
      
      if (!container) return;
      
      if (planItems.length === 0) {
        container.innerHTML = '';
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
      }
      
      if (emptyMsg) emptyMsg.style.display = 'none';
      container.innerHTML = '';
      
      // Group by status
      const byStatus = {
        overdue: [],
        soon: [],
        ok: []
      };
      
      planItems.forEach(item => {
        if (item.status === 'overdue') {
          byStatus.overdue.push(item);
        } else if (item.status === 'soon') {
          byStatus.soon.push(item);
        } else {
          byStatus.ok.push(item);
        }
      });
      
      // Render groups
      ['overdue', 'soon', 'ok'].forEach(status => {
        if (byStatus[status].length === 0) return;
        
        const group = document.createElement('div');
        group.className = 'ios-group';
        
        const header = document.createElement('div');
        header.className = 'ios-group-header';
        if (status === 'overdue') {
          header.textContent = 'Просрочено';
          header.style.color = 'var(--danger)';
        } else if (status === 'soon') {
          header.textContent = 'Скоро ТО';
          header.style.color = 'var(--warning)';
        } else {
          header.textContent = 'В порядке';
        }
        group.appendChild(header);
        
        byStatus[status].forEach(item => {
          const cell = document.createElement('div');
          cell.className = 'ios-cell';
          cell.dataset.planItemId = item.id;
          
          // Status pill
          let statusPill = '';
          if (item.status === 'overdue') {
            statusPill = '<span style="background: var(--danger); color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">Просрочено</span>';
          } else if (item.status === 'soon') {
            statusPill = '<span style="background: var(--warning); color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">Скоро</span>';
          } else {
            statusPill = '<span style="background: var(--success); color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">OK</span>';
          }
          
          // Next due summary
          let dueSummary = '';
          if (item.displayDue) {
            if (item.displayDue.type === 'km') {
              dueSummary = `Следующее: ${item.displayDue.value.toLocaleString('ru-RU')} км (через ${item.displayDue.remaining.toLocaleString('ru-RU')} км)`;
            } else {
              const dateStr = item.displayDue.value.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
              dueSummary = `Следующее: ${dateStr} (через ${item.displayDue.remaining} дн.)`;
            }
          } else if (!item.lastServiceOdometer && !item.lastServiceDate) {
            dueSummary = 'Не задано последнее обслуживание';
          } else {
            dueSummary = item.statusMessage || 'В порядке';
          }
          
          cell.innerHTML = `
            <div class="ios-cell-content">
              <div style="display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-xs);">
                <div class="ios-cell-title" style="flex: 1;">${escapeHtml(item.title)}</div>
                ${statusPill}
              </div>
              <div class="ios-cell-subtitle">${escapeHtml(dueSummary)}</div>
            </div>
            <div class="ios-cell-trailing">
              <button class="ios-cell-action-btn" data-edit-plan-item="${item.id}" title="Редактировать">
                <i data-lucide="pencil"></i>
              </button>
            </div>
          `;
          
          group.appendChild(cell);
        });
        
        container.appendChild(group);
      });
      
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    // Render maintenance plan widget in diary
    function renderMaintenanceWidget() {
      const widget = document.getElementById('maintenance-widget');
      const content = document.getElementById('maintenance-widget-content');
      const emptyMsg = document.getElementById('maintenance-widget-empty');
      const showAllBtn = document.getElementById('maintenance-widget-show-all');
      
      if (!widget || !content) return;
      
      // Get cars to check (based on current filter)
      let carsToCheck = [];
      if (diaryFilters.carId === '__all__') {
        carsToCheck = state.cars.filter(c => !c.deletedAt);
      } else {
        const car = state.cars.find(c => c.id === diaryFilters.carId && !c.deletedAt);
        if (car) carsToCheck = [car];
      }
      
      if (carsToCheck.length === 0) {
        widget.style.display = 'none';
        return;
      }
      
      // Collect all maintenance items from selected cars
      const allItems = [];
      carsToCheck.forEach(car => {
        if (!car.servicePlan || car.servicePlan.length === 0) return;
        
        // Get current odometer for this car
        const carService = (state.service || []).filter(s => s.carId === car.id && !s.deletedAt);
        const carFuel = (state.fuel || []).filter(f => f.carId === car.id && !f.deletedAt);
        const carExpenses = (state.expenses || []).filter(e => e.carId === car.id && !e.deletedAt && e.odometer);
        
        let currentOdometer = 0;
        if (carService.length > 0) {
          const latest = carService.sort((a, b) => parseFloat(b.odometer || 0) - parseFloat(a.odometer || 0))[0];
          currentOdometer = parseFloat(latest.odometer || 0);
        }
        if (carFuel.length > 0) {
          const latest = carFuel.sort((a, b) => parseFloat(b.odometer || 0) - parseFloat(a.odometer || 0))[0];
          currentOdometer = Math.max(currentOdometer, parseFloat(latest.odometer || 0));
        }
        if (carExpenses.length > 0) {
          const latest = carExpenses.sort((a, b) => parseFloat(b.odometer || 0) - parseFloat(a.odometer || 0))[0];
          currentOdometer = Math.max(currentOdometer, parseFloat(latest.odometer || 0));
        }
        
        // Compute status for this car's plan
        if (typeof MaintenancePlan !== 'undefined' && MaintenancePlan.computePlanStatus) {
          const planItems = MaintenancePlan.computePlanStatus(car, new Date(), currentOdometer, state);
          planItems.forEach(item => {
            allItems.push({
              ...item,
              carId: car.id,
              carName: `${car.brand} ${car.model}`
            });
          });
        }
      });
      
      // Filter by current tab (overdue/soon)
      const currentTab = widget.querySelector('.maintenance-tab-btn.active')?.dataset.tab || 'overdue';
      const filteredItems = allItems.filter(item => item.status === currentTab);
      
      if (filteredItems.length === 0) {
        widget.style.display = 'none';
        return;
      }
      
      widget.style.display = 'block';
      content.innerHTML = '';
      
      // Show up to 3 items
      const itemsToShow = filteredItems.slice(0, 3);
      const hasMore = filteredItems.length > 3;
      
      itemsToShow.forEach(item => {
        const cell = document.createElement('div');
        cell.className = 'ios-cell';
        cell.style.cursor = 'pointer';
        
        let statusColor = 'var(--success)';
        if (item.status === 'overdue') statusColor = 'var(--danger)';
        else if (item.status === 'soon') statusColor = 'var(--warning)';
        
        let dueText = '';
        if (item.displayDue) {
          if (item.displayDue.type === 'km') {
            dueText = `через ${item.displayDue.remaining.toLocaleString('ru-RU')} км`;
          } else {
            dueText = `через ${item.displayDue.remaining} дн.`;
          }
        }
        
        cell.innerHTML = `
          <div class="ios-cell-content">
            <div class="ios-cell-title">${escapeHtml(item.title)}</div>
            <div class="ios-cell-subtitle">${escapeHtml(item.carName)} • ${escapeHtml(dueText || item.statusMessage)}</div>
          </div>
          <div class="ios-cell-trailing">
            <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
              ${item.status === 'overdue' ? 'Просрочено' : 'Скоро'}
            </span>
          </div>
        `;
        
        cell.addEventListener('click', () => {
          currentCarId = item.carId;
          loadCarDetails(item.carId);
          showView('screen-maintenance-plan');
        });
        
        content.appendChild(cell);
      });
      
      if (hasMore) {
        showAllBtn.style.display = 'block';
        showAllBtn.onclick = () => {
          if (diaryFilters.carId === '__all__') {
            // Show combined view or first car
            if (carsToCheck.length > 0) {
              currentCarId = carsToCheck[0].id;
              loadCarDetails(currentCarId);
              showView('screen-maintenance-plan');
            }
          } else {
            showView('screen-maintenance-plan');
          }
        };
      } else {
        showAllBtn.style.display = 'none';
      }
      
      if (emptyMsg) emptyMsg.style.display = 'none';
      
      // Tab switching
      widget.querySelectorAll('.maintenance-tab-btn').forEach(btn => {
        btn.onclick = null;
        btn.addEventListener('click', () => {
          widget.querySelectorAll('.maintenance-tab-btn').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'transparent';
          });
          btn.classList.add('active');
          btn.style.background = 'var(--surface)';
          renderMaintenanceWidget();
        });
      });
    }
    
    // Initialize maintenance plan handlers
    function initializeMaintenancePlanHandlers() {
      // Template application handlers
      const basicTemplateBtn = document.getElementById('apply-template-basic-btn');
      const extendedTemplateBtn = document.getElementById('apply-template-extended-btn');
      const addPlanItemBtn = document.getElementById('add-plan-item-btn');
      
      if (basicTemplateBtn) {
        basicTemplateBtn.addEventListener('click', () => {
          if (!currentCarId) return;
          const car = state.cars.find(c => c.id === currentCarId);
          if (!car) return;
          
          if (typeof MaintenancePlan !== 'undefined' && MaintenancePlan.applyTemplate) {
            MaintenancePlan.applyTemplate(car, 'basic', state);
            if (saveAppState()) {
              showToast('Базовый шаблон применен');
              renderMaintenancePlan();
            }
          }
        });
      }
      
      if (extendedTemplateBtn) {
        extendedTemplateBtn.addEventListener('click', () => {
          if (!currentCarId) return;
          const car = state.cars.find(c => c.id === currentCarId);
          if (!car) return;
          
          if (typeof MaintenancePlan !== 'undefined' && MaintenancePlan.applyTemplate) {
            MaintenancePlan.applyTemplate(car, 'extended', state);
            if (saveAppState()) {
              showToast('Расширенный шаблон применен');
              renderMaintenancePlan();
            }
          }
        });
      }
      
      if (addPlanItemBtn) {
        addPlanItemBtn.addEventListener('click', () => {
          showMaintenanceCategoryPicker();
        });
      }
      
      // Edit plan item handler (delegated)
      document.body.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-edit-plan-item]');
        if (editBtn) {
          e.preventDefault();
          e.stopPropagation();
          const itemId = editBtn.dataset.editPlanItem;
          showPlanItemEditor(itemId);
        }
      });
    }
    
    // Service type categories for the icon picker
    const SERVICE_TYPE_CATS = [
      { type: 'oil',            label: 'Моторное масло',           icon: 'droplets', color: '#FF9500', bg: 'rgba(255,149,0,0.15)' },
      { type: 'oilFilter',      label: 'Фильтр масляный',          icon: 'filter',   color: '#FFCC00', bg: 'rgba(255,204,0,0.15)' },
      { type: 'cabinFilter',    label: 'Фильтр салона',            icon: 'wind',     color: '#007AFF', bg: 'rgba(0,122,255,0.15)' },
      { type: 'airFilter',      label: 'Фильтр двигателя',         icon: 'filter',   color: '#34C759', bg: 'rgba(52,199,89,0.15)' },
      { type: 'fuelFilter',     label: 'Фильтр топливный',         icon: 'fuel',     color: '#FF6B35', bg: 'rgba(255,107,53,0.15)' },
      { type: 'brakeDiscsFront',label: 'Диски передние',           icon: 'circle',   color: '#FF3B30', bg: 'rgba(255,59,48,0.15)' },
      { type: 'brakeDiscsRear', label: 'Диски задние',             icon: 'circle',   color: '#C41E3A', bg: 'rgba(196,30,58,0.15)' },
      { type: 'brakePadsFront', label: 'Колодки передние',         icon: 'square',   color: '#FF3B30', bg: 'rgba(255,59,48,0.15)' },
      { type: 'brakePadsRear',  label: 'Колодки задние',           icon: 'square',   color: '#C41E3A', bg: 'rgba(196,30,58,0.15)' },
    ];

    // Update the visual display of selected service types
    function updateServiceTypeDisplay() {
      const display = document.getElementById('service-type-display');
      if (!display) return;
      const types = window.selectedServiceTypes || [];
      if (types.length === 0) {
        // Fallback to single hidden select value
        const sel = document.getElementById('service-type');
        const val = sel ? sel.value : '';
        if (val) {
          const cat = SERVICE_TYPE_CATS.find(c => c.type === val);
          display.textContent = cat ? cat.label : (sel.options[sel.selectedIndex]?.text || val);
          display.style.color = 'var(--text)';
        } else {
          display.textContent = 'Выбрать';
          display.style.color = 'var(--text-secondary)';
        }
      } else {
        display.innerHTML = types.map(t => {
          const cat = SERVICE_TYPE_CATS.find(c => c.type === t.type);
          return `<span style="display:inline-block;background:${cat ? cat.bg : 'rgba(0,122,255,0.1)'};color:${cat ? cat.color : '#007AFF'};padding:3px 10px;border-radius:12px;font-size:var(--font-size-footnote);margin:2px 2px 2px 0;">${escapeHtml(t.label)}</span>`;
        }).join('');
        display.style.color = 'var(--text)';
      }
    }

    // Fuel type picker (single-select: бензин / дизель / газ / электро)
    const FUEL_TYPES = [
      { type: 'petrol',   label: 'Бензин',  icon: 'fuel',       color: '#FF9500', bg: 'rgba(255,149,0,0.15)' },
      { type: 'diesel',   label: 'Дизель',  icon: 'droplets',   color: '#007AFF', bg: 'rgba(0,122,255,0.15)' },
      { type: 'gas',      label: 'Газ',     icon: 'flame',      color: '#34C759', bg: 'rgba(52,199,89,0.15)' },
    ];

    function updateFuelTypeDisplay() {
      const display = document.getElementById('fuel-type-display');
      if (!display) return;
      const ft = window.selectedFuelType;
      if (ft) {
        const t = FUEL_TYPES.find(f => f.type === ft.type);
        display.innerHTML = `<span style="display:inline-block;background:${t ? t.bg : 'rgba(0,122,255,0.1)'};color:${t ? t.color : '#007AFF'};padding:3px 10px;border-radius:12px;font-size:var(--font-size-footnote);">${escapeHtml(ft.label)}</span>`;
        display.style.color = 'var(--text)';
      } else {
        display.textContent = 'Выбрать';
        display.style.color = 'var(--text-secondary)';
      }
    }

    function showFuelTypePicker() {
      let selected = window.selectedFuelType?.type || null;

      let modal = document.getElementById('fuel-type-picker-modal');
      if (modal) modal.remove();
      modal = document.createElement('div');
      modal.id = 'fuel-type-picker-modal';
      modal.className = 'ios-sheet-overlay';
      document.body.appendChild(modal);

      function closeModal() {
        modal.classList.remove('active');
        setTimeout(() => { if (modal.parentNode) modal.remove(); }, 300);
      }

      function renderModal() {
        modal.innerHTML = `
          <div class="ios-sheet">
            <div class="ios-sheet-handle"></div>
            <div class="ios-sheet-header">
              <div>
                <h2 style="font-size:var(--font-size-title-3);font-weight:600;color:var(--text);margin:0;">Тип топлива</h2>
                <p style="font-size:var(--font-size-subheadline);color:var(--text-secondary);margin:var(--space-xs) 0 0 0;">Выберите вид топлива</p>
              </div>
              <button class="ios-sheet-close" id="fuel-type-close"><i data-lucide="x"></i></button>
            </div>
            <div class="ios-sheet-content">
              <div class="expense-category-grid" style="grid-template-columns:repeat(3,1fr);">
                ${FUEL_TYPES.map(ft => {
                  const isSel = selected === ft.type;
                  return `
                    <button class="expense-category-item" data-fuel-type="${ft.type}"
                      style="position:relative;${isSel ? 'box-shadow:0 0 0 2px #34C759;border-radius:14px;' : ''}">
                      <div class="expense-category-icon" style="background:${ft.bg};color:${ft.color};">
                        <i data-lucide="${ft.icon}"></i>
                      </div>
                      <span>${escapeHtml(ft.label)}</span>
                      ${isSel ? '<div style="position:absolute;top:5px;right:5px;width:18px;height:18px;background:#34C759;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:1;"><i data-lucide="check" style="width:11px;height:11px;color:white;"></i></div>' : ''}
                    </button>`;
                }).join('')}
              </div>
            </div>
          </div>`;

        if (typeof lucide !== 'undefined') lucide.createIcons();

        modal.querySelectorAll('[data-fuel-type]').forEach(btn => {
          btn.addEventListener('click', () => {
            const t = btn.dataset.fuelType;
            const ft = FUEL_TYPES.find(f => f.type === t);
            window.selectedFuelType = ft ? { type: ft.type, label: ft.label } : null;
            updateFuelTypeDisplay();
            closeModal();
          });
        });

        document.getElementById('fuel-type-close').addEventListener('click', closeModal);
        modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
      }

      renderModal();
      requestAnimationFrame(() => modal.classList.add('active'));
    }

    function showUpdateOdometerSheet() {
      const carId = currentCarId || state.cars[0]?.id;
      const car = state.cars.find(c => c.id === carId);
      if(!car) { showToast('Сначала выберите автомобиль'); return; }

      const allEntries = [
        ...(state.expenses || []).filter(e => e.carId === carId && e.odometer && !e.deletedAt),
        ...(state.fuel || []).filter(f => f.carId === carId && f.odometer && !f.deletedAt),
        ...(state.service || []).filter(s => s.carId === carId && s.odometer && !s.deletedAt),
      ];
      const knownOdometer = allEntries.length
        ? Math.max(...allEntries.map(e => parseFloat(e.odometer) || 0))
        : (car.currentOdometer || 0);

      let modal = document.getElementById('odometer-update-modal');
      if(modal) modal.remove();
      modal = document.createElement('div');
      modal.id = 'odometer-update-modal';
      modal.className = 'ios-sheet-overlay';
      document.body.appendChild(modal);

      function closeModal() {
        modal.classList.remove('active');
        setTimeout(() => { if(modal.parentNode) modal.remove(); }, 300);
      }

      modal.innerHTML = `
        <div class="ios-sheet">
          <div class="ios-sheet-handle"></div>
          <div class="ios-sheet-header">
            <div>
              <h2 style="font-size:var(--font-size-title-3);font-weight:600;color:var(--text);margin:0;">Обновить пробег</h2>
              <p style="font-size:var(--font-size-subheadline);color:var(--text-secondary);margin:var(--space-xs) 0 0 0;">${escapeHtml(car.brand + ' ' + car.model)}</p>
            </div>
            <button class="ios-sheet-close" id="odo-close"><i data-lucide="x"></i></button>
          </div>
          <div class="ios-sheet-content">
            <div style="margin-bottom:var(--space-md);">
              <label style="font-size:var(--font-size-footnote);font-weight:500;color:var(--text-secondary);display:block;margin-bottom:6px;">Текущий пробег (км)</label>
              <input id="odo-value" type="number" inputmode="numeric" placeholder="Например: 85000" value="${knownOdometer || ''}"
                style="width:100%;padding:12px 14px;border-radius:12px;border:0.5px solid var(--separator);background:var(--surface-2);color:var(--text);font-size:var(--font-size-body);box-sizing:border-box;outline:none;">
            </div>
            <div style="margin-bottom:var(--space-lg);">
              <label style="font-size:var(--font-size-footnote);font-weight:500;color:var(--text-secondary);display:block;margin-bottom:6px;">Дата</label>
              <input id="odo-date" type="date" value="${new Date().toISOString().split('T')[0]}"
                style="width:100%;padding:12px 14px;border-radius:12px;border:0.5px solid var(--separator);background:var(--surface-2);color:var(--text);font-size:var(--font-size-body);box-sizing:border-box;outline:none;">
            </div>
            <button class="ios-button ios-button-primary" id="odo-confirm" style="width:100%;">Сохранить</button>
          </div>
        </div>`;

      if(typeof lucide !== 'undefined') lucide.createIcons();
      setTimeout(() => document.getElementById('odo-value')?.focus(), 350);

      document.getElementById('odo-close').addEventListener('click', closeModal);
      modal.addEventListener('click', e => { if(e.target === modal) closeModal(); });

      document.getElementById('odo-confirm').addEventListener('click', () => {
        const val = parseFloat(document.getElementById('odo-value')?.value || 0);
        const date = document.getElementById('odo-date')?.value || new Date().toISOString().split('T')[0];
        if(!val || val <= 0) { showToast('Введите корректный пробег'); return; }

        if(!state.fuel) state.fuel = [];
        state.fuel.push({
          id: 'odo_' + Date.now(),
          carId,
          odometer: val,
          date,
          type: 'odometer-update',
          liters: 0,
          cost: 0,
          deletedAt: null
        });

        const idx = state.cars.findIndex(c => c.id === carId);
        if(idx !== -1) state.cars[idx].currentOdometer = val;

        if(saveAppState()) {
          showToast('Пробег обновлён: ' + val.toLocaleString('ru') + ' км');
          renderGarage();
        }
        closeModal();
      });

      requestAnimationFrame(() => modal.classList.add('active'));
    }

    // Care subcategory picker (мойка / химчистка / полировка / прочее)
    const CARE_TYPES = [
      { type: 'wash',     label: 'Мойка',             icon: 'droplets',    color: '#007AFF', bg: 'rgba(0,122,255,0.15)' },
      { type: 'dry',      label: 'Химчистка салона',  icon: 'sparkles',    color: '#5856D6', bg: 'rgba(88,86,214,0.15)' },
      { type: 'polish',   label: 'Полировка',          icon: 'sun',         color: '#FF9500', bg: 'rgba(255,149,0,0.15)' },
      { type: 'other',    label: 'Прочее',             icon: 'more-horizontal', color: '#8E8E93', bg: 'rgba(142,142,147,0.15)' },
    ];

    function showCareTypePicker(onSelect) {
      let modal = document.getElementById('care-type-picker-modal');
      if (modal) modal.remove();
      modal = document.createElement('div');
      modal.id = 'care-type-picker-modal';
      modal.className = 'ios-sheet-overlay';
      document.body.appendChild(modal);

      function closeModal() {
        modal.classList.remove('active');
        setTimeout(() => { if (modal.parentNode) modal.remove(); }, 300);
      }

      modal.innerHTML = `
        <div class="ios-sheet">
          <div class="ios-sheet-handle"></div>
          <div class="ios-sheet-header">
            <div>
              <h2 style="font-size:var(--font-size-title-3);font-weight:600;color:var(--text);margin:0;">Уход</h2>
              <p style="font-size:var(--font-size-subheadline);color:var(--text-secondary);margin:var(--space-xs) 0 0 0;">Выберите вид ухода</p>
            </div>
            <button class="ios-sheet-close" id="care-type-close"><i data-lucide="x"></i></button>
          </div>
          <div class="ios-sheet-content">
            <div class="expense-category-grid" style="grid-template-columns:repeat(4,1fr);">
              ${CARE_TYPES.map(ct => `
                <button class="expense-category-item" data-care-type="${ct.type}">
                  <div class="expense-category-icon" style="background:${ct.bg};color:${ct.color};">
                    <i data-lucide="${ct.icon}"></i>
                  </div>
                  <span>${escapeHtml(ct.label)}</span>
                </button>`).join('')}
            </div>
          </div>
        </div>`;

      if (typeof lucide !== 'undefined') lucide.createIcons();

      document.getElementById('care-type-close').addEventListener('click', closeModal);
      modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

      modal.querySelectorAll('[data-care-type]').forEach(btn => {
        btn.addEventListener('click', () => {
          const ct = CARE_TYPES.find(c => c.type === btn.dataset.careType);
          closeModal();
          if (ct) onSelect(ct);
        });
      });

      requestAnimationFrame(() => modal.classList.add('active'));
    }

    // "Прочее" — text input sub-sheet
    function showOtherExpensePicker(onConfirm) {
      let modal = document.getElementById('other-expense-modal');
      if (modal) modal.remove();
      modal = document.createElement('div');
      modal.id = 'other-expense-modal';
      modal.className = 'ios-sheet-overlay';
      document.body.appendChild(modal);

      function closeModal() {
        modal.classList.remove('active');
        setTimeout(() => { if (modal.parentNode) modal.remove(); }, 300);
      }

      modal.innerHTML = `
        <div class="ios-sheet">
          <div class="ios-sheet-handle"></div>
          <div class="ios-sheet-header">
            <div>
              <h2 style="font-size:var(--font-size-title-3);font-weight:600;color:var(--text);margin:0;">Прочие расходы</h2>
              <p style="font-size:var(--font-size-subheadline);color:var(--text-secondary);margin:var(--space-xs) 0 0 0;">Опишите расход</p>
            </div>
            <button class="ios-sheet-close" id="other-exp-close"><i data-lucide="x"></i></button>
          </div>
          <div class="ios-sheet-content">
            <div>
              <input id="other-exp-text" type="text" placeholder="Например: замена дворников, наклейки…"
                style="width:100%;padding:12px 14px;border-radius:12px;border:0.5px solid var(--separator);background:var(--surface-2);color:var(--text);font-size:var(--font-size-body);box-sizing:border-box;outline:none;">
            </div>
            <div style="margin-top:var(--space-lg);">
              <button class="ios-button ios-button-primary" id="other-exp-confirm" style="width:100%;">Готово</button>
            </div>
          </div>
        </div>`;

      if (typeof lucide !== 'undefined') lucide.createIcons();

      const input = document.getElementById('other-exp-text');
      setTimeout(() => input?.focus(), 350);

      document.getElementById('other-exp-close').addEventListener('click', closeModal);
      modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

      document.getElementById('other-exp-confirm').addEventListener('click', () => {
        const text = input?.value?.trim() || '';
        closeModal();
        onConfirm(text);
      });

      // Also confirm on Enter
      input?.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); document.getElementById('other-exp-confirm')?.click(); }
      });

      requestAnimationFrame(() => modal.classList.add('active'));
    }

    // Show service type picker modal (multi-select)
    function showServiceTypePicker() {
      const selected = new Set((window.selectedServiceTypes || []).map(t => t.type));

      // Also include single-select value if set
      const singleType = document.getElementById('service-type')?.value;
      if (singleType) selected.add(singleType);

      // Pre-fill oil details from existing selection
      const existingOil = (window.selectedServiceTypes || []).find(t => t.type === 'oil');
      const oilDetails = { brand: existingOil?.brand || '', viscosity: existingOil?.viscosity || '', volume: existingOil?.volume || '' };

      let modal = document.getElementById('service-type-picker-modal');
      if (modal) modal.remove();
      modal = document.createElement('div');
      modal.id = 'service-type-picker-modal';
      modal.className = 'ios-sheet-overlay';
      document.body.appendChild(modal);

      function closeModal() {
        modal.classList.remove('active');
        setTimeout(() => { if (modal.parentNode) modal.remove(); }, 300);
      }

      function renderModal() {
        modal.innerHTML = `
          <div class="ios-sheet">
            <div class="ios-sheet-handle"></div>
            <div class="ios-sheet-header">
              <div>
                <h2 style="font-size:var(--font-size-title-3);font-weight:600;color:var(--text);margin:0;">Категория расходов</h2>
                <p style="font-size:var(--font-size-subheadline);color:var(--text-secondary);margin:var(--space-xs) 0 0 0;">Выберите один или несколько видов работ</p>
              </div>
              <button class="ios-sheet-close" id="svc-picker-close"><i data-lucide="x"></i></button>
            </div>
            <div class="ios-sheet-content">
              <div class="expense-category-grid">
                ${SERVICE_TYPE_CATS.map(cat => {
                  const isSel = selected.has(cat.type);
                  return `
                    <button class="expense-category-item" data-svc-type="${cat.type}"
                      style="position:relative;${isSel ? 'box-shadow:0 0 0 2px #34C759;border-radius:14px;' : ''}">
                      <div class="expense-category-icon" style="background:${cat.bg};color:${cat.color};">
                        <i data-lucide="${cat.icon}"></i>
                      </div>
                      <span>${escapeHtml(cat.label)}</span>
                      ${isSel ? '<div style="position:absolute;top:5px;right:5px;width:18px;height:18px;background:#34C759;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:1;"><i data-lucide="check" style="width:11px;height:11px;color:white;"></i></div>' : ''}
                    </button>`;
                }).join('')}
              </div>
              <div style="margin-top:var(--space-lg);">
                <button class="ios-button ios-button-primary" id="svc-picker-save" style="width:100%;"
                  ${selected.size === 0 ? 'disabled' : ''}>
                  Выбрать${selected.size > 0 ? ' (' + selected.size + ')' : ''}
                </button>
              </div>
            </div>
          </div>`;

        if (typeof lucide !== 'undefined') lucide.createIcons();

        modal.querySelectorAll('[data-svc-type]').forEach(btn => {
          btn.addEventListener('click', () => {
            const t = btn.dataset.svcType;
            if (t === 'oil') {
              // Always open the sub-sheet (whether selected or not)
              showOilDetailsSheet();
            } else {
              if (selected.has(t)) selected.delete(t); else selected.add(t);
              renderModal();
            }
          });
        });

        document.getElementById('svc-picker-close').addEventListener('click', closeModal);

        const saveBtn = document.getElementById('svc-picker-save');
        if (saveBtn && !saveBtn.disabled) {
          saveBtn.addEventListener('click', () => {
            window.selectedServiceTypes = Array.from(selected).map(t => {
              const cat = SERVICE_TYPE_CATS.find(c => c.type === t);
              const entry = { type: t, label: cat ? cat.label : t };
              if (t === 'oil') {
                if (oilDetails.brand) entry.brand = oilDetails.brand;
                if (oilDetails.viscosity) entry.viscosity = oilDetails.viscosity;
                if (oilDetails.volume) entry.volume = oilDetails.volume;
              }
              return entry;
            });
            // Sync single hidden select with first type
            const sel = document.getElementById('service-type');
            if (sel && window.selectedServiceTypes.length > 0) {
              sel.value = window.selectedServiceTypes[0].type;
            }
            updateServiceTypeDisplay();
            closeModal();
          });
        }

        modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
      }

      function showOilDetailsSheet() {
        let subModal = document.getElementById('oil-details-submodal');
        if (subModal) subModal.remove();
        subModal = document.createElement('div');
        subModal.id = 'oil-details-submodal';
        subModal.className = 'ios-sheet-overlay';
        subModal.style.zIndex = '10001';
        document.body.appendChild(subModal);

        subModal.innerHTML = `
          <div class="ios-sheet">
            <div class="ios-sheet-handle"></div>
            <div class="ios-sheet-header">
              <div>
                <h2 style="font-size:var(--font-size-title-3);font-weight:600;color:var(--text);margin:0;">Моторное масло</h2>
                <p style="font-size:var(--font-size-subheadline);color:var(--text-secondary);margin:var(--space-xs) 0 0 0;">Укажите детали масла</p>
              </div>
              <button class="ios-sheet-close" id="oil-sub-close"><i data-lucide="x"></i></button>
            </div>
            <div class="ios-sheet-content">
              <div style="display:flex;flex-direction:column;gap:var(--space-md);">
                <div>
                  <label style="font-size:var(--font-size-footnote);font-weight:500;color:var(--text-secondary);display:block;margin-bottom:6px;">Фирма</label>
                  <input id="oil-sub-brand" type="text" placeholder="Например, Mobil, Castrol…" value="${escapeHtml(oilDetails.brand)}"
                    style="width:100%;padding:12px 14px;border-radius:12px;border:0.5px solid var(--separator);background:var(--surface-2);color:var(--text);font-size:var(--font-size-body);box-sizing:border-box;outline:none;">
                </div>
                <div>
                  <label style="font-size:var(--font-size-footnote);font-weight:500;color:var(--text-secondary);display:block;margin-bottom:6px;">Вязкость</label>
                  <input id="oil-sub-viscosity" type="text" placeholder="Например, 5W-30, 0W-20…" value="${escapeHtml(oilDetails.viscosity)}"
                    style="width:100%;padding:12px 14px;border-radius:12px;border:0.5px solid var(--separator);background:var(--surface-2);color:var(--text);font-size:var(--font-size-body);box-sizing:border-box;outline:none;">
                </div>
                <div>
                  <label style="font-size:var(--font-size-footnote);font-weight:500;color:var(--text-secondary);display:block;margin-bottom:6px;">Объём (л)</label>
                  <input id="oil-sub-volume" type="number" placeholder="Например, 4.5" min="0" step="0.1" value="${escapeHtml(oilDetails.volume)}"
                    style="width:100%;padding:12px 14px;border-radius:12px;border:0.5px solid var(--separator);background:var(--surface-2);color:var(--text);font-size:var(--font-size-body);box-sizing:border-box;outline:none;">
                </div>
              </div>
              <div style="margin-top:var(--space-lg);display:flex;gap:var(--space-sm);">
                ${selected.has('oil') ? `<button class="ios-button" id="oil-sub-remove" style="flex:0 0 auto;">Снять</button>` : ''}
                <button class="ios-button ios-button-primary" id="oil-sub-confirm" style="flex:1;">Готово</button>
              </div>
            </div>
          </div>`;

        if (typeof lucide !== 'undefined') lucide.createIcons();

        function closeSubModal() {
          subModal.classList.remove('active');
          setTimeout(() => { if (subModal.parentNode) subModal.remove(); }, 300);
        }

        document.getElementById('oil-sub-close').addEventListener('click', closeSubModal);
        subModal.addEventListener('click', e => { if (e.target === subModal) closeSubModal(); });

        const removeBtn = document.getElementById('oil-sub-remove');
        if (removeBtn) {
          removeBtn.addEventListener('click', () => {
            selected.delete('oil');
            oilDetails.brand = ''; oilDetails.viscosity = ''; oilDetails.volume = '';
            closeSubModal();
            renderModal();
          });
        }

        document.getElementById('oil-sub-confirm').addEventListener('click', () => {
          oilDetails.brand = document.getElementById('oil-sub-brand').value;
          oilDetails.viscosity = document.getElementById('oil-sub-viscosity').value;
          oilDetails.volume = document.getElementById('oil-sub-volume').value;
          selected.add('oil');
          closeSubModal();
          renderModal();
        });

        requestAnimationFrame(() => subModal.classList.add('active'));
      }

      renderModal();
      requestAnimationFrame(() => modal.classList.add('active'));
    }

    // Maintenance category picker modal (multi-select)
    function showMaintenanceCategoryPicker() {
      if (!currentCarId) return;
      const car = state.cars.find(c => c.id === currentCarId);
      if (!car) return;

      const MAINT_CATS = [
        { typeKey: 'engineOil',      title: 'Моторное масло',         icon: 'droplets', color: '#FF9500', bg: 'rgba(255,149,0,0.15)' },
        { typeKey: 'oilFilter',      title: 'Фильтр масляный',        icon: 'filter',   color: '#FFCC00', bg: 'rgba(255,204,0,0.15)' },
        { typeKey: 'cabinFilter',    title: 'Фильтр салона',          icon: 'wind',     color: '#007AFF', bg: 'rgba(0,122,255,0.15)' },
        { typeKey: 'airFilter',      title: 'Фильтр двигателя',       icon: 'filter',   color: '#34C759', bg: 'rgba(52,199,89,0.15)' },
        { typeKey: 'fuelFilter',     title: 'Фильтр топливный',       icon: 'fuel',     color: '#FF6B35', bg: 'rgba(255,107,53,0.15)' },
        { typeKey: 'brakeDiscsFront',title: 'Диски передние',         icon: 'circle',   color: '#FF3B30', bg: 'rgba(255,59,48,0.15)' },
        { typeKey: 'brakeDiscsRear', title: 'Диски задние',           icon: 'circle',   color: '#C41E3A', bg: 'rgba(196,30,58,0.15)' },
        { typeKey: 'brakePadsFront', title: 'Колодки передние',       icon: 'square',   color: '#FF3B30', bg: 'rgba(255,59,48,0.15)' },
        { typeKey: 'brakePadsRear',  title: 'Колодки задние',         icon: 'square',   color: '#C41E3A', bg: 'rgba(196,30,58,0.15)' },
      ];

      const selected = new Set();
      const existingTypeKeys = new Set((car.servicePlan || []).map(p => p.typeKey).filter(Boolean));

      let modal = document.getElementById('maint-category-picker-modal');
      if (modal) modal.remove();
      modal = document.createElement('div');
      modal.id = 'maint-category-picker-modal';
      modal.className = 'ios-sheet-overlay';
      document.body.appendChild(modal);

      function closeModal() {
        modal.classList.remove('active');
        setTimeout(() => { if (modal.parentNode) modal.remove(); }, 300);
      }

      function renderModal() {
        modal.innerHTML = `
          <div class="ios-sheet">
            <div class="ios-sheet-handle"></div>
            <div class="ios-sheet-header">
              <div>
                <h2 style="font-size: var(--font-size-title-3); font-weight: 600; color: var(--text); margin: 0;">Добавить в ТО</h2>
                <p style="font-size: var(--font-size-subheadline); color: var(--text-secondary); margin: var(--space-xs) 0 0 0;">Выберите один или несколько пунктов</p>
              </div>
              <button class="ios-sheet-close" id="maint-cat-close"><i data-lucide="x"></i></button>
            </div>
            <div class="ios-sheet-content">
              <div class="expense-category-grid">
                ${MAINT_CATS.map(cat => {
                  const isExisting = existingTypeKeys.has(cat.typeKey);
                  const isSel = selected.has(cat.typeKey);
                  return `
                    <button class="expense-category-item" data-cat-key="${cat.typeKey}"
                      ${isExisting ? 'disabled' : ''}
                      style="position:relative;${isExisting ? 'opacity:0.4;' : ''}${isSel ? 'box-shadow:0 0 0 2px #34C759;border-radius:14px;' : ''}">
                      <div class="expense-category-icon" style="background:${cat.bg};color:${cat.color};">
                        <i data-lucide="${cat.icon}"></i>
                      </div>
                      <span>${escapeHtml(cat.title)}</span>
                      ${isSel ? '<div style="position:absolute;top:5px;right:5px;width:18px;height:18px;background:#34C759;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:1;"><i data-lucide="check" style="width:11px;height:11px;color:white;"></i></div>' : ''}
                      ${isExisting ? '<div style="position:absolute;top:5px;right:5px;width:18px;height:18px;background:#8E8E93;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:1;"><i data-lucide="check" style="width:11px;height:11px;color:white;"></i></div>' : ''}
                    </button>`;
                }).join('')}
              </div>
              <div style="margin-top:var(--space-lg);display:flex;gap:var(--space-sm);">
                <button class="ios-button" id="maint-cat-custom" style="flex:0 0 auto;">
                  <i data-lucide="pencil" style="width:16px;height:16px;margin-right:4px;vertical-align:middle;"></i>
                  Свой пункт
                </button>
                <button class="ios-button ios-button-primary" id="maint-cat-save" style="flex:1;"
                  ${selected.size === 0 ? 'disabled' : ''}>
                  Добавить${selected.size > 0 ? ' (' + selected.size + ')' : ''}
                </button>
              </div>
            </div>
          </div>`;

        if (typeof lucide !== 'undefined') lucide.createIcons();

        modal.querySelectorAll('[data-cat-key]').forEach(btn => {
          if (btn.disabled) return;
          btn.addEventListener('click', () => {
            const key = btn.dataset.catKey;
            if (selected.has(key)) selected.delete(key); else selected.add(key);
            renderModal();
          });
        });

        document.getElementById('maint-cat-close').addEventListener('click', closeModal);

        document.getElementById('maint-cat-custom').addEventListener('click', () => {
          closeModal();
          setTimeout(() => showPlanItemEditor(null), 320);
        });

        const saveBtn = document.getElementById('maint-cat-save');
        if (saveBtn && !saveBtn.disabled) {
          saveBtn.addEventListener('click', () => {
            let added = 0;
            selected.forEach(typeKey => {
              if (typeof MaintenancePlan !== 'undefined') {
                const item = MaintenancePlan.createPresetItem(typeKey);
                if (item) { MaintenancePlan.upsertPlanItem(car, item, state); added++; }
              }
            });
            if (added > 0 && saveAppState()) {
              showToast('Добавлено: ' + added + ' пункт' + (added > 1 ? (added < 5 ? 'а' : 'ов') : ''));
              closeModal();
              setTimeout(() => {
                showView('screen-maintenance-plan');
                renderMaintenancePlan();
              }, 320);
            }
          });
        }

        modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
      }

      renderModal();
      requestAnimationFrame(() => modal.classList.add('active'));
    }

    // Show plan item editor modal
    function showPlanItemEditor(itemId) {
      if (!currentCarId) return;
      const car = state.cars.find(c => c.id === currentCarId);
      if (!car) return;
      
      const planItems = car.servicePlan || [];
      const item = itemId ? planItems.find(p => p.id === itemId) : null;
      const isNew = !item;
      
      // Create or get modal
      let modal = document.getElementById('plan-item-editor-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'plan-item-editor-modal';
        modal.className = 'ios-sheet-overlay';
        modal.style.display = 'none';
        document.body.appendChild(modal);
      }
      
      modal.innerHTML = `
        <div class="ios-sheet">
          <div class="ios-sheet-header">
            <h2>${isNew ? 'Добавить пункт' : 'Редактировать пункт'}</h2>
            <button class="ios-sheet-close" data-close-plan-editor>
              <i data-lucide="x"></i>
            </button>
          </div>
          <div class="ios-sheet-content">
            <div class="field">
              <label>Название *</label>
              <input type="text" id="plan-item-title" placeholder="Например: Масло двигателя" value="${item ? escapeHtml(item.title) : ''}">
            </div>
            <div class="field">
              <label>Интервал по пробегу (км)</label>
              <input type="number" id="plan-item-interval-km" placeholder="10000" value="${item && item.intervalKm !== null ? item.intervalKm : ''}">
            </div>
            <div class="field">
              <label>Интервал по времени (месяцев)</label>
              <input type="number" id="plan-item-interval-months" placeholder="12" value="${item && item.intervalMonths !== null ? item.intervalMonths : ''}">
            </div>
            <div class="field">
              <label>Напоминать за (км до срока)</label>
              <input type="number" id="plan-item-remind-km" placeholder="1000" value="${item && item.remindBeforeKm !== null ? item.remindBeforeKm : ''}">
            </div>
            <div class="field">
              <label>Напоминать за (дней до срока)</label>
              <input type="number" id="plan-item-remind-days" placeholder="14" value="${item && item.remindBeforeDays !== null ? item.remindBeforeDays : ''}">
            </div>
            <div class="field">
              <label>Последнее обслуживание - пробег (км)</label>
              <input type="number" id="plan-item-last-odo" placeholder="0" value="${item && item.lastServiceOdometer !== null ? item.lastServiceOdometer : ''}">
            </div>
            <div class="field">
              <label>Последнее обслуживание - дата</label>
              <input type="date" id="plan-item-last-date" value="${item && item.lastServiceDate ? item.lastServiceDate.split('T')[0] : ''}">
            </div>
            <div class="field" style="display: flex; align-items: center; gap: var(--space-sm);">
              <input type="checkbox" id="plan-item-enabled" ${item && item.enabled !== false ? 'checked' : ''}>
              <label for="plan-item-enabled" style="margin: 0;">Включено</label>
            </div>
            <div class="field">
              <label>Заметки</label>
              <textarea id="plan-item-notes" placeholder="Дополнительная информация" rows="3">${item && item.notes ? escapeHtml(item.notes) : ''}</textarea>
            </div>
            ${!isNew ? `
            <div style="margin-top: var(--space-lg);">
              <button class="ios-button" style="width: 100%; color: var(--destructive);" data-delete-plan-item="${itemId}">
                Удалить пункт
              </button>
            </div>
            ` : ''}
            <div style="margin-top: var(--space-lg); display: flex; gap: var(--space-sm);">
              <button class="ios-button" style="flex: 1;" data-close-plan-editor>Отмена</button>
              <button class="ios-button ios-button-primary" style="flex: 1;" data-save-plan-item>Сохранить</button>
            </div>
          </div>
        </div>
      `;
      
      modal.style.display = 'block';
      setTimeout(() => modal.classList.add('active'), 10);
      
      if (typeof lucide !== 'undefined') lucide.createIcons();
      
      // Close handlers
      modal.querySelectorAll('[data-close-plan-editor]').forEach(btn => {
        btn.addEventListener('click', () => {
          modal.classList.remove('active');
          setTimeout(() => {
            modal.style.display = 'none';
          }, 300);
        });
      });
      
      // Delete handler
      const deleteBtn = modal.querySelector('[data-delete-plan-item]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          const deleteItemId = deleteBtn.dataset.deletePlanItem;
          showModal('Удалить пункт?', 'Это действие нельзя отменить.', () => {
            if (typeof MaintenancePlan !== 'undefined' && MaintenancePlan.deletePlanItem) {
              MaintenancePlan.deletePlanItem(car, deleteItemId, state);
              if (saveAppState()) {
                showToast('Пункт удален');
                modal.classList.remove('active');
                setTimeout(() => {
                  modal.style.display = 'none';
                }, 300);
                renderMaintenancePlan();
              }
            }
          });
        });
      }
      
      // Save handler
      const saveBtn = modal.querySelector('[data-save-plan-item]');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          const title = document.getElementById('plan-item-title').value.trim();
          if (!title) {
            showToast('Введите название');
            return;
          }
          
          const planItem = {
            id: itemId || 'plan-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            typeKey: item ? item.typeKey : null,
            title: title,
            intervalKm: document.getElementById('plan-item-interval-km').value ? parseInt(document.getElementById('plan-item-interval-km').value) : null,
            intervalMonths: document.getElementById('plan-item-interval-months').value ? parseInt(document.getElementById('plan-item-interval-months').value) : null,
            remindBeforeKm: document.getElementById('plan-item-remind-km').value ? parseInt(document.getElementById('plan-item-remind-km').value) : null,
            remindBeforeDays: document.getElementById('plan-item-remind-days').value ? parseInt(document.getElementById('plan-item-remind-days').value) : null,
            lastServiceOdometer: document.getElementById('plan-item-last-odo').value ? parseFloat(document.getElementById('plan-item-last-odo').value) : null,
            lastServiceDate: document.getElementById('plan-item-last-date').value || null,
            enabled: document.getElementById('plan-item-enabled').checked,
            notes: document.getElementById('plan-item-notes').value.trim() || null
          };
          
          if (typeof MaintenancePlan !== 'undefined' && MaintenancePlan.upsertPlanItem) {
            MaintenancePlan.upsertPlanItem(car, planItem, state);
            if (saveAppState()) {
              showToast(isNew ? 'Пункт добавлен' : 'Пункт обновлен');
              modal.classList.remove('active');
              setTimeout(() => {
                modal.style.display = 'none';
              }, 300);
              renderMaintenancePlan();
            }
          }
        });
      }
      
      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
          setTimeout(() => {
            modal.style.display = 'none';
          }, 300);
        }
      });
    }
    
    // Initialize car detail tabs
    function initializeCarTabs() {
      const tabs = document.querySelectorAll('.car-tab');
      const tabContents = document.querySelectorAll('.car-tab-content');
      
      tabs.forEach(tab => {
        tab.onclick = null; // Remove old listeners
        tab.addEventListener('click', () => {
          const targetTab = tab.dataset.tab;
          
          // Update tab styles
          tabs.forEach(t => {
            t.classList.remove('active');
            t.style.borderBottomColor = 'transparent';
            t.style.color = 'var(--text-secondary)';
            t.style.fontWeight = '400';
          });
          tab.classList.add('active');
          tab.style.borderBottomColor = 'var(--primary)';
          tab.style.color = 'var(--primary)';
          tab.style.fontWeight = '600';
          
          // Show/hide tab contents
          tabContents.forEach(content => {
            content.style.display = 'none';
            content.classList.remove('active');
          });
          const targetContent = document.getElementById(`tab-${targetTab}`);
          if (targetContent) {
            targetContent.style.display = 'block';
            targetContent.classList.add('active');
          }
        });
      });
      
      // Add fuel button handler
      const addFuelBtn = document.getElementById('add-fuel-entry-btn');
      if (addFuelBtn) {
        addFuelBtn.onclick = null;
        addFuelBtn.addEventListener('click', () => {
          showView('screen-add-fuel');
        });
      }
      
      // Add service button handler
      const addServiceBtn = document.getElementById('add-service-entry-btn');
      if (addServiceBtn) {
        addServiceBtn.onclick = null;
        addServiceBtn.addEventListener('click', () => {
          showView('screen-add-service');
        });
      }
    }
    
    // Render fuel tab
    function renderFuelTab(carId) {
      const fuelList = document.getElementById('fuel-entries-list');
      const fuelEmpty = document.getElementById('fuel-empty');
      const fuelStats = document.getElementById('fuel-stats');
      if(!fuelList) return;
      
      // Get fuel entries for this car
      const fuelEntries = (state.fuel || []).filter(f => f.carId === carId && !f.deletedAt)
        .sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateB - dateA;
        });
      
      if(fuelEntries.length === 0) {
        fuelList.innerHTML = '';
        if(fuelEmpty) fuelEmpty.style.display = 'block';
        if(fuelStats) fuelStats.innerHTML = '';
        return;
      }
      
      if(fuelEmpty) fuelEmpty.style.display = 'none';
      
      // Calculate and render stats
      if(fuelStats && typeof Fuel !== 'undefined' && Fuel.getStats) {
        const stats = Fuel.getStats(carId, fuelEntries);
        fuelStats.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-md); margin-bottom: var(--space-md);">
            <div style="padding: var(--space-md); background: var(--surface); border-radius: var(--radius-md);">
              <div style="font-size: var(--font-size-subheadline); color: var(--text-secondary); margin-bottom: var(--space-xs);">Последний расход</div>
              <div style="font-size: var(--font-size-title-2); font-weight: 600; color: var(--text);">
                ${stats.lastConsumption ? stats.lastConsumption.toFixed(2) : '—'} L/100km
              </div>
            </div>
            <div style="padding: var(--space-md); background: var(--surface); border-radius: var(--radius-md);">
              <div style="font-size: var(--font-size-subheadline); color: var(--text-secondary); margin-bottom: var(--space-xs);">Средний (30 дней)</div>
              <div style="font-size: var(--font-size-title-2); font-weight: 600; color: var(--text);">
                ${stats.avg30Days ? stats.avg30Days.toFixed(2) : '—'} L/100km
              </div>
            </div>
            <div style="padding: var(--space-md); background: var(--surface); border-radius: var(--radius-md);">
              <div style="font-size: var(--font-size-subheadline); color: var(--text-secondary); margin-bottom: var(--space-xs);">Средний (90 дней)</div>
              <div style="font-size: var(--font-size-title-2); font-weight: 600; color: var(--text);">
                ${stats.avg90Days ? stats.avg90Days.toFixed(2) : '—'} L/100km
              </div>
            </div>
            <div style="padding: var(--space-md); background: var(--surface); border-radius: var(--radius-md);">
              <div style="font-size: var(--font-size-subheadline); color: var(--text-secondary); margin-bottom: var(--space-xs);">Всего потрачено</div>
              <div style="font-size: var(--font-size-title-2); font-weight: 600; color: var(--text);">
                ${stats.totalSpent.toLocaleString('ru-RU', {minimumFractionDigits: 2})} ₴
              </div>
            </div>
          </div>
        `;
      }
      
      // Render fuel entries
      fuelList.innerHTML = '';
      const group = document.createElement('div');
      group.className = 'ios-group';
      
      fuelEntries.forEach(fuel => {
        const cell = document.createElement('div');
        cell.className = 'ios-cell';
        const date = new Date(fuel.date);
        const pricePerLiter = fuel.liters > 0 ? (fuel.totalCost / fuel.liters).toFixed(2) : '0.00';
        cell.innerHTML = `
          <div class="ios-cell-icon">
            <i data-lucide="fuel"></i>
          </div>
          <div class="ios-cell-content">
            <div class="ios-cell-title">${fuel.liters.toFixed(2)} л ${fuel.fullTank ? '• Полный бак' : ''}</div>
            <div class="ios-cell-subtitle">
              ${fuel.odometer ? fuel.odometer + ' км • ' : ''}
              ${pricePerLiter} ₴/л • 
              ${fuel.totalCost.toLocaleString('ru-RU', {minimumFractionDigits: 2})} ₴
              ${fuel.station ? ' • ' + escapeHtml(fuel.station) : ''}
            </div>
            <div class="ios-cell-subtitle" style="margin-top: var(--space-xs); color: var(--text-secondary);">
              ${date.toLocaleDateString('ru-RU')}
            </div>
          </div>
          <div class="ios-cell-trailing">
            <button class="ios-cell-action-btn" data-edit-fuel="${fuel.id}" title="Редактировать">
              <i data-lucide="pencil"></i>
            </button>
            <button class="ios-cell-action-btn" data-delete-fuel="${fuel.id}" title="Удалить">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `;
        group.appendChild(cell);
      });
      
      fuelList.appendChild(group);
      if(typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    // Render service tab
    function renderServiceTab(carId) {
      const serviceList = document.getElementById('service-entries-list');
      const serviceEmpty = document.getElementById('service-empty');
      const serviceStats = document.getElementById('service-stats');
      if(!serviceList) return;
      
      // Get service records for this car
      const serviceRecords = (state.service || []).filter(s => s.carId === carId && !s.deletedAt)
        .sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateB - dateA;
        });
      
      if(serviceRecords.length === 0) {
        serviceList.innerHTML = '';
        if(serviceEmpty) serviceEmpty.style.display = 'block';
        if(serviceStats) serviceStats.innerHTML = '';
        return;
      }
      
      if(serviceEmpty) serviceEmpty.style.display = 'none';
      
      // Calculate and render stats
      if(serviceStats && typeof Service !== 'undefined' && Service.getStats) {
        const stats = Service.getStats(serviceRecords);
        serviceStats.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-md); margin-bottom: var(--space-md);">
            <div style="padding: var(--space-md); background: var(--surface); border-radius: var(--radius-md);">
              <div style="font-size: var(--font-size-subheadline); color: var(--text-secondary); margin-bottom: var(--space-xs);">Всего записей</div>
              <div style="font-size: var(--font-size-title-2); font-weight: 600; color: var(--text);">
                ${stats.totalRecords}
              </div>
            </div>
            <div style="padding: var(--space-md); background: var(--surface); border-radius: var(--radius-md);">
              <div style="font-size: var(--font-size-subheadline); color: var(--text-secondary); margin-bottom: var(--space-xs);">Всего потрачено</div>
              <div style="font-size: var(--font-size-title-2); font-weight: 600; color: var(--text);">
                ${stats.totalSpent.toLocaleString('ru-RU', {minimumFractionDigits: 2})} ₴
              </div>
            </div>
          </div>
        `;
      }
      
      // Render service records
      serviceList.innerHTML = '';
      const group = document.createElement('div');
      group.className = 'ios-group';
      
      serviceRecords.forEach(service => {
        const cell = document.createElement('div');
        cell.className = 'ios-cell';
        const date = new Date(service.date);
        cell.innerHTML = `
          <div class="ios-cell-icon">
            <i data-lucide="wrench"></i>
          </div>
          <div class="ios-cell-content">
            <div class="ios-cell-title">${escapeHtml(service.typeLabel || service.type || 'Сервис')}</div>
            <div class="ios-cell-subtitle">
              ${service.odometer ? service.odometer + ' км • ' : ''}
              ${service.cost.toLocaleString('ru-RU', {minimumFractionDigits: 2})} ₴
              ${service.shop ? ' • ' + escapeHtml(service.shop) : ''}
            </div>
            <div class="ios-cell-subtitle" style="margin-top: var(--space-xs); color: var(--text-secondary);">
              ${date.toLocaleDateString('ru-RU')}
            </div>
          </div>
          <div class="ios-cell-trailing">
            <button class="ios-cell-action-btn" data-edit-service="${service.id}" title="Редактировать">
              <i data-lucide="pencil"></i>
            </button>
            <button class="ios-cell-action-btn" data-delete-service="${service.id}" title="Удалить">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `;
        group.appendChild(cell);
      });
      
      serviceList.appendChild(group);
      if(typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    // Render service tab with schedule and due logic
    function renderServiceTab(carId) {
      const serviceList = document.getElementById('service-entries-list');
      const serviceEmpty = document.getElementById('service-empty');
      const serviceSchedule = document.getElementById('service-schedule');
      const serviceStats = document.getElementById('service-stats');
      
      if (!serviceList || !serviceEmpty) return;
      
      const serviceRecords = (state.service || []).filter(s => s.carId === carId && !s.deletedAt)
        .sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateB - dateA;
        });
      
      // Render service schedule with due logic
      if (serviceSchedule && typeof Service !== 'undefined' && Service.getDefaultIntervals && Service.checkDue) {
        const defaultIntervals = Service.getDefaultIntervals();
        const carIntervals = state.intervals[carId] || {};
        const intervals = { ...defaultIntervals, ...carIntervals };
        
        // Get current odometer (max from all entries)
        const allEntries = [
          ...(state.expenses || []).filter(e => e.carId === carId && e.odometer),
          ...(state.fuel || []).filter(f => f.carId === carId && f.odometer && !f.deletedAt),
          ...serviceRecords.filter(s => s.odometer)
        ];
        const currentOdometer = allEntries.length > 0 ? 
          Math.max(...allEntries.map(e => parseFloat(e.odometer) || 0)) : 0;
        const currentDate = new Date();
        
        // Build schedule items
        const scheduleItems = [];
        Object.keys(intervals).forEach(serviceType => {
          const interval = intervals[serviceType];
          if (!interval || (!interval.intervalKm && !interval.intervalMonths)) return;
          
          // Find last record of this type
          const lastRecord = serviceRecords
            .filter(s => s.type === serviceType)
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
          
          const dueCheck = Service.checkDue(serviceType, lastRecord, { [serviceType]: interval }, currentOdometer, currentDate);
          
          scheduleItems.push({
            type: serviceType,
            typeLabel: Service.TYPES[serviceType] || serviceType,
            interval,
            lastRecord,
            due: dueCheck
          });
        });
        
        // Sort: due first, then soon, then ok
        scheduleItems.sort((a, b) => {
          const order = { 'due': 0, 'soon': 1, 'ok': 2 };
          return (order[a.due.status] || 2) - (order[b.due.status] || 2);
        });
        
        if (scheduleItems.length > 0) {
          serviceSchedule.innerHTML = '';
          const group = document.createElement('div');
          group.className = 'ios-group';
          const header = document.createElement('div');
          header.className = 'ios-group-header';
          header.textContent = 'Расписание обслуживания';
          group.appendChild(header);
          
          scheduleItems.forEach(item => {
            const cell = document.createElement('div');
            cell.className = 'ios-cell';
            let statusColor = 'var(--text-secondary)';
            let statusIcon = 'check-circle';
            if (item.due.status === 'due') {
              statusColor = 'var(--destructive)';
              statusIcon = 'alert-circle';
            } else if (item.due.status === 'soon') {
              statusColor = 'var(--warning)';
              statusIcon = 'clock';
            }
            
            const lastDoneText = item.lastRecord ? 
              `Последний раз: ${new Date(item.lastRecord.date).toLocaleDateString('ru-RU')} (${item.lastRecord.odometer} км)` :
              'Никогда не выполнялось';
            
            cell.innerHTML = `
              <div class="ios-cell-icon" style="color: ${statusColor};">
                <i data-lucide="${statusIcon}"></i>
              </div>
              <div class="ios-cell-content">
                <div class="ios-cell-title">${escapeHtml(item.typeLabel)}</div>
                <div class="ios-cell-subtitle">${escapeHtml(item.due.message)}</div>
                <div class="ios-cell-subtitle" style="margin-top: var(--space-xs); color: var(--text-secondary); font-size: var(--font-size-caption);">
                  ${lastDoneText}
                </div>
              </div>
              <div class="ios-cell-trailing">
                ${item.due.status === 'due' || item.due.status === 'soon' ? 
                  `<button class="ios-cell-action-btn" data-snooze-service="${item.type}" title="Отложить" style="color: var(--warning);">
                    <i data-lucide="clock"></i>
                  </button>` : ''}
              </div>
            `;
            group.appendChild(cell);
          });
          
          serviceSchedule.appendChild(group);
        } else {
          serviceSchedule.innerHTML = '';
        }
      }
      
      // Calculate and render stats
      if(serviceStats && typeof Service !== 'undefined' && Service.getStats) {
        const stats = Service.getStats(carId, serviceRecords);
        serviceStats.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-md); margin-bottom: var(--space-md);">
            <div style="padding: var(--space-md); background: var(--surface); border-radius: var(--radius-md);">
              <div style="font-size: var(--font-size-subheadline); color: var(--text-secondary); margin-bottom: var(--space-xs);">Всего записей</div>
              <div style="font-size: var(--font-size-title-2); font-weight: 600; color: var(--text);">
                ${stats.recordsCount || serviceRecords.length}
              </div>
            </div>
            <div style="padding: var(--space-md); background: var(--surface); border-radius: var(--radius-md);">
              <div style="font-size: var(--font-size-subheadline); color: var(--text-secondary); margin-bottom: var(--space-xs);">Всего потрачено</div>
              <div style="font-size: var(--font-size-title-2); font-weight: 600; color: var(--text);">
                ${(stats.totalSpent || 0).toLocaleString('ru-RU', {minimumFractionDigits: 2})} ₴
              </div>
            </div>
          </div>
        `;
      }
      
      if (serviceRecords.length === 0) {
        serviceList.innerHTML = '';
        serviceEmpty.style.display = 'block';
        return;
      }
      
      serviceEmpty.style.display = 'none';
      
      // Render service records
      serviceList.innerHTML = '';
      const group = document.createElement('div');
      group.className = 'ios-group';
      
      serviceRecords.forEach(service => {
        const cell = document.createElement('div');
        cell.className = 'ios-cell';
        const date = new Date(service.date);
        cell.innerHTML = `
          <div class="ios-cell-icon">
            <i data-lucide="wrench"></i>
          </div>
          <div class="ios-cell-content">
            <div class="ios-cell-title">${escapeHtml(service.typeLabel || service.type || 'Сервис')}</div>
            <div class="ios-cell-subtitle">
              ${service.odometer ? service.odometer + ' км • ' : ''}
              ${service.cost.toLocaleString('ru-RU', {minimumFractionDigits: 2})} ₴
              ${service.shop ? ' • ' + escapeHtml(service.shop) : ''}
            </div>
            <div class="ios-cell-subtitle" style="margin-top: var(--space-xs); color: var(--text-secondary);">
              ${date.toLocaleDateString('ru-RU')}
            </div>
          </div>
          <div class="ios-cell-trailing">
            <button class="ios-cell-action-btn" data-edit-service="${service.id}" title="Редактировать">
              <i data-lucide="pencil"></i>
            </button>
            <button class="ios-cell-action-btn" data-delete-service="${service.id}" title="Удалить">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `;
        group.appendChild(cell);
      });
      
      serviceList.appendChild(group);
      if(typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ── Car Passport ─────────────────────────────────────────────
    function renderCarPassport(carId) {
      const car = state.cars.find(c => c.id === carId);
      if (!car) return;

      const nameEl = document.getElementById('passport-car-name');
      if (nameEl) nameEl.textContent = car.name || 'Паспорт';

      const content = document.getElementById('passport-content');
      if (!content) return;

      // Current odometer
      const allOdoEntries = [
        ...(state.expenses || []).filter(e => e.carId === carId && e.odometer && !e.deletedAt),
        ...(state.fuel    || []).filter(f => f.carId === carId && f.odometer && !f.deletedAt),
        ...(state.service || []).filter(s => s.carId === carId && s.odometer && !s.deletedAt)
      ];
      const currentOdo = allOdoEntries.length > 0
        ? Math.max(...allOdoEntries.map(e => parseFloat(e.odometer) || 0))
        : (car.currentOdometer || 0);

      function fmtDate(d) {
        if (!d) return '—';
        try {
          const dt = new Date(d);
          return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch { return '—'; }
      }
      function fmtOdo(v) {
        const n = parseFloat(v);
        return (n && n > 0) ? n.toLocaleString('ru-RU') + ' км' : '—';
      }
      function daysUntil(dateStr) {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        return Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
      }
      function statusDot(status) {
        const colors = { overdue: '#FF3B30', soon: '#FF9500', ok: '#34C759' };
        return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[status]||colors.ok};margin-right:6px;flex-shrink:0;"></span>`;
      }

      // ── Section helper ────────────────────────────────────────
      function section(title, icon, rows) {
        const rowsHtml = rows.map(r => {
          const dotHtml = r.status ? statusDot(r.status) : '';
          return `
            <div style="display:grid;grid-template-columns:1fr auto auto;gap:var(--space-sm);align-items:start;padding:var(--space-sm) 0;border-bottom:0.5px solid var(--separator);">
              <div style="font-size:var(--font-size-footnote);color:var(--text);display:flex;align-items:center;">${dotHtml}${r.name}</div>
              <div style="text-align:right;min-width:90px;">
                <div style="font-size:var(--font-size-caption-1);color:var(--text-tertiary);margin-bottom:2px;">Последняя</div>
                <div style="font-size:var(--font-size-footnote);color:var(--text-secondary);">${r.lastOdo}</div>
                <div style="font-size:var(--font-size-caption-1);color:var(--text-tertiary);">${r.lastDate}</div>
              </div>
              <div style="text-align:right;min-width:90px;">
                <div style="font-size:var(--font-size-caption-1);color:var(--text-tertiary);margin-bottom:2px;">Следующая</div>
                <div style="font-size:var(--font-size-footnote);font-weight:600;color:${r.status==='overdue'?'#FF3B30':r.status==='soon'?'#FF9500':'var(--text)'};">${r.nextOdo}</div>
                <div style="font-size:var(--font-size-caption-1);color:${r.status==='overdue'?'#FF3B30':r.status==='soon'?'#FF9500':'var(--text-tertiary)'};">${r.nextDate}</div>
              </div>
            </div>`;
        }).join('');
        return `
          <div style="background:var(--surface);border-radius:var(--radius-lg);padding:var(--space-md) var(--space-md);margin-bottom:var(--space-md);">
            <div style="display:flex;align-items:center;gap:var(--space-xs);margin-bottom:var(--space-sm);padding-bottom:var(--space-sm);border-bottom:1px solid var(--separator);">
              <i data-lucide="${icon}" style="width:16px;height:16px;color:var(--primary);flex-shrink:0;"></i>
              <span style="font-size:var(--font-size-subheadline);font-weight:600;color:var(--text);">${title}</span>
            </div>
            ${rowsHtml || '<div style="color:var(--text-tertiary);font-size:var(--font-size-footnote);padding:var(--space-sm) 0;">Нет данных</div>'}
          </div>`;
      }

      // ── Compute insurance info early (needed for header) ────────
      const insuranceExpenses = (state.expenses || [])
        .filter(e => e.carId === carId && !e.deletedAt && (
          e.categoryId === 'cat-insurance' ||
          e.category === 'insurance' ||
          e.category === 'ОСАГО / КАСКО'
        ))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      let insLabel = '—', insStatus = null, insColor = 'var(--text-secondary)';
      if (insuranceExpenses.length > 0) {
        const lastIns = insuranceExpenses[0];
        const expiryDate = lastIns.validUntil
          ? lastIns.validUntil
          : (() => { const d = new Date(lastIns.date); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split('T')[0]; })();
        const days = daysUntil(expiryDate);
        insLabel = fmtDate(expiryDate);
        if (days !== null && days < 0) { insStatus = 'overdue'; insColor = '#FF3B30'; insLabel = `истекла ${Math.abs(days)} дн. назад`; }
        else if (days !== null && days <= 30) { insStatus = 'soon'; insColor = '#FF9500'; insLabel = `через ${days} дн. (${fmtDate(expiryDate)})`; }
        else { insStatus = 'ok'; insColor = '#34C759'; }
      }

      let html = '';

      // ── 1. Current odometer + insurance header ────────────────
      html += `
        <div style="background:var(--surface);border-radius:var(--radius-lg);padding:var(--space-md);margin-bottom:var(--space-md);display:grid;grid-template-columns:1fr 1fr;gap:var(--space-xs);">
          <div>
            <div style="font-size:var(--font-size-caption-1);color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Пробег</div>
            <div style="font-size:var(--font-size-title-3);font-weight:700;color:var(--text);">${currentOdo > 0 ? currentOdo.toLocaleString('ru-RU') + ' км' : '—'}</div>
          </div>
          <div style="border-left:0.5px solid var(--separator);padding-left:var(--space-md);">
            <div style="font-size:var(--font-size-caption-1);color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Страховка</div>
            <div style="font-size:var(--font-size-footnote);font-weight:600;color:${insColor};display:flex;align-items:center;gap:4px;">
              ${insStatus ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${insColor};flex-shrink:0;"></span>` : ''}
              ${insLabel}
            </div>
          </div>
        </div>`;

      // ── 2. Unified maintenance list ───────────────────────────
      {
        // Master ordered list with default intervals
        const MAINT_LIST = [
          { key: 'oil',              label: 'Замена масла',                      planKey: 'engineOil',      intervalKm: 10000, intervalMonths: 12 },
          { key: 'oilFilter',        label: 'Замена масляного фильтра',           planKey: 'oilFilter',      intervalKm: 10000, intervalMonths: 12 },
          { key: 'airFilter',        label: 'Замена воздушного фильтра',          planKey: 'airFilter',      intervalKm: 30000, intervalMonths: 24 },
          { key: 'cabinFilter',      label: 'Замена салонного фильтра',           planKey: 'cabinFilter',    intervalKm: 20000, intervalMonths: 12 },
          { key: 'fuelFilter',       label: 'Замена топливного фильтра',          planKey: 'fuelFilter',     intervalKm: 60000, intervalMonths: 36 },
          { key: 'brakePadsFront',   label: 'Замена передних тормозных колодок',  planKey: 'brakePadsFront', intervalKm: 40000, intervalMonths: 36 },
          { key: 'brakePadsRear',    label: 'Замена задних тормозных колодок',    planKey: 'brakePadsRear',  intervalKm: 60000, intervalMonths: 48 },
          { key: 'brakeDiscsFront',  label: 'Замена передних тормозных дисков',   planKey: 'brakeDiscsFront',intervalKm: 80000, intervalMonths: 60 },
          { key: 'brakeDiscsRear',   label: 'Замена задних тормозных дисков',     planKey: 'brakeDiscsRear', intervalKm:100000, intervalMonths: 72 },
          { key: 'brakeFluid',       label: 'Тормозная жидкость',                 planKey: 'brakeFluid',     intervalKm: 60000, intervalMonths: 24 },
          { key: 'transmissionOil',  label: 'Масло АКПП',                         planKey: 'transmissionOil',intervalKm: 60000, intervalMonths: 60 },
          { key: 'sparkPlugs',       label: 'Свечи зажигания/Накаливания',        planKey: 'sparkPlugs',     intervalKm: 60000, intervalMonths: 60 },
          { key: 'coolant',          label: 'Охлаждающая жидкость',               planKey: 'coolant',        intervalKm: 60000, intervalMonths: 24 },
          { key: 'powerSteeringOil', label: 'Замена жидкости ГУР',                planKey: 'powerSteeringOil',intervalKm:60000, intervalMonths: 36 },
          { key: 'timingBelt',       label: 'Ремень/Цепь ГРМ',                   planKey: 'timingBelt',     intervalKm:100000, intervalMonths: 60 },
          { key: 'frontDiffOil',     label: 'Масло переднего редуктора',           planKey: null,             intervalKm: 80000, intervalMonths: 48 },
          { key: 'rearDiffOil',      label: 'Масло заднего редуктора',             planKey: null,             intervalKm: 80000, intervalMonths: 48 },
          { key: 'transferCaseOil',  label: 'Масло раздаточной коробки',           planKey: null,             intervalKm: 80000, intervalMonths: 48 },
        ];

        const svcRecords = (state.service || []).filter(s => s.carId === carId && s.type !== 'wheels' && !s.deletedAt);
        const carIntervals = state.intervals[carId] || {};

        const unifiedRows = MAINT_LIST.map(item => {
          // Get interval: prefer car's custom interval, then plan item, then default
          let intervalKm = item.intervalKm;
          let intervalMonths = item.intervalMonths;
          if (carIntervals[item.key]) {
            intervalKm = carIntervals[item.key].intervalKm || intervalKm;
            intervalMonths = carIntervals[item.key].intervalMonths || intervalMonths;
          }
          if (item.planKey && car.servicePlan) {
            const planItem = car.servicePlan.find(p => p.typeKey === item.planKey);
            if (planItem) {
              if (planItem.intervalKm) intervalKm = planItem.intervalKm;
              if (planItem.intervalMonths) intervalMonths = planItem.intervalMonths;
            }
          }

          // Last service record
          const lastRec = svcRecords.filter(s => s.type === item.key)
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

          // Also check servicePlan for last service info (may have been recorded via plan UI)
          let lastOdoVal = lastRec ? parseFloat(lastRec.odometer) || 0 : 0;
          let lastDateVal = lastRec ? lastRec.date : null;
          if (item.planKey && car.servicePlan) {
            const planItem = car.servicePlan.find(p => p.typeKey === item.planKey);
            if (planItem && planItem.lastServiceDate) {
              // Use the more recent of the two
              const planDate = new Date(planItem.lastServiceDate);
              const recDate = lastRec ? new Date(lastRec.date) : new Date(0);
              if (planDate >= recDate) {
                lastOdoVal = parseFloat(planItem.lastServiceOdometer) || lastOdoVal;
                lastDateVal = planItem.lastServiceDate;
              }
            }
          }

          const hasData = lastDateVal !== null || lastOdoVal > 0;

          // Compute next due
          const nextOdoVal = hasData && lastOdoVal > 0 && intervalKm ? lastOdoVal + intervalKm : null;
          const nextDateVal = hasData && lastDateVal && intervalMonths
            ? (() => { const d = new Date(lastDateVal); d.setMonth(d.getMonth() + intervalMonths); return d; })()
            : null;

          // Status
          let status = hasData ? 'ok' : null;
          if (hasData) {
            const overdueKm = nextOdoVal !== null && currentOdo >= nextOdoVal;
            const overdueDate = nextDateVal !== null && new Date() >= nextDateVal;
            const soonKm = nextOdoVal !== null && !overdueKm && currentOdo >= nextOdoVal - Math.round(intervalKm * 0.1);
            const soonDate = nextDateVal !== null && !overdueDate && (new Date() >= new Date(nextDateVal.getTime() - 14 * 86400000));
            if (overdueKm || overdueDate) status = 'overdue';
            else if (soonKm || soonDate) status = 'soon';
          }

          function coloredVal(val, st) {
            if (st === 'overdue') return `<span style="color:#FF3B30;">${val}</span>`;
            if (st === 'soon')    return `<span style="color:#FF9500;">${val}</span>`;
            return val;
          }

          let nextOdoHtml = nextOdoVal ? coloredVal(fmtOdo(nextOdoVal), status) : '—';
          let nextDateHtml = nextDateVal ? coloredVal(fmtDate(nextDateVal), status) : '—';

          if (status === 'overdue' && nextOdoVal && currentOdo >= nextOdoVal) {
            const over = currentOdo - nextOdoVal;
            nextOdoHtml = `<span style="color:#FF3B30;">+${over.toLocaleString('ru-RU')} км</span>`;
          }

          return {
            name: item.label,
            status,
            lastOdo: lastOdoVal > 0 ? fmtOdo(lastOdoVal) : '—',
            lastDate: fmtDate(lastDateVal),
            nextOdo: nextOdoHtml,
            nextDate: nextDateHtml
          };
        });

        html += section('Обслуживание', 'wrench', unifiedRows);
      }

      // ── 3. Battery ────────────────────────────────────────────
      {
        const batteryRecords = (state.service || [])
          .filter(s => s.carId === carId && s.type === 'battery' && !s.deletedAt)
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastBat = batteryRecords[0] || null;
        const batIntervalMonths = 36;
        const nextBatDate = lastBat
          ? (() => { const d = new Date(lastBat.date); d.setMonth(d.getMonth() + batIntervalMonths); return d; })()
          : null;
        const batDays = nextBatDate ? daysUntil(nextBatDate) : null;
        let batStatus = lastBat ? 'ok' : null;
        if (lastBat && batDays !== null) {
          if (batDays < 0) batStatus = 'overdue';
          else if (batDays <= 30) batStatus = 'soon';
        }
        function batColor(st) {
          if (st === 'overdue') return '#FF3B30';
          if (st === 'soon') return '#FF9500';
          return 'var(--text)';
        }
        const batLabel = lastBat
          ? (lastBat.notes || lastBat.shop || 'Аккумулятор')
          : 'Аккумулятор';
        const batHtml = `
          <div style="background:var(--surface);border-radius:var(--radius-lg);padding:var(--space-md);margin-bottom:var(--space-md);">
            <div style="display:flex;align-items:center;gap:var(--space-xs);margin-bottom:var(--space-sm);padding-bottom:var(--space-sm);border-bottom:1px solid var(--separator);">
              <i data-lucide="battery-charging" style="width:16px;height:16px;color:var(--primary);flex-shrink:0;"></i>
              <span style="font-size:var(--font-size-subheadline);font-weight:600;color:var(--text);">Аккумулятор</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr auto auto;gap:var(--space-sm);align-items:start;padding:var(--space-xs) 0;">
              <div style="font-size:var(--font-size-footnote);color:var(--text);display:flex;align-items:center;">
                ${batStatus ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${batColor(batStatus)};margin-right:6px;flex-shrink:0;"></span>` : ''}
                ${batLabel}
              </div>
              <div style="text-align:right;min-width:90px;">
                <div style="font-size:var(--font-size-caption-1);color:var(--text-tertiary);margin-bottom:2px;">Установлен</div>
                <div style="font-size:var(--font-size-footnote);color:var(--text-secondary);">${fmtOdo(lastBat?.odometer)}</div>
                <div style="font-size:var(--font-size-caption-1);color:var(--text-tertiary);">${fmtDate(lastBat?.date)}</div>
              </div>
              <div style="text-align:right;min-width:90px;">
                <div style="font-size:var(--font-size-caption-1);color:var(--text-tertiary);margin-bottom:2px;">Замена рекоменд.</div>
                <div style="font-size:var(--font-size-footnote);font-weight:600;color:${batColor(batStatus)};">${nextBatDate ? fmtDate(nextBatDate) : '—'}</div>
                <div style="font-size:var(--font-size-caption-1);color:${batColor(batStatus)};">${batDays !== null ? (batDays < 0 ? `${Math.abs(batDays)} дн. назад` : `через ${batDays} дн.`) : '—'}</div>
              </div>
            </div>
          </div>`;
        html += batHtml;
      }

      // ── 4. Tires (летняя / зимняя резина) ────────────────────
      {
        const wheelRecords = (state.service || [])
          .filter(s => s.carId === carId && s.type === 'wheels' && !s.deletedAt)
          .sort((a, b) => new Date(b.date) - new Date(a.date));

        const lastSummer = wheelRecords.find(s => s.installType === 'summer');
        const lastWinter = wheelRecords.find(s => s.installType === 'winter');

        const tireRows = ['summer', 'winter'].map(season => {
          const rec = season === 'summer' ? lastSummer : lastWinter;
          const label = season === 'summer' ? 'Летняя' : 'Зимняя';
          if (!rec) {
            return { name: label, status: null, lastOdo: '—', lastDate: '—', nextOdo: '—', nextDate: '—' };
          }
          const recOdo = parseFloat(rec.odometer) || 0;
          const kmOnTire = currentOdo > recOdo ? currentOdo - recOdo : 0;
          const brand = rec.newTire?.brand || '';
          const size  = rec.newTire?.size  || '';
          const fullLabel = label + (brand ? ` • ${brand}` : '') + (size ? ` • ${size}` : '');
          return {
            name: fullLabel,
            status: 'ok',
            lastOdo: fmtOdo(rec.odometer),
            lastDate: fmtDate(rec.date),
            nextOdo: `пробег: ${kmOnTire.toLocaleString('ru-RU')} км`,
            nextDate: '—'
          };
        });

        html += section('Резина', 'circle', tireRows);
      }


      content.innerHTML = html;
      if (typeof lucide !== 'undefined') lucide.createIcons({ attrs: { 'stroke-width': 2 } });
    }

    // Reminders functions
    function renderReminders() {
      const container = document.getElementById('reminders-list');
      if(!container) return;
      
      container.innerHTML = '';
      
      // Render auto-reminders from maintenance plan
      if (typeof MaintenancePlan !== 'undefined') {
        const autoReminders = [];
        state.cars.filter(c => !c.deletedAt).forEach(car => {
          if (!car.servicePlan || car.servicePlan.length === 0) return;
          
          // Get current odometer for this car
          const carService = (state.service || []).filter(s => s.carId === car.id && !s.deletedAt);
          const carFuel = (state.fuel || []).filter(f => f.carId === car.id && !f.deletedAt);
          const carExpenses = (state.expenses || []).filter(e => e.carId === car.id && !e.deletedAt && e.odometer);
          
          let currentOdometer = 0;
          if (carService.length > 0) {
            const latest = carService.sort((a, b) => parseFloat(b.odometer || 0) - parseFloat(a.odometer || 0))[0];
            currentOdometer = parseFloat(latest.odometer || 0);
          }
          if (carFuel.length > 0) {
            const latest = carFuel.sort((a, b) => parseFloat(b.odometer || 0) - parseFloat(a.odometer || 0))[0];
            currentOdometer = Math.max(currentOdometer, parseFloat(latest.odometer || 0));
          }
          if (carExpenses.length > 0) {
            const latest = carExpenses.sort((a, b) => parseFloat(b.odometer || 0) - parseFloat(a.odometer || 0))[0];
            currentOdometer = Math.max(currentOdometer, parseFloat(latest.odometer || 0));
          }
          
          const planItems = MaintenancePlan.computePlanStatus(car, new Date(), currentOdometer, state);
          planItems.filter(item => (item.status === 'overdue' || item.status === 'soon') && item.enabled).forEach(item => {
            autoReminders.push({
              ...item,
              carId: car.id,
              carName: `${car.brand} ${car.model}`,
              isAutoReminder: true
            });
          });
        });
        
        if (autoReminders.length > 0) {
          const autoGroup = document.createElement('div');
          autoGroup.className = 'ios-group';
          
          const autoHeader = document.createElement('div');
          autoHeader.className = 'ios-group-header';
          autoHeader.textContent = 'Авто-напоминания (из регламента)';
          autoGroup.appendChild(autoHeader);
          
          autoReminders.forEach(item => {
            const cell = document.createElement('div');
            cell.className = 'ios-cell';
            cell.style.cursor = 'pointer';
            
            let statusColor = 'var(--warning)';
            if (item.status === 'overdue') statusColor = 'var(--danger)';
            
            let dueText = '';
            if (item.displayDue) {
              if (item.displayDue.type === 'km') {
                dueText = `через ${item.displayDue.remaining.toLocaleString('ru-RU')} км`;
              } else {
                dueText = `через ${item.displayDue.remaining} дн.`;
              }
            }
            
            cell.innerHTML = `
              <div class="ios-cell-content">
                <div class="ios-cell-title">${escapeHtml(item.title)}</div>
                <div class="ios-cell-subtitle">${escapeHtml(item.carName)} • ${escapeHtml(dueText || item.statusMessage)}</div>
              </div>
              <div class="ios-cell-trailing">
                <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                  ${item.status === 'overdue' ? 'Просрочено' : 'Скоро'}
                </span>
              </div>
            `;
            
            cell.addEventListener('click', () => {
              currentCarId = item.carId;
              loadCarDetails(item.carId);
              showView('screen-maintenance-plan');
            });
            
            autoGroup.appendChild(cell);
          });
          
          container.appendChild(autoGroup);
          
          // Add separator if there are manual reminders
          if (state.reminders.length > 0) {
            const separator = document.createElement('div');
            separator.style.height = 'var(--space-lg)';
            container.appendChild(separator);
          }
        }
      }
      
      // Render manual reminders
      const activeReminders = (typeof SoftDelete !== 'undefined' && SoftDelete.getActive) ? 
        SoftDelete.getActive(state.reminders) : state.reminders.filter(r => !r.deletedAt);
      
      if(activeReminders.length === 0 && container.children.length === 0) {
        container.innerHTML = '<div class="empty-text">Нет напоминаний</div>';
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
        showToast('Заполните название и выберите автомобиль');
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
      
      if(StorageCompat.set('autodiary:reminders', state.reminders)) {
        showView('screen-reminders');
        renderReminders();
      }
    }

    function deleteReminder(reminderId) {
      const reminder = state.reminders.find(r => r.id === reminderId);
      if(!reminder) return;
      
      showModal('Удалить напоминание?', `Вы уверены, что хотите удалить напоминание "${reminder.title}"?`, () => {
        state.reminders = state.reminders.filter(r => r.id !== reminderId);
        if(StorageCompat.set('autodiary:reminders', state.reminders)) {
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
      if(StorageCompat.set('autodiary:reminders', state.reminders)) {
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
      
      if(StorageCompat.set('autodiary:reminders', state.reminders)) {
        showToast('Напоминание перенесено на неделю');
        renderReminders();
        renderDiary();
      }
    }

    // Export functions
    function exportCSV() {
      const headers = ['Дата', 'Время', 'Автомобиль', 'Категория ID', 'Категория', 'Подкатегория ID', 'Подкатегория', 'Сумма', 'Пробег', 'Заметки'];
      const rows = state.expenses.filter(e => !e.deletedAt).map(exp => {
        const car = state.cars.find(c => c.id === exp.carId);
        const carName = car ? `${car.brand} ${car.model}` : '';
        const categoryName = (exp.categoryId && typeof Categories !== 'undefined' && Categories.getCategoryName) ? 
          Categories.getCategoryName(state.categories || [], exp.categoryId) : (exp.category || '');
        const subcategoryName = (exp.subcategoryId && typeof Categories !== 'undefined' && Categories.getSubcategoryName) ? 
          Categories.getSubcategoryName(state.subcategories || [], exp.subcategoryId) : '';
        return [
          exp.date || '',
          exp.time || '',
          carName,
          exp.categoryId || '',
          categoryName,
          exp.subcategoryId || '',
          subcategoryName,
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
      showToast('CSV экспортирован');
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
      showToast('JSON экспортирован');
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
              
              StorageCompat.set('autodiary:cars', state.cars);
              StorageCompat.set('autodiary:expenses', state.expenses);
              saveAppState();
              saveAppState();
              StorageCompat.set('autodiary:reminders', state.reminders);
              
              showToast('Данные импортированы');
              renderGarage();
              renderDiary();
              renderReminders();
            } catch(e) {
              showToast('Ошибка импорта: неверный формат файла');
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
          editingReminderId = null;
        } else if(id === 'screen-add-fuel') {
          // Reset form if not editing
          if(!editingFuelId) {
            const dateEl = document.getElementById('fuel-date');
            const odometerEl = document.getElementById('fuel-odometer');
            const litersEl = document.getElementById('fuel-liters');
            const costEl = document.getElementById('fuel-cost');
            const fullTankEl = document.getElementById('fuel-full-tank');
            const stationEl = document.getElementById('fuel-station');
            const notesEl = document.getElementById('fuel-notes');
            if(dateEl) dateEl.value = new Date().toISOString().split('T')[0];
            if(odometerEl) odometerEl.value = '';
            if(litersEl) litersEl.value = '';
            if(costEl) costEl.value = '';
            if(fullTankEl) fullTankEl.checked = false;
            if(stationEl) stationEl.value = '';
            if(notesEl) notesEl.value = '';
            window.selectedFuelType = null;
            updateFuelTypeDisplay();
          }
          // Bind fuel type picker field
          const ftField = document.getElementById('fuel-type-picker-field');
          if (ftField && !ftField._ftBound) {
            ftField._ftBound = true;
            ftField.addEventListener('click', () => showFuelTypePicker());
          }
          // Wire up price-per-unit auto-calculation
          function updateFuelPricePerUnit() {
            const liters = parseFloat(document.getElementById('fuel-liters')?.value || 0);
            const cost = parseFloat(document.getElementById('fuel-cost')?.value || 0);
            const row = document.getElementById('fuel-price-per-unit-row');
            const display = document.getElementById('fuel-price-per-unit');
            if (!row || !display) return;
            if (liters > 0 && cost > 0) {
              display.textContent = (cost / liters).toFixed(2) + ' ₴';
              row.style.display = '';
            } else {
              row.style.display = 'none';
            }
          }
          const litersInput = document.getElementById('fuel-liters');
          const costInput = document.getElementById('fuel-cost');
          if (litersInput) { litersInput.removeEventListener('input', updateFuelPricePerUnit); litersInput.addEventListener('input', updateFuelPricePerUnit); }
          if (costInput) { costInput.removeEventListener('input', updateFuelPricePerUnit); costInput.addEventListener('input', updateFuelPricePerUnit); }
          updateFuelPricePerUnit();
        } else if(id === 'screen-add-service-cat') {
          initServiceCatScreen();
        } else if(id === 'screen-add-planned') {
          initPlannedScreen();
        } else if(id === 'screen-add-admin') {
          initAdminScreen();
        } else if(id === 'screen-add-wheels') {
          initWheelsScreen();
        } else if(id === 'screen-add-charge') {
          // Reset charge form
          const chargeDateEl = document.getElementById('charge-date');
          const chargeOdometerEl = document.getElementById('charge-odometer');
          const chargeKwhEl = document.getElementById('charge-kwh');
          const chargeCostEl = document.getElementById('charge-cost');
          const chargeStationEl = document.getElementById('charge-station');
          const chargeNotesEl = document.getElementById('charge-notes');
          if(chargeDateEl) chargeDateEl.value = new Date().toISOString().split('T')[0];
          if(chargeOdometerEl) chargeOdometerEl.value = '';
          if(chargeKwhEl) chargeKwhEl.value = '';
          if(chargeCostEl) chargeCostEl.value = '';
          if(chargeStationEl) chargeStationEl.value = '';
          if(chargeNotesEl) chargeNotesEl.value = '';
          // Wire up price-per-kwh auto-calculation
          function updateChargePricePerKwh() {
            const kwh = parseFloat(document.getElementById('charge-kwh')?.value || 0);
            const cost = parseFloat(document.getElementById('charge-cost')?.value || 0);
            const row = document.getElementById('charge-price-per-kwh-row');
            const display = document.getElementById('charge-price-per-kwh');
            if (!row || !display) return;
            if (kwh > 0 && cost > 0) {
              display.textContent = (cost / kwh).toFixed(2) + ' ₴';
              row.style.display = '';
            } else {
              row.style.display = 'none';
            }
          }
          const kwhInput = document.getElementById('charge-kwh');
          const chargeCostInput = document.getElementById('charge-cost');
          if (kwhInput) { kwhInput.removeEventListener('input', updateChargePricePerKwh); kwhInput.addEventListener('input', updateChargePricePerKwh); }
          if (chargeCostInput) { chargeCostInput.removeEventListener('input', updateChargePricePerKwh); chargeCostInput.addEventListener('input', updateChargePricePerKwh); }
          updateChargePricePerKwh();
        } else if(id === 'screen-add-service') {
          // Reset form if not editing
          if(!editingServiceId) {
            const typeEl = document.getElementById('service-type');
            const typeLabelEl = document.getElementById('service-type-label');
            const otherField = document.getElementById('service-other-field');
            const dateEl = document.getElementById('service-date');
            const odometerEl = document.getElementById('service-odometer');
            const costEl = document.getElementById('service-cost');
            const shopEl = document.getElementById('service-shop');
            const notesEl = document.getElementById('service-notes');
            if(typeEl) typeEl.value = '';
            if(typeLabelEl) typeLabelEl.value = '';
            if(otherField) otherField.style.display = 'none';
            if(dateEl) dateEl.value = new Date().toISOString().split('T')[0];
            if(odometerEl) odometerEl.value = '';
            if(costEl) costEl.value = '';
            if(shopEl) shopEl.value = '';
            if(notesEl) notesEl.value = '';
            window.tempServiceReceipts = [];
            window.selectedServiceTypes = [];
            renderReceiptsPreview('service-receipts-preview', []);
            // Reset quick chips
            document.querySelectorAll('.service-chip').forEach(c => c.classList.remove('selected'));
            updateServiceTypeDisplay();
          }
          // Bind category picker field click
          const svcPickerField = document.getElementById('service-type-picker-field');
          if (svcPickerField && !svcPickerField._pickerBound) {
            svcPickerField._pickerBound = true;
            svcPickerField.addEventListener('click', () => showServiceTypePicker());
          }
          initServiceQuickChips();
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
        diaryFilters.timePeriod = text === 'Месяц' ? 'month' : text === 'Квартал' ? 'quarter' : text === 'Год' ? 'year' : 'all';
        renderDiary();
        return;
      }
      
      // Date filter button
      const dateFilterBtn = e.target.closest('#diary-date-filter-btn');
      if(dateFilterBtn) {
        e.stopPropagation();
        // Open date range picker
        showDateRangePicker(diaryFilters);
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
      
      const saveTemplateExpenseBtn = e.target.closest('[data-save-template-expense]');
      if(saveTemplateExpenseBtn) {
        e.preventDefault();
        e.stopPropagation();
        const expense = state.expenses.find(e => e.id === saveTemplateExpenseBtn.dataset.saveTemplateExpense);
        if(expense && typeof Templates !== 'undefined') {
          const name = prompt('Название шаблона:', expense.categoryId && typeof Categories !== 'undefined' ? 
            Categories.getCategoryName(expense.categoryId, state) : 'Шаблон расхода');
          if(name) {
            if(!state.templates) state.templates = [];
            const template = Templates.createTemplate(expense, 'expense', state);
            template.name = name;
            if(saveAppState()) {
              showToast('Шаблон сохранен');
              if(document.getElementById('screen-templates')?.classList.contains('active')) {
                renderTemplates();
              }
            }
          }
        }
        return;
      }
      
      const deleteBtn = e.target.closest('[data-delete-expense]');
      if(deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        deleteExpense(deleteBtn.dataset.deleteExpense);
        return;
      }
      
      const editCarDetailsBtn = e.target.closest('[data-edit-car-details]');
      if(editCarDetailsBtn) {
        e.preventDefault();
        e.stopPropagation();
        const cid = editCarDetailsBtn.dataset.editCarDetails;
        loadCarDetails(cid);
        showView('screen-car-details');
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
      const savedTheme = StorageCompat.get('autodiary:theme', null);
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
      StorageCompat.set('autodiary:theme', newTheme);
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
      const carsSaved = StorageCompat.set('autodiary:cars', state.cars);
      const expensesSaved = StorageCompat.set('autodiary:expenses', state.expenses);
      const remindersSaved = StorageCompat.set('autodiary:reminders', state.reminders);
      
      if(!carsSaved || !expensesSaved || !remindersSaved) {
        showToast('Ошибка сохранения данных', 3000);
        return;
      }
      
      // Reload state from storage to ensure consistency
      state.cars = StorageCompat.get('autodiary:cars', []);
      state.expenses = StorageCompat.get('autodiary:expenses', []);
      state.reminders = StorageCompat.get('autodiary:reminders', []);
      
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
      const carsCount = (state.cars || []).filter(c => !c.deletedAt).length;
      const categoriesCount = typeof Categories !== 'undefined' ? 
        Categories.getActive(state.categories || []).length : 
        new Set((state.expenses || []).filter(e => !e.deletedAt).map(e => e.category)).size;
      const elCars = document.getElementById('set-cars-count');
      const elCats = document.getElementById('set-cats-count');
      if(elCars) elCars.textContent = String(carsCount);
      if(elCats) elCats.textContent = categoriesCount > 0 ? String(categoriesCount) : '—';
      
      // Update trash count
      const trashCount = document.getElementById('trash-count');
      if (trashCount) {
        const deletedCars = (state.cars || []).filter(c => c.deletedAt);
        const deletedExpenses = (state.expenses || []).filter(e => e.deletedAt);
        const deletedFuel = (state.fuel || []).filter(f => f.deletedAt);
        const deletedService = (state.service || []).filter(s => s.deletedAt);
        const deletedReminders = (state.reminders || []).filter(r => r.deletedAt);
        const totalDeleted = deletedCars.length + deletedExpenses.length + deletedFuel.length + deletedService.length + deletedReminders.length;
        trashCount.textContent = totalDeleted > 0 ? totalDeleted.toString() : '0';
      }
      
      // Update recurring upcoming count
      const recurringCountEl = document.getElementById('recurring-upcoming-count');
      if(recurringCountEl && typeof Recurring !== 'undefined') {
        const upcoming = Recurring.getUpcoming(state);
        recurringCountEl.textContent = upcoming.length > 0 ? upcoming.length.toString() : '0';
      }
      
      // Update settings values
      const settings = state.settings || {};
      const units = settings.units || { distance: 'km', fuel: 'L/100km', currency: '₴' };
      
      const currencyEl = document.getElementById('set-currency');
      if(currencyEl) currencyEl.textContent = units.currency || '₴';
      
      const requireOdometerEl = document.getElementById('set-require-odometer');
      if(requireOdometerEl) requireOdometerEl.checked = settings.requireOdometer || false;
      
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const color = StorageCompat.get('autodiary:color', 'blue');
      const themeBtn = document.getElementById('set-theme');
      const colorBtn = document.getElementById('set-color');
      const colorDot = document.getElementById('set-color-dot');

      if(themeBtn) themeBtn.textContent = currentTheme === 'light' ? 'Светлая' : 'Тёмная';
      if(colorBtn) colorBtn.textContent = color === 'blue' ? 'Синий' : color;
      if(colorDot) colorDot.style.background = color === 'blue' ? '#0A84FF' : color;
    }

    // Handle trash actions (restore, hard delete)
    function handleTrashActions(e) {
      const target = e.target.closest('[data-restore], [data-hard-delete]');
      if (!target) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      if (target.dataset.restore) {
        const itemId = target.dataset.restore;
        const itemType = target.dataset.itemType || 'expense';
        
        // Find item in appropriate array
        let item = null;
        let array = null;
        
        if (itemType === 'car') {
          array = state.cars;
          item = array.find(c => c.id === itemId);
        } else if (itemType === 'expense') {
          array = state.expenses;
          item = array.find(e => e.id === itemId);
        } else if (itemType === 'reminder') {
          array = state.reminders;
          item = array.find(r => r.id === itemId);
        } else if (itemType === 'fuel') {
          array = state.fuel || [];
          item = array.find(f => f.id === itemId);
        } else if (itemType === 'service') {
          array = state.service || [];
          item = array.find(s => s.id === itemId);
        }
        
        if (item && typeof SoftDelete !== 'undefined' && SoftDelete.restore) {
          SoftDelete.restore(item);
          if (saveAppState()) {
            showToast('Восстановлено');
            renderTrash();
            // Refresh relevant views
            renderDiary();
            renderGarage();
            renderReminders();
          }
        }
        return;
      }
      
      if (target.dataset.hardDelete) {
        const itemId = target.dataset.hardDelete;
        const itemType = target.dataset.itemType || 'expense';
        
        showModal('Удалить навсегда?', 'Это действие нельзя отменить. Элемент будет удален безвозвратно.', () => {
          if (typeof SoftDelete !== 'undefined' && SoftDelete.hardDelete) {
            let item = null;
            if (itemType === 'car') {
              item = state.cars.find(c => c.id === itemId);
              if (item) SoftDelete.hardDelete(item, 'car', state);
            } else if (itemType === 'expense') {
              item = state.expenses.find(e => e.id === itemId);
              if (item) SoftDelete.hardDelete(item, 'expense', state);
            } else if (itemType === 'reminder') {
              item = state.reminders.find(r => r.id === itemId);
              if (item) SoftDelete.hardDelete(item, 'reminder', state);
            } else if (itemType === 'fuel') {
              item = (state.fuel || []).find(f => f.id === itemId);
              if (item) SoftDelete.hardDelete(item, 'fuel', state);
            } else if (itemType === 'service') {
              item = (state.service || []).find(s => s.id === itemId);
              if (item) SoftDelete.hardDelete(item, 'service', state);
            }
            
            if (saveAppState()) {
              showToast('Удалено навсегда');
              renderTrash();
            }
          }
        });
        return;
      }
    }
    
    // Handle empty trash button
    function handleEmptyTrash() {
      const emptyBtn = document.getElementById('trash-empty-btn');
      if (emptyBtn) {
        emptyBtn.addEventListener('click', () => {
          showModal('Очистить корзину?', 'Все удаленные элементы будут удалены навсегда. Это действие нельзя отменить.', () => {
            if (typeof SoftDelete !== 'undefined' && SoftDelete.emptyTrash) {
              SoftDelete.emptyTrash(state);
              if (saveAppState()) {
                showToast('Корзина очищена');
                renderTrash();
                refreshSettingsScreen();
              }
            }
          });
        });
      }
    }
    
    // Render trash screen
    function renderTrash() {
      const container = document.getElementById('trash-list');
      const emptyMsg = document.getElementById('trash-empty-message');
      if (!container) return;
      
      // Get all deleted items
      const deletedItems = [];
      
      // Get deleted cars
      (state.cars || []).filter(c => c.deletedAt).forEach(car => {
        deletedItems.push({ ...car, type: 'car', typeLabel: 'Автомобиль' });
      });
      
      // Get deleted expenses
      (state.expenses || []).filter(e => e.deletedAt).forEach(exp => {
        const car = state.cars.find(c => c.id === exp.carId);
        deletedItems.push({ 
          ...exp, 
          type: 'expense', 
          typeLabel: 'Расход',
          carName: car ? `${car.brand} ${car.model}` : ''
        });
      });
      
      // Get deleted reminders
      (state.reminders || []).filter(r => r.deletedAt).forEach(rem => {
        const car = state.cars.find(c => c.id === rem.carId);
        deletedItems.push({ 
          ...rem, 
          type: 'reminder', 
          typeLabel: 'Напоминание',
          carName: car ? `${car.brand} ${car.model}` : ''
        });
      });
      
      // Get deleted fuel entries
      ((state.fuel || []).filter(f => f.deletedAt)).forEach(fuel => {
        const car = state.cars.find(c => c.id === fuel.carId);
        deletedItems.push({ 
          ...fuel, 
          type: 'fuel', 
          typeLabel: 'Заправка',
          carName: car ? `${car.brand} ${car.model}` : ''
        });
      });
      
      // Get deleted service entries
      ((state.service || []).filter(s => s.deletedAt)).forEach(service => {
        const car = state.cars.find(c => c.id === service.carId);
        deletedItems.push({ 
          ...service, 
          type: 'service', 
          typeLabel: 'Сервис',
          carName: car ? `${car.brand} ${car.model}` : ''
        });
      });
      
      // Sort by deletion date (newest first)
      deletedItems.sort((a, b) => {
        const dateA = new Date(a.deletedAt);
        const dateB = new Date(b.deletedAt);
        return dateB - dateA;
      });
      
      if (deletedItems.length === 0) {
        container.innerHTML = '';
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
      }
      
      if (emptyMsg) emptyMsg.style.display = 'none';
      container.innerHTML = '';
      
      // Group by type
      const byType = {};
      deletedItems.forEach(item => {
        if (!byType[item.type]) {
          byType[item.type] = [];
        }
        byType[item.type].push(item);
      });
      
      Object.keys(byType).forEach(type => {
        const group = document.createElement('div');
        group.className = 'ios-group';
        
        const header = document.createElement('div');
        header.className = 'ios-group-header';
        header.textContent = byType[type][0].typeLabel;
        group.appendChild(header);
        
        byType[type].forEach(item => {
          const cell = document.createElement('div');
          cell.className = 'ios-cell';
          
          let title = '';
          let subtitle = '';
          
          if (type === 'car') {
            title = `${item.brand} ${item.model}`;
            subtitle = item.year ? `${item.year} год` : '';
          } else if (type === 'expense') {
            title = `${(item.amount || 0).toLocaleString('ru-RU', {minimumFractionDigits: 2})} ₴`;
            subtitle = `${item.carName || ''} • ${item.date ? new Date(item.date).toLocaleDateString('ru-RU') : ''}`;
          } else if (type === 'reminder') {
            title = item.title || 'Напоминание';
            subtitle = `${item.carName || ''} • ${item.dueDate ? new Date(item.dueDate).toLocaleDateString('ru-RU') : ''}`;
          } else if (type === 'fuel') {
            title = `${item.liters ? item.liters.toFixed(2) : 0} л`;
            subtitle = `${item.carName || ''} • ${item.date ? new Date(item.date).toLocaleDateString('ru-RU') : ''}`;
          } else if (type === 'service') {
            title = item.typeLabel || item.type || 'Сервис';
            subtitle = `${item.carName || ''} • ${item.date ? new Date(item.date).toLocaleDateString('ru-RU') : ''}`;
          }
          
          cell.innerHTML = `
            <div class="ios-cell-content">
              <div class="ios-cell-title">${escapeHtml(title)}</div>
              <div class="ios-cell-subtitle">${escapeHtml(subtitle)}</div>
              <div class="ios-cell-subtitle" style="margin-top: var(--space-xs); color: var(--text-secondary); font-size: var(--font-size-caption);">
                Удалено: ${new Date(item.deletedAt).toLocaleDateString('ru-RU')} ${new Date(item.deletedAt).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}
              </div>
            </div>
            <div class="ios-cell-trailing">
              <button class="ios-cell-action-btn" data-restore="${item.id}" data-item-type="${type}" title="Восстановить" style="color: var(--success);">
                <i data-lucide="rotate-ccw"></i>
              </button>
              <button class="ios-cell-action-btn" data-hard-delete="${item.id}" data-item-type="${type}" title="Удалить навсегда" style="color: var(--destructive);">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          `;
          group.appendChild(cell);
        });
        
        container.appendChild(group);
      });
      
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    // Attach trash action handlers
    document.body.addEventListener('click', handleTrashActions);
    handleEmptyTrash();
    
    // Handle fuel/service actions
    document.body.addEventListener('click', (e) => {
      const target = e.target.closest('[data-edit-fuel], [data-delete-fuel], [data-edit-service], [data-delete-service]');
      if(!target) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      if(target.dataset.editFuel) {
        editFuelEntry(target.dataset.editFuel);
      }
      
      if(target.dataset.deleteFuel) {
        const fuel = state.fuel.find(f => f.id === target.dataset.deleteFuel);
        if(fuel) {
          showModal('Удалить заправку?', `Удалить заправку на ${fuel.liters} л?`, () => {
            if(typeof SoftDelete !== 'undefined' && SoftDelete.delete) {
              SoftDelete.delete(fuel, 'fuel', state);
            } else {
              fuel.deletedAt = new Date().toISOString();
            }
            if(saveAppState()) {
              showToast('Заправка удалена');
              if(currentCarId) renderFuelTab(currentCarId);
            }
          });
        }
      }
      
      if(target.dataset.editService) {
        editServiceEntry(target.dataset.editService);
      }
      
      if(target.dataset.deleteService) {
        const service = state.service.find(s => s.id === target.dataset.deleteService);
        if(service) {
          showModal('Удалить запись сервиса?', `Удалить "${service.typeLabel}"?`, () => {
            if(typeof SoftDelete !== 'undefined' && SoftDelete.delete) {
              SoftDelete.delete(service, 'service', state);
            } else {
              service.deletedAt = new Date().toISOString();
            }
            if(saveAppState()) {
              showToast('Запись сервиса удалена');
              if(currentCarId) renderServiceTab(currentCarId);
            }
          });
        }
      }
    });

    document.addEventListener('click', (e)=>{
      if(e.target && e.target.id === 'set-theme'){
        const newTheme = toggleTheme();
        refreshSettingsScreen();
        showToast(newTheme === 'light' ? 'Светлая тема' : 'Тёмная тема');
      }
      if(e.target && e.target.id === 'set-color'){
        const cur = StorageCompat.get('autodiary:color', 'blue');
        const pool = ['blue','#00ff9c','#f59e0b','#ef4444'];
        const next = pool[(pool.indexOf(cur)+1)%pool.length];
        StorageCompat.set('autodiary:color', next);
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
      console.log('initApp called');
      
      // Reinitialize diary filters from localStorage
      if (typeof Diary !== 'undefined' && Diary.initFilters) {
        diaryFilters = Diary.initFilters();
      }
      
      // Initialize views and tabs
      views = [...document.querySelectorAll('.view')];
      tabs = [...document.querySelectorAll('.tab')];
      
      // Render initial views
      renderDiary();
      renderGarage();
      renderReminders();
      
      // Listen for diary filter changes
      document.addEventListener('diaryFilterChanged', () => {
        renderDiary();
      });
      
      // Coupon copy handler
      document.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('.coupon-copy-btn');
        if (copyBtn) {
          const code = copyBtn.closest('.coupon-code-row')?.querySelector('.coupon-code')?.textContent?.trim();
          if (code && navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => showToast('Код скопирован: ' + code));
          }
        }
      });

      // Initialize receipts handlers
      if(typeof initializeReceiptsHandlers === 'function') {
        initializeReceiptsHandlers();
      }
      
      // Initialize settings handlers
      if(typeof initializeSettingsHandlers === 'function') {
        initializeSettingsHandlers();
      }
      
      // Initialize advanced filters
      if(typeof initializeAdvancedFilters === 'function') {
        setTimeout(initializeAdvancedFilters, 100);
      }
      
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
          
          // Quick path for fuel
          if(categoryItem.dataset.type === 'fuel' || categoryItem.dataset.goto === 'screen-add-fuel') {
            expenseCategorySheet.classList.remove('active');
            showView('screen-add-fuel');
            return;
          }

          // Quick path for charge
          if(categoryItem.dataset.type === 'charge' || categoryItem.dataset.goto === 'screen-add-charge') {
            expenseCategorySheet.classList.remove('active');
            showView('screen-add-charge');
            return;
          }

          // Quick path for admin
          if(categoryItem.dataset.type === 'admin' || categoryItem.dataset.goto === 'screen-add-admin') {
            expenseCategorySheet.classList.remove('active');
            showView('screen-add-admin');
            return;
          }

          // Quick path for wheels
          if(categoryItem.dataset.type === 'wheels' || categoryItem.dataset.goto === 'screen-add-wheels') {
            expenseCategorySheet.classList.remove('active');
            showView('screen-add-wheels');
            return;
          }
          
          // Quick path for service subcategory
          if(categoryItem.dataset.type === 'service-cat' || categoryItem.dataset.goto === 'screen-add-service-cat') {
            expenseCategorySheet.classList.remove('active');
            showView('screen-add-service-cat');
            return;
          }

          // Quick path for service (legacy)
          if(categoryItem.dataset.type === 'service' || categoryItem.dataset.goto === 'screen-add-service') {
            expenseCategorySheet.classList.remove('active');
            showView('screen-add-service');
            return;
          }

          // Quick path for Обновить пробег
          if(categoryItem.id === 'btn-update-odometer') {
            expenseCategorySheet.classList.remove('active');
            showUpdateOdometerSheet();
            return;
          }

          // Quick path for Прочее — show text input sub-sheet
          if(categoryItem.dataset.type === 'other') {
            expenseCategorySheet.classList.remove('active');
            showOtherExpensePicker((text) => {
              setTimeout(() => {
                const categoryValue = document.getElementById('expense-category-value');
                if(categoryValue) categoryValue.textContent = text ? 'Прочее — ' + text : 'Прочее';
                showView('screen-expense-form'); // restores notes field first
                // Pre-fill notes with typed text and hide notes field
                const notesEl = document.getElementById('notes');
                if(notesEl) notesEl.value = text;
                const notesField = notesEl?.closest('.field');
                if(notesField) notesField.style.display = 'none';
              }, 320);
            });
            return;
          }

          // Quick path for Уход — show subcategory picker
          if(categoryItem.dataset.type === 'care') {
            expenseCategorySheet.classList.remove('active');
            showCareTypePicker((ct) => {
              setTimeout(() => {
                const categoryValue = document.getElementById('expense-category-value');
                if(categoryValue) categoryValue.textContent = 'Уход — ' + ct.label;
                showView('screen-expense-form');
              }, 320);
            });
            return;
          }

          // Quick path for ТО — navigate to service form
          if(categoryItem.dataset.type === 'to') {
            expenseCategorySheet.classList.remove('active');
            window.selectedServiceTypes = [];
            updateServiceTypeDisplay();
            showView('screen-add-service');
            const svcPickerField = document.getElementById('service-type-picker-field');
            if (svcPickerField && !svcPickerField._pickerBound) {
              svcPickerField._pickerBound = true;
              svcPickerField.addEventListener('click', () => showServiceTypePicker());
            }
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
    
      // Initialize fuel form handlers
      const saveFuelBtn = document.getElementById('save-fuel-btn');
      if(saveFuelBtn) {
        saveFuelBtn.addEventListener('click', () => {
          saveFuelEntry();
        });
      }
      
      // Initialize admin form handlers
      const saveAdminBtn = document.getElementById('save-admin-btn');
      if(saveAdminBtn) saveAdminBtn.addEventListener('click', () => saveAdminEntry());

      // Initialize wheels form handlers
      const saveWheelsBtn = document.getElementById('save-wheels-btn');
      if(saveWheelsBtn) saveWheelsBtn.addEventListener('click', () => saveWheelsEntry());

      // Initialize charge form handlers
      const saveChargeBtn = document.getElementById('save-charge-btn');
      if(saveChargeBtn) {
        saveChargeBtn.addEventListener('click', () => {
          saveChargeEntry();
        });
      }

      // Initialize service form handlers
      const saveServiceBtn = document.getElementById('save-service-btn');
      if(saveServiceBtn) {
        saveServiceBtn.addEventListener('click', () => {
          saveServiceEntry();
        });
      }
      
      // Service type change handler
      const serviceTypeSelect = document.getElementById('service-type');
      if(serviceTypeSelect) {
        serviceTypeSelect.addEventListener('change', (e) => {
          const otherField = document.getElementById('service-other-field');
          if(e.target.value === 'other' && otherField) {
            otherField.style.display = 'block';
          } else if(otherField) {
            otherField.style.display = 'none';
          }
        });
      }
      
      // Set default dates for fuel and service forms
      const fuelDateInput = document.getElementById('fuel-date');
      if(fuelDateInput && !fuelDateInput.value) {
        fuelDateInput.value = new Date().toISOString().split('T')[0];
      }
      
      const serviceDateInput = document.getElementById('service-date');
      if(serviceDateInput && !serviceDateInput.value) {
        serviceDateInput.value = new Date().toISOString().split('T')[0];
      }
      
      // Initialize Lucide icons once (render functions also call createIcons as needed)
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
    
    // Save fuel entry
    function saveFuelEntry() {
      const carId = currentCarId || state.cars[0]?.id;
      if(!carId) {
        showToast('Выберите автомобиль');
        return;
      }
      
      const date = document.getElementById('fuel-date')?.value;
      const odometer = parseFloat(document.getElementById('fuel-odometer')?.value || 0);
      const liters = parseFloat(document.getElementById('fuel-liters')?.value || 0);
      const totalCost = parseFloat(document.getElementById('fuel-cost')?.value || 0);
      const fullTank = document.getElementById('fuel-full-tank')?.checked || false;
      const station = document.getElementById('fuel-station')?.value?.trim() || '';
      const notes = document.getElementById('fuel-notes')?.value?.trim() || '';
      const fuelType = window.selectedFuelType?.type || '';
      const fuelTypeLabel = window.selectedFuelType?.label || '';

      if(!date || !odometer || !liters || !totalCost) {
        showToast('Заполните все обязательные поля');
        return;
      }
      
      // Validate odometer
      const validation = validateOdometer(carId, odometer);
      if(!validation.valid) {
        showModal('Предупреждение', validation.message, () => {
          proceedSaveFuel(carId, date, odometer, liters, totalCost, fullTank, station, notes, fuelType, fuelTypeLabel);
        });
        return;
      }

      proceedSaveFuel(carId, date, odometer, liters, totalCost, fullTank, station, notes, fuelType, fuelTypeLabel);
    }

    function proceedSaveFuel(carId, date, odometer, liters, totalCost, fullTank, station, notes, fuelType, fuelTypeLabel) {
      if(!state.fuel) state.fuel = [];
      
      if(editingFuelId) {
        // Update existing entry
        const index = state.fuel.findIndex(f => f.id === editingFuelId);
        if(index >= 0) {
          state.fuel[index] = {
            ...state.fuel[index],
            date,
            odometer,
            liters,
            totalCost,
            pricePerLiter: liters > 0 ? (totalCost / liters).toFixed(2) : 0,
            fullTank,
            fuelType,
            fuelTypeLabel,
            station,
            notes
          };
          editingFuelId = null;
        }
      } else {
        // Create new entry
        const fuelEntry = (typeof Fuel !== 'undefined' && Fuel.addEntry) ?
          Fuel.addEntry(carId, {
            date,
            odometer,
            liters,
            totalCost,
            fullTank,
            fuelType,
            fuelTypeLabel,
            station,
            notes
          }) : {
            id: Date.now().toString(),
            carId,
            date,
            odometer,
            liters,
            totalCost,
            pricePerLiter: liters > 0 ? (totalCost / liters).toFixed(2) : 0,
            fullTank,
            fuelType,
            fuelTypeLabel,
            station,
            notes,
            createdAt: new Date().toISOString(),
            deletedAt: null
          };
        
        state.fuel.push(fuelEntry);
      }
      
      if(saveAppState()) {
        showToast(editingFuelId ? 'Заправка обновлена' : 'Заправка добавлена');
        // Reset form
        document.getElementById('fuel-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('fuel-odometer').value = '';
        document.getElementById('fuel-liters').value = '';
        document.getElementById('fuel-cost').value = '';
        document.getElementById('fuel-full-tank').checked = false;
        document.getElementById('fuel-station').value = '';
        document.getElementById('fuel-notes').value = '';
        window.selectedFuelType = null;
        updateFuelTypeDisplay();
        editingFuelId = null;
        
        // Return to car details or diary
        if(currentCarId) {
          loadCarDetails(currentCarId);
          showView('screen-car-details');
        } else {
          showView('screen-diary');
        }
      }
    }
    
    // ── Service subcategory screen ─────────────────────────────────
    const PLANNED_SUBS = {
      'spark':          'Свечи зажигания / накаливания',
      'timing':         'Ремень / цепь ГРМ',
      'coolant':        'Замена антифриза',
      'brake-fluid':    'Замена тормозной жидкости',
      'power-steering': 'Замена жидкости ГУР',
      'gearbox-oil':    'Масло в КПП',
      'front-diff':     'Масло переднего редуктора',
      'rear-diff':      'Масло заднего редуктора',
      'transfer':       'Масло раздаточной коробки',
      'battery':        'Новый АКБ',
    };

    const SVC_CATS = {
      'planned':      'Плановая замена',
      'engine':       'Двигатель',
      'fuel-sys':     'Топливная система',
      'cooling':      'Система охлаждения',
      'exhaust':      'Система выпуска',
      'transmission': 'Трансмиссия',
      'suspension':   'Ходовая / Рулевое управление',
      'brakes':       'Тормозная система',
      'electrical':   'Электрооборудование',
      'hvac':         'Отопление / кондиционер',
      'body':         'Салон и кузов',
      'other':        'Прочее',
    };

    function initServiceCatScreen() {
      window._svcSelected = new Set();

      ['svc-cat-date','svc-cat-odometer','svc-cat-shop','svc-cat-notes','svc-cat-other-text']
        .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
      const dateEl = document.getElementById('svc-cat-date');
      if(dateEl) dateEl.value = new Date().toISOString().split('T')[0];

      document.querySelectorAll('.svc-cat-btn').forEach(btn => {
        btn.style.boxShadow = '';
        btn.querySelector('.svc-chk')?.remove();
      });
      document.getElementById('svc-cat-other-wrap').style.display = 'none';
      renderSvcCosts();

      function toggleBtn(btn, active) {
        if(active) {
          btn.style.boxShadow = '0 0 0 2px #34C759';
          btn.style.borderRadius = '14px';
          if(!btn.querySelector('.svc-chk'))
            btn.insertAdjacentHTML('beforeend', '<div class="svc-chk" style="position:absolute;top:5px;right:5px;width:18px;height:18px;background:#34C759;border-radius:50%;display:flex;align-items:center;justify-content:center;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>');
        } else {
          btn.style.boxShadow = '';
          btn.querySelector('.svc-chk')?.remove();
        }
      }

      document.querySelectorAll('.svc-cat-btn').forEach(btn => {
        btn.onclick = () => {
          const val = btn.dataset.svc;
          if(window._svcSelected.has(val)) {
            window._svcSelected.delete(val);
            toggleBtn(btn, false);
          } else {
            window._svcSelected.add(val);
            toggleBtn(btn, true);
          }
          document.getElementById('svc-cat-other-wrap').style.display =
            window._svcSelected.has('other') ? '' : 'none';
          renderSvcCosts();
        };
      });

      const gotoPlanned = document.getElementById('svc-goto-planned');
      if(gotoPlanned) gotoPlanned.onclick = () => showView('screen-add-planned');

      if(typeof lucide !== 'undefined') lucide.createIcons();
    }

    function renderSvcCosts() {
      const wrap = document.getElementById('svc-costs-wrap');
      const list = document.getElementById('svc-costs-list');
      const totalEl = document.getElementById('svc-cost-total');
      if(!wrap || !list || !totalEl) return;

      if(window._svcSelected.size === 0) { wrap.style.display = 'none'; return; }
      wrap.style.display = '';

      const existing = {};
      list.querySelectorAll('[data-scost-key]').forEach(inp => {
        existing[inp.dataset.scostKey] = inp.value;
      });
      const existingNotes = {};
      list.querySelectorAll('[data-snote-key]').forEach(inp => {
        existingNotes[inp.dataset.snoteKey] = inp.value;
      });

      const rows = [];
      Array.from(window._svcSelected).forEach(key => {
        const label = key === 'other'
          ? (document.getElementById('svc-cat-other-text')?.value?.trim() || 'Прочее')
          : (SVC_CATS[key] || key);
        rows.push({ key, label });
      });

      list.innerHTML = rows.map(({ key, label }) => {
        const val = existing[key] || '';
        const noteVal = existingNotes[key] || '';
        return `<div style="display:flex;flex-direction:column;gap:6px;padding-bottom:var(--space-sm);border-bottom:0.5px solid var(--separator);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-md);">
            <span style="flex:1;font-size:var(--font-size-body);font-weight:500;color:var(--text);">${escapeHtml(label)}</span>
            <input type="number" data-scost-key="${key}" placeholder="0.00" step="0.01" min="0" value="${val}"
              style="width:110px;padding:8px 10px;border-radius:10px;border:0.5px solid var(--separator);background:var(--surface-2);color:var(--text);font-size:var(--font-size-body);text-align:right;">
          </div>
          <input type="text" data-snote-key="${key}" placeholder="Комментарий (марка, артикул…)" value="${escapeHtml(noteVal)}"
            style="width:100%;padding:8px 10px;border-radius:10px;border:0.5px solid var(--separator);background:var(--surface-2);color:var(--text);font-size:var(--font-size-footnote);box-sizing:border-box;">
        </div>`;
      }).join('');

      list.querySelectorAll('[data-scost-key]').forEach(inp => {
        inp.addEventListener('input', updateSvcTotal);
      });
      updateSvcTotal();
    }

    function updateSvcTotal() {
      const totalEl = document.getElementById('svc-cost-total');
      if(!totalEl) return;
      let sum = 0;
      document.querySelectorAll('#svc-costs-list [data-scost-key]').forEach(inp => {
        sum += parseFloat(inp.value || 0);
      });
      totalEl.textContent = sum.toFixed(2);
    }

    function saveSvcCatEntry() {
      const carId = currentCarId || state.cars[0]?.id;
      if(!carId) { showToast('Выберите автомобиль'); return; }
      const date = document.getElementById('svc-cat-date')?.value;
      if(!date) { showToast('Укажите дату'); return; }
      if(window._svcSelected.size === 0) { showToast('Выберите подкатегорию'); return; }

      const odometer = parseFloat(document.getElementById('svc-cat-odometer')?.value || 0);
      const shop = document.getElementById('svc-cat-shop')?.value?.trim() || '';
      const notes = document.getElementById('svc-cat-notes')?.value?.trim() || '';
      const otherText = document.getElementById('svc-cat-other-text')?.value?.trim() || '';

      const costMap = {};
      document.querySelectorAll('#svc-costs-list [data-scost-key]').forEach(inp => {
        costMap[inp.dataset.scostKey] = parseFloat(inp.value || 0);
      });
      const totalCost = Object.values(costMap).reduce((s, v) => s + v, 0);

      const noteMap = {};
      document.querySelectorAll('#svc-costs-list [data-snote-key]').forEach(inp => {
        if(inp.value.trim()) noteMap[inp.dataset.snoteKey] = inp.value.trim();
      });

      const parts = Array.from(window._svcSelected).map(k =>
        k === 'other' ? (otherText || 'Прочее') : (SVC_CATS[k] || k)
      );

      if(!state.service) state.service = [];
      state.service.push({
        id: Date.now().toString(),
        carId, date, odometer,
        type: 'service-cat',
        typeLabel: parts.join(', '),
        categories: Array.from(window._svcSelected),
        costMap, cost: totalCost,
        noteMap, otherText, shop, notes,
        createdAt: new Date().toISOString(),
        deletedAt: null
      });

      if(saveAppState()) {
        showToast('Сохранено');
        if(currentCarId) { loadCarDetails(currentCarId); showView('screen-car-details'); }
        else showView('screen-diary');
      }
    }

    // ── Admin screen ───────────────────────────────────────────────
    const ADMIN_CATS = {
      'parking':      'Парковка',
      'parking-rent': 'Аренда паркинга',
      'toll':         'Платные дороги',
      'tow':          'Эвакуатор',
      'insurance':    'Страховка',
      'fine':         'Штраф',
      'tax':          'Налоги и пошлины',
      'other':        'Прочее',
    };

    // ── Planned Replacement Screen ──────────────────────────────────
    const PLANNED_FIELDS = {
      'spark': [
        { id: 'brand',   label: 'Марка',          placeholder: 'NGK, Bosch, Denso…', type: 'text' },
        { id: 'article', label: 'Артикул',         placeholder: '…',                  type: 'text' },
        { id: 'qty',     label: 'Количество, шт',  placeholder: '4',                  type: 'number' },
      ],
      'timing': [
        { id: 'brand',   label: 'Марка',     placeholder: 'Gates, INA, SKF…', type: 'text' },
        { id: 'article', label: 'Артикул',   placeholder: '…',                type: 'text' },
        { id: 'kind',    label: 'Тип',       placeholder: 'ремень / цепь',    type: 'text' },
      ],
      'coolant': [
        { id: 'brand',  label: 'Марка',     placeholder: 'Febi, Wurth…',    type: 'text' },
        { id: 'type',   label: 'Тип / цвет', placeholder: 'G12+, G13…',     type: 'text' },
        { id: 'volume', label: 'Объём (л)', placeholder: '5',               type: 'number' },
      ],
      'brake-fluid': [
        { id: 'brand',  label: 'Марка',      placeholder: 'Bosch, Liqui Moly…', type: 'text' },
        { id: 'dot',    label: 'Стандарт',   placeholder: 'DOT 4',              type: 'text' },
        { id: 'volume', label: 'Объём (мл)', placeholder: '500',                type: 'number' },
      ],
      'power-steering': [
        { id: 'brand',  label: 'Марка',      placeholder: '…',   type: 'text' },
        { id: 'volume', label: 'Объём (мл)', placeholder: '500', type: 'number' },
      ],
      'gearbox-oil': [
        { id: 'brand',     label: 'Марка',      placeholder: 'Castrol, Liqui Moly…', type: 'text' },
        { id: 'viscosity', label: 'Вязкость',   placeholder: '75W-90',               type: 'text' },
        { id: 'volume',    label: 'Объём (л)',  placeholder: '2',                     type: 'number' },
      ],
      'front-diff': [
        { id: 'brand',     label: 'Марка',     placeholder: '…',      type: 'text' },
        { id: 'viscosity', label: 'Вязкость',  placeholder: '75W-90', type: 'text' },
        { id: 'volume',    label: 'Объём (л)', placeholder: '1',      type: 'number' },
      ],
      'rear-diff': [
        { id: 'brand',     label: 'Марка',     placeholder: '…',      type: 'text' },
        { id: 'viscosity', label: 'Вязкость',  placeholder: '75W-90', type: 'text' },
        { id: 'volume',    label: 'Объём (л)', placeholder: '1',      type: 'number' },
      ],
      'transfer': [
        { id: 'brand',     label: 'Марка',     placeholder: '…',      type: 'text' },
        { id: 'viscosity', label: 'Вязкость',  placeholder: '75W-90', type: 'text' },
        { id: 'volume',    label: 'Объём (л)', placeholder: '1',      type: 'number' },
      ],
      'battery': [
        { id: 'brand',    label: 'Марка',          placeholder: 'Bosch, Varta…', type: 'text' },
        { id: 'capacity', label: 'Ёмкость (Ач)',   placeholder: '60',            type: 'number' },
        { id: 'voltage',  label: 'Напряжение (В)', placeholder: '12',            type: 'number' },
      ],
    };

    function initPlannedScreen() {
      window._plannedSelected = new Set();
      window._plannedDetails = {};

      ['planned-shop','planned-date','planned-odometer','planned-notes']
        .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
      const dateEl = document.getElementById('planned-date');
      if(dateEl) dateEl.value = new Date().toISOString().split('T')[0];

      document.querySelectorAll('.planned-btn').forEach(btn => {
        btn.style.boxShadow = '';
        btn.querySelector('.pl-chk')?.remove();
      });
      document.getElementById('planned-costs-wrap').style.display = 'none';
      document.getElementById('planned-costs-list').innerHTML = '';
      document.getElementById('planned-cost-total').textContent = '0.00';

      document.querySelectorAll('.planned-btn').forEach(btn => {
        btn.onclick = () => showPlannedDetailSheet(btn.dataset.planned, btn);
      });

      document.getElementById('save-planned-btn').onclick = savePlannedEntry;
      if(typeof lucide !== 'undefined') lucide.createIcons();
    }

    function showPlannedDetailSheet(key, btn) {
      if(!window._plannedDetails) window._plannedDetails = {};
      if(!window._plannedSelected) window._plannedSelected = new Set();

      const label = PLANNED_SUBS[key] || key;
      const fields = PLANNED_FIELDS[key] || [];
      const details = window._plannedDetails[key] || {};
      const isSelected = window._plannedSelected.has(key);

      const sheet = document.createElement('div');
      sheet.className = 'ios-sheet-overlay active';
      sheet.style.zIndex = '10001';

      const fieldsHtml = fields.map(f => `
        <div>
          <label style="font-size:var(--font-size-footnote);font-weight:500;color:var(--text-secondary);display:block;margin-bottom:6px;">${f.label}</label>
          <input data-field="${f.id}" type="${f.type}" placeholder="${f.placeholder}" value="${escapeHtml(String(details[f.id] || ''))}"
            style="width:100%;padding:12px 14px;border-radius:12px;border:0.5px solid var(--separator);background:var(--surface-2);color:var(--text);font-size:var(--font-size-body);box-sizing:border-box;outline:none;">
        </div>`).join('');

      sheet.innerHTML = `
        <div class="ios-sheet">
          <div class="ios-sheet-handle"></div>
          <div class="ios-sheet-header">
            <div>
              <h2 style="font-size:var(--font-size-title-3);font-weight:600;color:var(--text);margin:0;">${escapeHtml(label)}</h2>
              <p style="font-size:var(--font-size-subheadline);color:var(--text-secondary);margin:var(--space-xs) 0 0 0;">Укажите детали</p>
            </div>
            <button class="ios-sheet-close" data-close-planned><i data-lucide="x"></i></button>
          </div>
          <div class="ios-sheet-content">
            <div style="display:flex;flex-direction:column;gap:var(--space-md);">${fieldsHtml}</div>
            <div style="margin-top:var(--space-lg);display:flex;gap:var(--space-sm);">
              ${isSelected ? `<button class="ios-button" data-remove-planned>Снять</button>` : ''}
              <button class="ios-button" data-confirm-planned style="flex:1;background:var(--accent);color:#fff;">Готово</button>
            </div>
          </div>
        </div>`;

      document.body.appendChild(sheet);
      if(typeof lucide !== 'undefined') lucide.createIcons();

      function closeSheet() {
        sheet.classList.remove('active');
        setTimeout(() => { if(sheet.parentNode) sheet.remove(); }, 250);
      }

      sheet.querySelector('[data-close-planned]').onclick = closeSheet;
      sheet.addEventListener('click', e => { if(e.target === sheet) closeSheet(); });

      const removeBtn = sheet.querySelector('[data-remove-planned]');
      if(removeBtn) {
        removeBtn.onclick = () => {
          window._plannedSelected.delete(key);
          delete window._plannedDetails[key];
          btn.style.boxShadow = '';
          btn.querySelector('.pl-chk')?.remove();
          renderPlannedCosts();
          closeSheet();
        };
      }

      sheet.querySelector('[data-confirm-planned]').onclick = () => {
        const saved = {};
        sheet.querySelectorAll('[data-field]').forEach(el => {
          if(el.value.trim()) saved[el.dataset.field] = el.value.trim();
        });
        window._plannedDetails[key] = saved;
        window._plannedSelected.add(key);
        btn.style.boxShadow = '0 0 0 2px #34C759';
        btn.style.borderRadius = '14px';
        if(!btn.querySelector('.pl-chk'))
          btn.insertAdjacentHTML('beforeend','<div class="pl-chk" style="position:absolute;top:5px;right:5px;width:18px;height:18px;background:#34C759;border-radius:50%;display:flex;align-items:center;justify-content:center;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>');
        renderPlannedCosts();
        closeSheet();
      };

    }

    function renderPlannedCosts() {
      const wrap = document.getElementById('planned-costs-wrap');
      const list = document.getElementById('planned-costs-list');
      const totalEl = document.getElementById('planned-cost-total');
      if(!wrap || !list || !totalEl) return;
      if(window._plannedSelected.size === 0) { wrap.style.display = 'none'; return; }
      wrap.style.display = 'block';

      const existing = {};
      list.querySelectorAll('[data-pcost-key]').forEach(i => existing[i.dataset.pcostKey] = i.value);

      list.innerHTML = Array.from(window._plannedSelected).map(key => {
        const lbl = PLANNED_SUBS[key] || key;
        const det = window._plannedDetails[key] || {};
        const detSummary = Object.values(det).filter(Boolean).join(' · ');
        const val = existing[key] || '';
        return `<div style="display:flex;flex-direction:column;gap:4px;padding-bottom:var(--space-sm);border-bottom:0.5px solid var(--separator);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-md);">
            <div style="flex:1;">
              <span style="font-size:var(--font-size-body);font-weight:500;color:var(--text);">${escapeHtml(lbl)}</span>
              ${detSummary ? `<div style="font-size:var(--font-size-footnote);color:var(--text-secondary);margin-top:2px;">${escapeHtml(detSummary)}</div>` : ''}
            </div>
            <input type="number" data-pcost-key="${key}" placeholder="0.00" step="0.01" min="0" value="${val}"
              style="width:110px;padding:8px 10px;border-radius:10px;border:0.5px solid var(--separator);background:var(--surface-2);color:var(--text);font-size:var(--font-size-body);text-align:right;">
          </div>
        </div>`;
      }).join('');

      list.querySelectorAll('[data-pcost-key]').forEach(inp => {
        inp.addEventListener('input', () => {
          let sum = 0;
          list.querySelectorAll('[data-pcost-key]').forEach(i => sum += parseFloat(i.value || 0));
          document.getElementById('planned-cost-total').textContent = sum.toFixed(2);
        });
      });
      let sum = 0;
      list.querySelectorAll('[data-pcost-key]').forEach(i => sum += parseFloat(i.value || 0));
      totalEl.textContent = sum.toFixed(2);
    }

    function savePlannedEntry() {
      const carId = currentCarId || state.cars[0]?.id;
      if(!carId) { showToast('Выберите автомобиль'); return; }
      const date = document.getElementById('planned-date')?.value;
      if(!date) { showToast('Укажите дату'); return; }
      if(!window._plannedSelected || window._plannedSelected.size === 0) { showToast('Выберите что заменили'); return; }

      const odometer = parseFloat(document.getElementById('planned-odometer')?.value || 0);
      const shop = document.getElementById('planned-shop')?.value?.trim() || '';
      const notes = document.getElementById('planned-notes')?.value?.trim() || '';

      const costMap = {};
      document.querySelectorAll('#planned-costs-list [data-pcost-key]').forEach(inp => {
        costMap[inp.dataset.pcostKey] = parseFloat(inp.value || 0);
      });
      const totalCost = Object.values(costMap).reduce((s, v) => s + v, 0);
      const typeLabel = Array.from(window._plannedSelected).map(k => PLANNED_SUBS[k] || k).join(', ');

      // АКБ → паспорт авто
      const batDetails = window._plannedDetails['battery'];
      if(window._plannedSelected.has('battery') && batDetails?.brand) {
        const car = state.cars.find(c => c.id === carId);
        if(car) { car.akbBrand = batDetails.brand; car.akbCapacity = batDetails.capacity || ''; car.akbDate = date; car.akbOdometer = odometer; }
      }

      if(!state.service) state.service = [];
      state.service.push({
        id: Date.now().toString(), carId, date, odometer,
        type: 'planned', typeLabel,
        items: Array.from(window._plannedSelected),
        detailsMap: window._plannedDetails,
        costMap, cost: totalCost, shop, notes,
        createdAt: new Date().toISOString(), deletedAt: null
      });

      if(saveAppState()) {
        showToast('Сохранено');
        if(currentCarId) { loadCarDetails(currentCarId); showView('screen-car-details'); }
        else showView('screen-diary');
      }
    }

    function initAdminScreen() {
      window._adminSelected = new Set();

      ['admin-date','admin-odometer','admin-notes','admin-other-text']
        .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
      const dateEl = document.getElementById('admin-date');
      if(dateEl) dateEl.value = new Date().toISOString().split('T')[0];

      document.querySelectorAll('.admin-cat-btn').forEach(btn => {
        btn.style.boxShadow = '';
        btn.querySelector('.admin-chk')?.remove();
      });
      const otherWrap = document.getElementById('admin-other-wrap');
      if(otherWrap) otherWrap.style.display = 'none';
      renderAdminCosts();

      document.querySelectorAll('.admin-cat-btn').forEach(btn => {
        btn.onclick = () => {
          const val = btn.dataset.admin;
          if(window._adminSelected.has(val)) {
            window._adminSelected.delete(val);
            btn.style.boxShadow = '';
            btn.querySelector('.admin-chk')?.remove();
          } else {
            window._adminSelected.add(val);
            btn.style.boxShadow = '0 0 0 2px #34C759';
            btn.style.borderRadius = '14px';
            if(!btn.querySelector('.admin-chk'))
              btn.insertAdjacentHTML('beforeend', '<div class="admin-chk" style="position:absolute;top:5px;right:5px;width:18px;height:18px;background:#34C759;border-radius:50%;display:flex;align-items:center;justify-content:center;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>');
          }
          if(otherWrap) otherWrap.style.display = window._adminSelected.has('other') ? '' : 'none';
          renderAdminCosts();
        };
      });

      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function renderAdminCosts() {
      const wrap = document.getElementById('admin-costs-wrap');
      const list = document.getElementById('admin-costs-list');
      const totalEl = document.getElementById('admin-cost-total');
      if(!wrap || !list || !totalEl) return;

      if(window._adminSelected.size === 0) { wrap.style.display = 'none'; return; }
      wrap.style.display = '';

      // Keep existing values
      const existing = {};
      list.querySelectorAll('[data-cost-key]').forEach(inp => {
        existing[inp.dataset.costKey] = inp.value;
      });

      list.innerHTML = Array.from(window._adminSelected).map(key => {
        const label = key === 'other'
          ? (document.getElementById('admin-other-text')?.value?.trim() || 'Прочее')
          : (ADMIN_CATS[key] || key);
        const val = existing[key] || '';
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-md);">
          <span style="flex:1;font-size:var(--font-size-body);color:var(--text);">${escapeHtml(label)}</span>
          <input type="number" data-cost-key="${key}" placeholder="0.00" step="0.01" min="0" value="${val}"
            style="width:110px;padding:8px 10px;border-radius:10px;border:0.5px solid var(--separator);background:var(--surface-2);color:var(--text);font-size:var(--font-size-body);text-align:right;">
        </div>`;
      }).join('');

      // Recalculate total on input
      list.querySelectorAll('[data-cost-key]').forEach(inp => {
        inp.addEventListener('input', updateAdminTotal);
      });
      updateAdminTotal();
    }

    function updateAdminTotal() {
      const totalEl = document.getElementById('admin-cost-total');
      if(!totalEl) return;
      let sum = 0;
      document.querySelectorAll('#admin-costs-list [data-cost-key]').forEach(inp => {
        sum += parseFloat(inp.value || 0);
      });
      totalEl.textContent = sum.toFixed(2);
    }

    function saveAdminEntry() {
      const carId = currentCarId || state.cars[0]?.id;
      if(!carId) { showToast('Выберите автомобиль'); return; }

      const date = document.getElementById('admin-date')?.value;
      if(!date) { showToast('Укажите дату'); return; }
      if(window._adminSelected.size === 0) { showToast('Выберите категорию'); return; }

      const odometer = parseFloat(document.getElementById('admin-odometer')?.value || 0);
      const notes = document.getElementById('admin-notes')?.value?.trim() || '';
      const otherText = document.getElementById('admin-other-text')?.value?.trim() || '';

      // Collect per-category costs
      const costMap = {};
      document.querySelectorAll('#admin-costs-list [data-cost-key]').forEach(inp => {
        costMap[inp.dataset.costKey] = parseFloat(inp.value || 0);
      });
      const totalCost = Object.values(costMap).reduce((s, v) => s + v, 0);

      const parts = Array.from(window._adminSelected).map(k =>
        k === 'other' ? (otherText || 'Прочее') : (ADMIN_CATS[k] || k)
      );

      if(!state.service) state.service = [];
      state.service.push({
        id: Date.now().toString(),
        carId, date, odometer,
        type: 'admin',
        typeLabel: parts.join(', '),
        categories: Array.from(window._adminSelected),
        costMap, cost: totalCost,
        otherText, notes,
        createdAt: new Date().toISOString(),
        deletedAt: null
      });

      if(saveAppState()) {
        showToast('Сохранено');
        if(currentCarId) { loadCarDetails(currentCarId); showView('screen-car-details'); }
        else showView('screen-diary');
      }
    }

    // ── Wheels screen ──────────────────────────────────────────────
    const WHEELS_LABELS = {
      summer:  'Установка летней резины',
      winter:  'Установка зимней резины',
      newtire: 'Новая резина',
      balance: 'Балансировка',
      bead:    'Бортировка',
      inflate: 'Подкачка',
      other:   'Прочее',
    };

    function renderWheelsCosts() {
      const wrap = document.getElementById('wheels-costs-wrap');
      const list = document.getElementById('wheels-costs-list');
      const totalEl = document.getElementById('wheels-cost-total');
      if(!wrap || !list || !totalEl) return;

      // Collect active items
      const items = [];
      if(window._wheelsInstall) items.push(window._wheelsInstall);
      if(window._wheelsNewTire) items.push('newtire');
      window._wheelsWorks.forEach(w => items.push(w));

      if(items.length === 0) { wrap.style.display = 'none'; return; }
      wrap.style.display = '';

      // Preserve existing values
      const existing = {};
      list.querySelectorAll('[data-wcost-key]').forEach(inp => {
        existing[inp.dataset.wcostKey] = inp.value;
      });

      list.innerHTML = items.map(key => {
        let label = WHEELS_LABELS[key] || key;
        if(key === 'newtire') {
          const brand = document.getElementById('tire-brand')?.value?.trim();
          const size  = document.getElementById('tire-size')?.value?.trim();
          if(brand || size) label += ' ' + [brand, size].filter(Boolean).join(' ');
        }
        if(key === 'other') {
          const t = document.getElementById('wheels-other-text')?.value?.trim();
          if(t) label = t;
        }
        const val = existing[key] || '';
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-md);">
          <span style="flex:1;font-size:var(--font-size-body);color:var(--text);">${escapeHtml(label)}</span>
          <input type="number" data-wcost-key="${key}" placeholder="0.00" step="0.01" min="0" value="${val}"
            style="width:110px;padding:8px 10px;border-radius:10px;border:0.5px solid var(--separator);background:var(--surface-2);color:var(--text);font-size:var(--font-size-body);text-align:right;">
        </div>`;
      }).join('');

      list.querySelectorAll('[data-wcost-key]').forEach(inp => {
        inp.addEventListener('input', updateWheelsTotal);
      });
      updateWheelsTotal();
    }

    function updateWheelsTotal() {
      const totalEl = document.getElementById('wheels-cost-total');
      if(!totalEl) return;
      let sum = 0;
      document.querySelectorAll('#wheels-costs-list [data-wcost-key]').forEach(inp => {
        sum += parseFloat(inp.value || 0);
      });
      totalEl.textContent = sum.toFixed(2);
    }

    function initWheelsScreen() {
      // Reset state
      window._wheelsInstall = null;   // 'summer' | 'winter' | null
      window._wheelsWorks  = new Set(); // 'balance' | 'bead' | 'inflate' | 'other'
      window._wheelsNewTire = false;

      // Reset form fields
      ['wheels-date','wheels-odometer','wheels-shop','tire-brand','tire-size','wheels-other-text']
        .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
      const dateEl = document.getElementById('wheels-date');
      if(dateEl) dateEl.value = new Date().toISOString().split('T')[0];

      // Reset UI
      document.querySelectorAll('.wheels-install-btn, .wheels-work-btn, #btn-new-tire').forEach(b => {
        b.style.boxShadow = '';
        const chk = b.querySelector('.wheels-chk');
        if(chk) chk.remove();
      });
      const newTireForm = document.getElementById('new-tire-form');
      if(newTireForm) newTireForm.style.display = 'none';
      const otherWrap = document.getElementById('wheels-other-wrap');
      if(otherWrap) otherWrap.style.display = 'none';
      renderWheelsCosts();

      // Install buttons — radio (only one)
      document.querySelectorAll('.wheels-install-btn').forEach(btn => {
        btn.onclick = () => {
          const val = btn.dataset.install;
          if(window._wheelsInstall === val) {
            window._wheelsInstall = null;
            btn.style.boxShadow = '';
            btn.querySelector('.wheels-chk')?.remove();
          } else {
            document.querySelectorAll('.wheels-install-btn').forEach(b => {
              b.style.boxShadow = '';
              b.querySelector('.wheels-chk')?.remove();
            });
            window._wheelsInstall = val;
            btn.style.boxShadow = '0 0 0 2px #34C759';
            btn.style.borderRadius = '14px';
            btn.insertAdjacentHTML('beforeend', '<div class="wheels-chk" style="position:absolute;top:5px;right:5px;width:18px;height:18px;background:#34C759;border-radius:50%;display:flex;align-items:center;justify-content:center;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>');
          }
          renderWheelsCosts();
        };
      });

      // New tire toggle
      const btnNewTire = document.getElementById('btn-new-tire');
      if(btnNewTire) {
        btnNewTire.onclick = () => {
          window._wheelsNewTire = !window._wheelsNewTire;
          if(window._wheelsNewTire) {
            btnNewTire.style.boxShadow = '0 0 0 2px #34C759';
            btnNewTire.style.borderRadius = '14px';
            if(!btnNewTire.querySelector('.wheels-chk'))
              btnNewTire.insertAdjacentHTML('beforeend', '<div class="wheels-chk" style="position:absolute;top:5px;right:5px;width:18px;height:18px;background:#34C759;border-radius:50%;display:flex;align-items:center;justify-content:center;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>');
            document.getElementById('new-tire-form').style.display = '';
          } else {
            btnNewTire.style.boxShadow = '';
            btnNewTire.querySelector('.wheels-chk')?.remove();
            document.getElementById('new-tire-form').style.display = 'none';
          }
          renderWheelsCosts();
        };
      }

      // Work buttons — multi-select
      document.querySelectorAll('.wheels-work-btn').forEach(btn => {
        btn.onclick = () => {
          const val = btn.dataset.work;
          if(window._wheelsWorks.has(val)) {
            window._wheelsWorks.delete(val);
            btn.style.boxShadow = '';
            btn.querySelector('.wheels-chk')?.remove();
          } else {
            window._wheelsWorks.add(val);
            btn.style.boxShadow = '0 0 0 2px #34C759';
            btn.style.borderRadius = '14px';
            if(!btn.querySelector('.wheels-chk'))
              btn.insertAdjacentHTML('beforeend', '<div class="wheels-chk" style="position:absolute;top:5px;right:5px;width:18px;height:18px;background:#34C759;border-radius:50%;display:flex;align-items:center;justify-content:center;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>');
          }
          document.getElementById('wheels-other-wrap').style.display =
            window._wheelsWorks.has('other') ? '' : 'none';
          renderWheelsCosts();
        };
      });

      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function saveWheelsEntry() {
      const carId = currentCarId || state.cars[0]?.id;
      if(!carId) { showToast('Выберите автомобиль'); return; }

      const date = document.getElementById('wheels-date')?.value;
      if(!date) { showToast('Укажите дату'); return; }

      const hasInstall = !!window._wheelsInstall;
      const hasWork = window._wheelsWorks.size > 0;
      const hasNewTire = !!window._wheelsNewTire;
      if(!hasInstall && !hasWork && !hasNewTire) {
        showToast('Выберите хотя бы один пункт');
        return;
      }

      const odometer = parseFloat(document.getElementById('wheels-odometer')?.value || 0);
      const shop = document.getElementById('wheels-shop')?.value?.trim() || '';
      const tireBrand = document.getElementById('tire-brand')?.value?.trim() || '';
      const tireSize = document.getElementById('tire-size')?.value?.trim() || '';
      const otherText = document.getElementById('wheels-other-text')?.value?.trim() || '';

      // Collect per-item costs
      const costMap = {};
      document.querySelectorAll('#wheels-costs-list [data-wcost-key]').forEach(inp => {
        costMap[inp.dataset.wcostKey] = parseFloat(inp.value || 0);
      });
      const cost = Object.values(costMap).reduce((s, v) => s + v, 0);
      const tireCost = costMap['newtire'] || 0;

      // Build label
      const parts = [];
      if(window._wheelsInstall === 'summer') parts.push('Установка летней резины');
      if(window._wheelsInstall === 'winter') parts.push('Установка зимней резины');
      if(hasNewTire) parts.push('Новая резина' + (tireBrand ? ' ' + tireBrand : '') + (tireSize ? ' ' + tireSize : ''));
      if(window._wheelsWorks.has('balance')) parts.push('Балансировка');
      if(window._wheelsWorks.has('bead')) parts.push('Бортировка');
      if(window._wheelsWorks.has('inflate')) parts.push('Подкачка');
      if(window._wheelsWorks.has('other') && otherText) parts.push(otherText);
      else if(window._wheelsWorks.has('other')) parts.push('Прочее');

      if(!state.service) state.service = [];
      state.service.push({
        id: Date.now().toString(),
        carId,
        date,
        odometer,
        type: 'wheels',
        typeLabel: parts.join(', '),
        installType: window._wheelsInstall,
        newTire: hasNewTire ? { brand: tireBrand, size: tireSize, cost: tireCost } : null,
        works: Array.from(window._wheelsWorks),
        costMap, cost,
        otherText,
        shop,
        notes: '',
        createdAt: new Date().toISOString(),
        deletedAt: null
      });

      // If new tire — save to car passport
      if(hasNewTire && (tireBrand || tireSize)) {
        const car = state.cars.find(c => c.id === carId);
        if(car) {
          car.tires = car.tires || {};
          car.tires.brand = tireBrand || car.tires.brand;
          car.tires.size = tireSize || car.tires.size;
          if(tireCost) car.tires.cost = tireCost;
          car.tires.installedDate = date;
          car.tires.installedOdometer = odometer || car.tires.installedOdometer;
          car.tires.type = window._wheelsInstall || car.tires.type;
        }
      }

      if(saveAppState()) {
        showToast('Сохранено');
        if(currentCarId) { loadCarDetails(currentCarId); showView('screen-car-details'); }
        else showView('screen-diary');
      }
    }

    // Save charge (EV) entry
    function saveChargeEntry() {
      const carId = currentCarId || state.cars[0]?.id;
      if(!carId) { showToast('Выберите автомобиль'); return; }

      const date = document.getElementById('charge-date')?.value;
      const odometer = parseFloat(document.getElementById('charge-odometer')?.value || 0);
      const kwh = parseFloat(document.getElementById('charge-kwh')?.value || 0);
      const totalCost = parseFloat(document.getElementById('charge-cost')?.value || 0);
      const station = document.getElementById('charge-station')?.value?.trim() || '';
      const notes = document.getElementById('charge-notes')?.value?.trim() || '';

      if(!date || !odometer || !kwh || !totalCost) {
        showToast('Заполните все обязательные поля');
        return;
      }

      if(!state.charges) state.charges = [];
      state.charges.push({
        id: Date.now().toString(),
        carId,
        date,
        odometer,
        kwh,
        totalCost,
        pricePerKwh: kwh > 0 ? (totalCost / kwh).toFixed(2) : 0,
        station,
        notes,
        createdAt: new Date().toISOString(),
        deletedAt: null
      });

      if(saveAppState()) {
        showToast('Зарядка добавлена');
        document.getElementById('charge-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('charge-odometer').value = '';
        document.getElementById('charge-kwh').value = '';
        document.getElementById('charge-cost').value = '';
        document.getElementById('charge-station').value = '';
        document.getElementById('charge-notes').value = '';
        const row = document.getElementById('charge-price-per-kwh-row');
        if(row) row.style.display = 'none';
        if(currentCarId) { loadCarDetails(currentCarId); showView('screen-car-details'); }
        else showView('screen-diary');
      }
    }

    // Edit service entry
    function editServiceEntry(serviceId) {
      const service = (state.service || []).find(s => s.id === serviceId);
      if(!service) return;
      
      editingServiceId = serviceId;
      currentCarId = service.carId;
      
      // Fill form
      const typeInput = document.getElementById('service-type');
      const typeLabelInput = document.getElementById('service-type-label');
      const otherField = document.getElementById('service-other-field');
      const dateInput = document.getElementById('service-date');
      const odometerInput = document.getElementById('service-odometer');
      const costInput = document.getElementById('service-cost');
      const shopInput = document.getElementById('service-shop');
      const notesInput = document.getElementById('service-notes');
      
      if(typeInput) {
        typeInput.value = service.type || '';
        if(service.type === 'other' && otherField) {
          otherField.style.display = 'block';
          if(typeLabelInput) typeLabelInput.value = service.typeLabel || '';
        }
      }
      if(dateInput) dateInput.value = service.date || '';
      if(odometerInput) odometerInput.value = service.odometer || '';
      if(costInput) costInput.value = service.cost || '';
      if(shopInput) shopInput.value = service.shop || '';
      if(notesInput) notesInput.value = service.notes || '';
      
      // Load receipts if any
      if(service.receipts && service.receipts.length > 0) {
        window.tempServiceReceipts = service.receipts;
        renderReceiptsPreview('service-receipts-preview', service.receipts);
      }
      
      showView('screen-add-service');
    }
    
    // Save service entry
    function saveServiceEntry() {
      const carId = currentCarId || state.cars[0]?.id;
      if(!carId) {
        showToast('Выберите автомобиль');
        return;
      }
      
      const multiTypes = window.selectedServiceTypes && window.selectedServiceTypes.length > 0
        ? window.selectedServiceTypes
        : null;
      const type = document.getElementById('service-type')?.value;
      const typeLabel = type === 'other' ?
        (document.getElementById('service-type-label')?.value?.trim() || 'Другое') :
        ((typeof Service !== 'undefined' && Service.TYPES && Service.TYPES[type]) ? Service.TYPES[type] : 'Другое');
      const date = document.getElementById('service-date')?.value;
      const odometer = parseFloat(document.getElementById('service-odometer')?.value || 0);
      const cost = parseFloat(document.getElementById('service-cost')?.value || 0);
      const shop = document.getElementById('service-shop')?.value?.trim() || '';
      const notes = document.getElementById('service-notes')?.value?.trim() || '';

      if(!date || (!type && !multiTypes)) {
        showToast('Выберите категорию расходов');
        return;
      }

      // Multi-type: create one record per type
      if (multiTypes && multiTypes.length > 1) {
        const proceed = () => {
          multiTypes.forEach(t => {
            proceedSaveService(carId, t.type, t.label, date, odometer, cost, shop, notes);
          });
          window.selectedServiceTypes = [];
          updateServiceTypeDisplay();
        };
        if (odometer > 0) {
          const validation = validateOdometer(carId, odometer);
          if (!validation.valid) {
            showModal('Предупреждение', validation.message, proceed);
            return;
          }
        }
        proceed();
        return;
      }

      // Validate odometer if provided
      if(odometer > 0) {
        const validation = validateOdometer(carId, odometer);
        if(!validation.valid) {
          showModal('Предупреждение', validation.message, () => {
            proceedSaveService(carId, type, typeLabel, date, odometer, cost, shop, notes);
          });
          return;
        }
      }
      
      proceedSaveService(carId, type, typeLabel, date, odometer, cost, shop, notes);
    }
    
    function proceedSaveService(carId, type, typeLabel, date, odometer, cost, shop, notes) {
      if(!state.service) state.service = [];
      
      // Get receipts from preview
      const receipts = window.tempServiceReceipts || [];
      
      if(editingServiceId) {
        // Update existing entry
        const index = state.service.findIndex(s => s.id === editingServiceId);
        if(index >= 0) {
          const existing = state.service[index];
          state.service[index] = {
            ...existing,
            type,
            typeLabel,
            date,
            odometer,
            cost,
            shop,
            notes,
            receipts: receipts.length > 0 ? receipts : existing.receipts
          };
          
          // Auto-update maintenance plan
          if (typeof MaintenancePlan !== 'undefined' && MaintenancePlan.matchServiceToPlan) {
            const car = state.cars.find(c => c.id === carId);
            if (car && car.servicePlan && car.servicePlan.length > 0) {
              const planItems = car.servicePlan.filter(p => p.enabled);
              const matchedItem = MaintenancePlan.matchServiceToPlan(state.service[index], planItems);
              if (matchedItem) {
                const updatedItem = MaintenancePlan.updateFromServiceEntry(matchedItem, state.service[index]);
                const planIndex = car.servicePlan.findIndex(p => p.id === matchedItem.id);
                if (planIndex >= 0) {
                  car.servicePlan[planIndex] = updatedItem;
                }
              }
            }
          }
          
          editingServiceId = null;
        }
      } else {
        // Create new entry
        const serviceRecord = (typeof Service !== 'undefined' && Service.addRecord) ? 
          Service.addRecord(carId, {
            type,
            typeLabel,
            date,
            odometer,
            cost,
            shop,
            notes
          }) : {
            id: Date.now().toString(),
            carId,
            date,
            odometer,
            type,
            typeLabel,
            cost,
            shop,
            notes,
            createdAt: new Date().toISOString(),
            deletedAt: null
          };
        
        // Add receipts to record
        if(receipts.length > 0) {
          serviceRecord.receipts = receipts;
        }
        
        state.service.push(serviceRecord);
        
        // Auto-update maintenance plan if matching item exists
        if (typeof MaintenancePlan !== 'undefined' && MaintenancePlan.matchServiceToPlan) {
          const car = state.cars.find(c => c.id === carId);
          if (car && car.servicePlan && car.servicePlan.length > 0) {
            const planItems = car.servicePlan.filter(p => p.enabled);
            const matchedItem = MaintenancePlan.matchServiceToPlan(serviceRecord, planItems);
            if (matchedItem) {
              const updatedItem = MaintenancePlan.updateFromServiceEntry(matchedItem, serviceRecord);
              const index = car.servicePlan.findIndex(p => p.id === matchedItem.id);
              if (index >= 0) {
                car.servicePlan[index] = updatedItem;
              }
            }
          }
        }
      }
      
      // Auto-update maintenance plan if matching item exists
      if (typeof MaintenancePlan !== 'undefined' && MaintenancePlan.matchServiceToPlan) {
        const car = state.cars.find(c => c.id === carId);
        if (car && car.servicePlan && car.servicePlan.length > 0) {
          const planItems = car.servicePlan.filter(p => p.enabled);
          const matchedItem = MaintenancePlan.matchServiceToPlan(serviceRecord, planItems);
          if (matchedItem) {
            const updatedItem = MaintenancePlan.updateFromServiceEntry(matchedItem, serviceRecord);
            const index = car.servicePlan.findIndex(p => p.id === matchedItem.id);
            if (index >= 0) {
              car.servicePlan[index] = updatedItem;
            }
          }
        }
      }
      
      if(saveAppState()) {
        showToast('Запись сервиса добавлена');
        // Reset form
        document.getElementById('service-type').value = '';
        document.getElementById('service-type-label').value = '';
        document.getElementById('service-other-field').style.display = 'none';
        document.getElementById('service-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('service-odometer').value = '';
        document.getElementById('service-cost').value = '';
        document.getElementById('service-shop').value = '';
        document.getElementById('service-notes').value = '';
        
        // Clear receipts
        window.tempServiceReceipts = [];
        renderReceiptsPreview('service-receipts-preview', []);
        
        // Return to car details or diary
        if(currentCarId) {
          loadCarDetails(currentCarId);
          showView('screen-car-details');
        } else {
          showView('screen-diary');
        }
      }
    }
    
    // Receipts handling functions
    let tempExpenseReceipts = [];
    let tempServiceReceipts = [];
    window.tempExpenseReceipts = tempExpenseReceipts;
    window.tempServiceReceipts = tempServiceReceipts;
    
    function initializeReceiptsHandlers() {
      // Prevent duplicate handlers
      if (window.receiptsHandlersInitialized) return;
      window.receiptsHandlersInitialized = true;
      
      // Expense receipts
      const expenseAddBtn = document.getElementById('expense-add-receipt-btn');
      const expenseInput = document.getElementById('expense-receipt-input');
      const expensePreview = document.getElementById('expense-receipts-preview');
      
      if(expenseAddBtn && expenseInput) {
        expenseAddBtn.addEventListener('click', () => {
          expenseInput.click();
        });
        
        expenseInput.addEventListener('change', async (e) => {
          const files = Array.from(e.target.files || []);
          if(files.length === 0) return;
          
          if(typeof Receipts === 'undefined') {
            showToast('Модуль работы с изображениями не загружен');
            return;
          }
          
          try {
            for(const file of files) {
              if(window.tempExpenseReceipts.length >= Receipts.MAX_IMAGES) {
                showToast(`Максимум ${Receipts.MAX_IMAGES} изображений`);
                break;
              }
              
              const compressed = await Receipts.compressImage(file);
              window.tempExpenseReceipts.push(compressed);
            }
            
            renderReceiptsPreview('expense-receipts-preview', window.tempExpenseReceipts);
            if(typeof lucide !== 'undefined') lucide.createIcons();
          } catch(err) {
            showToast('Ошибка обработки изображения: ' + err.message);
            console.error(err);
          }
          
          // Reset input
          expenseInput.value = '';
        });
      }
      
      // Service receipts
      const serviceAddBtn = document.getElementById('service-add-receipt-btn');
      const serviceInput = document.getElementById('service-receipt-input');
      
      if(serviceAddBtn && serviceInput) {
        serviceAddBtn.addEventListener('click', () => {
          serviceInput.click();
        });
        
        serviceInput.addEventListener('change', async (e) => {
          const files = Array.from(e.target.files || []);
          if(files.length === 0) return;
          
          if(typeof Receipts === 'undefined') {
            showToast('Модуль работы с изображениями не загружен');
            return;
          }
          
          try {
            for(const file of files) {
              if(window.tempServiceReceipts.length >= Receipts.MAX_IMAGES) {
                showToast(`Максимум ${Receipts.MAX_IMAGES} изображений`);
                break;
              }
              
              const compressed = await Receipts.compressImage(file);
              window.tempServiceReceipts.push(compressed);
            }
            
            renderReceiptsPreview('service-receipts-preview', window.tempServiceReceipts);
            if(typeof lucide !== 'undefined') lucide.createIcons();
          } catch(err) {
            showToast('Ошибка обработки изображения: ' + err.message);
            console.error(err);
          }
          
          // Reset input
          serviceInput.value = '';
        });
      }
      
      // Receipt viewer
      const viewerOverlay = document.getElementById('receipt-viewer-overlay');
      const viewerImage = document.getElementById('receipt-viewer-image');
      const viewerClose = document.getElementById('receipt-viewer-close');
      
      if(viewerClose) {
        viewerClose.addEventListener('click', () => {
          if(viewerOverlay) viewerOverlay.style.display = 'none';
        });
      }
      
      if(viewerOverlay) {
        viewerOverlay.addEventListener('click', (e) => {
          if(e.target === viewerOverlay) {
            viewerOverlay.style.display = 'none';
          }
        });
      }
    }
    
    function renderReceiptsPreview(containerId, receipts) {
      const container = document.getElementById(containerId);
      if(!container) return;
      
      if(receipts.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
      }
      
      container.style.display = 'flex';
      container.innerHTML = '';
      
      receipts.forEach((receipt, index) => {
        const thumbnail = document.createElement('div');
        thumbnail.style.cssText = 'position: relative; width: 80px; height: 80px; border-radius: var(--radius-md); overflow: hidden; background: var(--surface); border: 1px solid var(--separator);';
        
        const img = document.createElement('img');
        img.src = receipt.dataUrl;
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; cursor: pointer;';
        img.addEventListener('click', () => {
          const viewerImage = document.getElementById('receipt-viewer-image');
          const viewerOverlay = document.getElementById('receipt-viewer-overlay');
          if(viewerImage && viewerOverlay) {
            viewerImage.src = receipt.dataUrl;
            viewerOverlay.style.display = 'flex';
            if(typeof lucide !== 'undefined') lucide.createIcons();
          }
        });
        
        const removeBtn = document.createElement('button');
        removeBtn.style.cssText = 'position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border-radius: 50%; background: rgba(0,0,0,0.6); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;';
        removeBtn.innerHTML = '<i data-lucide="x" style="width: 14px; height: 14px;"></i>';
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if(containerId === 'expense-receipts-preview') {
            window.tempExpenseReceipts.splice(index, 1);
            renderReceiptsPreview(containerId, window.tempExpenseReceipts);
          } else if(containerId === 'service-receipts-preview') {
            window.tempServiceReceipts.splice(index, 1);
            renderReceiptsPreview(containerId, window.tempServiceReceipts);
          }
          if(typeof lucide !== 'undefined') lucide.createIcons();
        });
        
        thumbnail.appendChild(img);
        thumbnail.appendChild(removeBtn);
        container.appendChild(thumbnail);
      });
    }
    
    // Reports functions
    function initializeReportsScreen() {
      // Populate car select
      const carSelect = document.getElementById('reports-car-select');
      if(carSelect) {
        carSelect.innerHTML = '<option value="">Все автомобили</option>';
        (state.cars || []).filter(c => !c.deletedAt).forEach(car => {
          const option = document.createElement('option');
          option.value = car.id;
          option.textContent = `${car.brand} ${car.model}`;
          carSelect.appendChild(option);
        });
      }
      
      // Set default dates (last 30 days)
      const dateTo = document.getElementById('reports-date-to');
      const dateFrom = document.getElementById('reports-date-from');
      if(dateTo && !dateTo.value) {
        dateTo.value = new Date().toISOString().split('T')[0];
      }
      if(dateFrom && !dateFrom.value) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        dateFrom.value = thirtyDaysAgo.toISOString().split('T')[0];
      }
      
      // Generate button
      const generateBtn = document.getElementById('reports-generate-btn');
      if(generateBtn) {
        generateBtn.onclick = null;
        generateBtn.addEventListener('click', () => {
          generateReport();
        });
      }
      
      // Print button
      const printBtn = document.getElementById('reports-print-btn');
      if(printBtn) {
        printBtn.onclick = null;
        printBtn.addEventListener('click', () => {
          printReport();
        });
      }
    }
    
    function generateReport() {
      const carId = document.getElementById('reports-car-select')?.value || null;
      const dateFrom = document.getElementById('reports-date-from')?.value || null;
      const dateTo = document.getElementById('reports-date-to')?.value || null;
      
      if(typeof Reports === 'undefined') {
        showToast('Модуль отчетов не загружен');
        return;
      }
      
      const reportData = Reports.generateReport(carId, dateFrom, dateTo, state);
      renderReport(reportData);
    }
    
    function renderReport(reportData) {
      const content = document.getElementById('reports-content');
      const printContent = document.getElementById('reports-print-content');
      if(!content) return;
      
      content.style.display = 'block';
      
      const car = reportData.carId ? state.cars.find(c => c.id === reportData.carId) : null;
      const carName = car ? `${car.brand} ${car.model}` : 'Все автомобили';
      const periodText = reportData.dateFrom && reportData.dateTo ?
        `${new Date(reportData.dateFrom).toLocaleDateString('ru-RU')} - ${new Date(reportData.dateTo).toLocaleDateString('ru-RU')}` :
        'За весь период';
      
      let html = `
        <div class="ios-group">
          <div class="ios-group-header">Сводка</div>
          <div class="ios-cell">
            <div class="ios-cell-content">
              <div class="ios-cell-title">Автомобиль</div>
              <div class="ios-cell-subtitle">${escapeHtml(carName)}</div>
            </div>
          </div>
          <div class="ios-cell">
            <div class="ios-cell-content">
              <div class="ios-cell-title">Период</div>
              <div class="ios-cell-subtitle">${escapeHtml(periodText)}</div>
            </div>
          </div>
          <div class="ios-cell">
            <div class="ios-cell-content">
              <div class="ios-cell-title">Всего потрачено</div>
              <div class="ios-cell-subtitle" style="font-size: var(--font-size-title-3); font-weight: 600; color: var(--primary);">
                ${reportData.totals.total.toLocaleString('ru-RU', {minimumFractionDigits: 2})} ₴
              </div>
            </div>
          </div>
        </div>
        
        <div class="ios-group" style="margin-top: var(--space-lg);">
          <div class="ios-group-header">Расходы по категориям</div>
          ${Object.values(reportData.expensesByCategory).map(cat => `
            <div class="ios-cell">
              <div class="ios-cell-content">
                <div class="ios-cell-title">${escapeHtml(cat.name)}</div>
                <div class="ios-cell-subtitle">
                  ${cat.total.toLocaleString('ru-RU', {minimumFractionDigits: 2})} ₴ • ${cat.count} записей
                </div>
                ${Object.keys(cat.bySubcategory).length > 0 ? `
                  <div style="margin-top: var(--space-xs); padding-left: var(--space-md);">
                    ${Object.values(cat.bySubcategory).map(sub => `
                      <div style="font-size: var(--font-size-caption); color: var(--text-secondary); margin-top: var(--space-xs);">
                        ${escapeHtml(sub.name)}: ${sub.total.toLocaleString('ru-RU', {minimumFractionDigits: 2})} ₴
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="ios-group" style="margin-top: var(--space-lg);">
          <div class="ios-group-header">Заправки</div>
          <div class="ios-cell">
            <div class="ios-cell-content">
              <div class="ios-cell-title">Всего потрачено</div>
              <div class="ios-cell-subtitle">${reportData.fuel.total.toLocaleString('ru-RU', {minimumFractionDigits: 2})} ₴</div>
            </div>
          </div>
          <div class="ios-cell">
            <div class="ios-cell-content">
              <div class="ios-cell-title">Средний расход</div>
              <div class="ios-cell-subtitle">${reportData.fuel.consumption ? reportData.fuel.consumption.toFixed(2) + ' L/100km' : 'Недостаточно данных'}</div>
            </div>
          </div>
          <div class="ios-cell">
            <div class="ios-cell-content">
              <div class="ios-cell-title">Количество заправок</div>
              <div class="ios-cell-subtitle">${reportData.fuel.entriesCount}</div>
            </div>
          </div>
        </div>
        
        <div class="ios-group" style="margin-top: var(--space-lg);">
          <div class="ios-group-header">Сервис</div>
          <div class="ios-cell">
            <div class="ios-cell-content">
              <div class="ios-cell-title">Всего потрачено</div>
              <div class="ios-cell-subtitle">${reportData.service.total.toLocaleString('ru-RU', {minimumFractionDigits: 2})} ₴</div>
            </div>
          </div>
          <div class="ios-cell">
            <div class="ios-cell-content">
              <div class="ios-cell-title">Количество записей</div>
              <div class="ios-cell-subtitle">${reportData.service.recordsCount}</div>
            </div>
          </div>
          ${Object.keys(reportData.service.byType).length > 0 ? `
            ${Object.values(reportData.service.byType).map(type => `
              <div class="ios-cell">
                <div class="ios-cell-content">
                  <div class="ios-cell-title">${escapeHtml(type.type)}</div>
                  <div class="ios-cell-subtitle">${type.total.toLocaleString('ru-RU', {minimumFractionDigits: 2})} ₴ • ${type.count} записей</div>
                </div>
              </div>
            `).join('')}
          ` : ''}
        </div>
      `;
      
      if(reportData.costPerKm) {
        html += `
          <div class="ios-group" style="margin-top: var(--space-lg);">
            <div class="ios-group-header">Стоимость эксплуатации</div>
            <div class="ios-cell">
              <div class="ios-cell-content">
                <div class="ios-cell-title">Стоимость за км</div>
                <div class="ios-cell-subtitle" style="font-size: var(--font-size-title-3); font-weight: 600; color: var(--primary);">
                  ${reportData.costPerKm.toFixed(2)} ₴/км
                </div>
              </div>
            </div>
          </div>
        `;
      }
      
      content.innerHTML = html;
      
      // Also render print version
      if(printContent) {
        printContent.innerHTML = `
          <div style="padding: var(--space-xl); font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
            <h1 style="font-size: 24px; margin-bottom: var(--space-md);">Отчет AutoDiary</h1>
            <p style="color: var(--text-secondary); margin-bottom: var(--space-lg);">
              ${escapeHtml(carName)} • ${escapeHtml(periodText)}
            </p>
            ${html.replace(/ios-group|ios-cell|ios-group-header|ios-cell-content|ios-cell-title|ios-cell-subtitle/g, (match) => {
              const map = {
                'ios-group': 'report-section',
                'ios-cell': 'report-item',
                'ios-group-header': 'report-header',
                'ios-cell-content': 'report-item-content',
                'ios-cell-title': 'report-item-title',
                'ios-cell-subtitle': 'report-item-subtitle'
              };
              return map[match] || match;
            })}
          </div>
        `;
      }
      
      if(typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    function printReport() {
      const printContent = document.getElementById('reports-print-content');
      if(!printContent || printContent.style.display === 'none') {
        showToast('Сначала сформируйте отчет');
        return;
      }
      
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Отчет AutoDiary</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; }
            .report-section { margin-bottom: 20px; }
            .report-header { font-weight: 600; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
            .report-item { margin: 10px 0; }
            .report-item-title { font-weight: 500; }
            .report-item-subtitle { color: #666; font-size: 14px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
    
    // Initialize category picker
    function initializeCategoryPicker() {
      const pickerSheet = document.getElementById('category-picker-sheet');
      if(!pickerSheet) return;
      
      let selectedCategoryId = null;
      let selectedSubcategoryId = null;
      
      // Close on overlay click
      pickerSheet.addEventListener('click', (e) => {
        if(e.target === pickerSheet) {
          closeCategoryPicker();
        }
      });
      
      // Back button
      const backBtn = document.getElementById('category-picker-back');
      if(backBtn) {
        backBtn.addEventListener('click', () => {
          showCategoryStep1();
        });
      }
      
      // Category selection
      pickerSheet.addEventListener('click', (e) => {
        const categoryCell = e.target.closest('[data-category-id]');
        if(categoryCell) {
          selectedCategoryId = categoryCell.dataset.categoryId;
          showCategoryStep2(selectedCategoryId);
          return;
        }
        
        const subcategoryCell = e.target.closest('[data-subcategory-id]');
        if(subcategoryCell) {
          selectedSubcategoryId = subcategoryCell.dataset.subcategoryId;
          completeCategorySelection(selectedCategoryId, selectedSubcategoryId);
          return;
        }
        
        const noSubcategoryBtn = e.target.closest('#no-subcategory-btn');
        if(noSubcategoryBtn) {
          completeCategorySelection(selectedCategoryId, null);
          return;
        }
      });
      
      // Search handlers
      const categorySearch = document.getElementById('category-search');
      if(categorySearch) {
        categorySearch.addEventListener('input', (e) => {
          filterCategories(e.target.value);
        });
      }
      
      const subcategorySearch = document.getElementById('subcategory-search');
      if(subcategorySearch) {
        subcategorySearch.addEventListener('input', (e) => {
          filterSubcategories(selectedCategoryId, e.target.value);
        });
      }
      
      // Add subcategory button
      const addSubBtn = document.getElementById('add-subcategory-btn');
      if(addSubBtn) {
        addSubBtn.addEventListener('click', () => {
          showAddSubcategoryDialog(selectedCategoryId);
        });
      }
    }
    
    function openCategoryPicker() {
      const pickerSheet = document.getElementById('category-picker-sheet');
      if(!pickerSheet) return;
      
      selectedCategoryId = null;
      selectedSubcategoryId = null;
      
      // Render categories
      renderCategoryPicker();
      
      pickerSheet.classList.add('active');
      showCategoryStep1();
    }
    
    function closeCategoryPicker() {
      const pickerSheet = document.getElementById('category-picker-sheet');
      if(pickerSheet) {
        pickerSheet.classList.remove('active');
      }
      showCategoryStep1();
    }
    
    function showCategoryStep1() {
      document.getElementById('category-picker-step1').style.display = 'block';
      document.getElementById('category-picker-step2').style.display = 'none';
      document.getElementById('category-picker-back').style.display = 'none';
      document.getElementById('category-picker-title').textContent = 'Выберите категорию';
      document.getElementById('category-picker-subtitle').textContent = 'Выберите категорию';
      selectedCategoryId = null;
    }
    
    function showCategoryStep2(categoryId) {
      if(!categoryId) return;
      
      selectedCategoryId = categoryId;
      document.getElementById('category-picker-step1').style.display = 'none';
      document.getElementById('category-picker-step2').style.display = 'block';
      document.getElementById('category-picker-back').style.display = 'block';
      
      const category = (state.categories || []).find(c => c.id === categoryId);
      const categoryName = category ? category.name : 'Категория';
      document.getElementById('category-picker-title').textContent = categoryName;
      document.getElementById('category-picker-subtitle').textContent = 'Выберите подкатегорию';
      
      renderSubcategoryPicker(categoryId);
    }
    
    function completeCategorySelection(categoryId, subcategoryId) {
      if(!categoryId) return;
      
      // Validate subcategory belongs to category
      if(subcategoryId) {
        const sub = (state.subcategories || []).find(s => s.id === subcategoryId);
        if(!sub || sub.categoryId !== categoryId) {
          showToast('Ошибка: подкатегория не соответствует категории');
          return;
        }
      }
      
      // Set values in form
      document.getElementById('expense-category-id').value = categoryId;
      document.getElementById('expense-subcategory-id').value = subcategoryId || '';
      
      // Update display
      const displayText = (typeof Categories !== 'undefined' && Categories.getDisplayText) ? 
        Categories.getDisplayText(state.categories || [], state.subcategories || [], categoryId, subcategoryId) :
        (categoryId + (subcategoryId ? ' • ' + subcategoryId : ' • Не указано'));
      document.getElementById('expense-category-value').textContent = displayText;
      
      closeCategoryPicker();
    }
    
    function renderCategoryPicker() {
      if(typeof Categories === 'undefined' || !Categories.getActive) return;
      
      const activeCategories = Categories.getActive(state.categories || []);
      const carId = currentCarId || state.cars[0]?.id;
      
      // Render recent combos
      if(carId && typeof Categories.getRecentCombos === 'function') {
        const recent = Categories.getRecentCombos(state.expenses || [], carId, 5);
        const recentList = document.getElementById('category-recent-list');
        if(recentList && recent.length > 0) {
          document.getElementById('category-recent-combos').style.display = 'block';
          recentList.innerHTML = '';
          const group = document.createElement('div');
          group.className = 'ios-group';
          recent.forEach(combo => {
            const cat = activeCategories.find(c => c.id === combo.categoryId);
            if(!cat) return;
            const sub = combo.subcategoryId ? 
              Categories.getSubcategoriesForCategory(state.subcategories || [], combo.categoryId)
                .find(s => s.id === combo.subcategoryId) : null;
            const displayText = Categories.getDisplayText(state.categories || [], state.subcategories || [], combo.categoryId, combo.subcategoryId);
            const cell = document.createElement('div');
            cell.className = 'ios-cell';
            cell.dataset.categoryId = combo.categoryId;
            cell.dataset.subcategoryId = combo.subcategoryId || '';
            cell.innerHTML = `
              <div class="ios-cell-content">
                <div class="ios-cell-title">${escapeHtml(displayText)}</div>
              </div>
            `;
            group.appendChild(cell);
          });
          recentList.appendChild(group);
        } else {
          document.getElementById('category-recent-combos').style.display = 'none';
        }
      }
      
      // Render frequent categories
      if(carId && typeof Categories.getFrequentCategories === 'function') {
        const frequent = Categories.getFrequentCategories(state.expenses || [], carId, state.categories || [], 8);
        const frequentList = document.getElementById('category-frequent-list');
        if(frequentList && frequent.length > 0) {
          document.getElementById('category-frequent').style.display = 'block';
          frequentList.innerHTML = '';
          const group = document.createElement('div');
          group.className = 'ios-group';
          frequent.forEach(cat => {
            const cell = document.createElement('div');
            cell.className = 'ios-cell';
            cell.dataset.categoryId = cat.id;
            cell.innerHTML = `
              <div class="ios-cell-icon">
                <i data-lucide="${cat.icon || 'more-horizontal'}"></i>
              </div>
              <div class="ios-cell-content">
                <div class="ios-cell-title">${escapeHtml(cat.name)}</div>
              </div>
              <div class="ios-cell-trailing">
                <span class="arrow">›</span>
              </div>
            `;
            group.appendChild(cell);
          });
          frequentList.appendChild(group);
        } else {
          document.getElementById('category-frequent').style.display = 'none';
        }
      }
      
      // Render all categories
      const categoryList = document.getElementById('category-list');
      if(categoryList) {
        categoryList.innerHTML = '';
        const group = document.createElement('div');
        group.className = 'ios-group';
        activeCategories.forEach(cat => {
          const cell = document.createElement('div');
          cell.className = 'ios-cell';
          cell.dataset.categoryId = cat.id;
          cell.innerHTML = `
            <div class="ios-cell-icon">
              <i data-lucide="${cat.icon || 'more-horizontal'}"></i>
            </div>
            <div class="ios-cell-content">
              <div class="ios-cell-title">${escapeHtml(cat.name)}</div>
            </div>
            <div class="ios-cell-trailing">
              <span class="arrow">›</span>
            </div>
          `;
          group.appendChild(cell);
        });
        categoryList.appendChild(group);
        if(typeof lucide !== 'undefined') lucide.createIcons();
      }
    }
    
    function renderSubcategoryPicker(categoryId) {
      if(!categoryId || typeof Categories === 'undefined' || !Categories.getSubcategoriesForCategory) return;
      
      const subcategories = Categories.getSubcategoriesForCategory(state.subcategories || [], categoryId);
      const carId = currentCarId || state.cars[0]?.id;
      
      // Render frequent subcategories
      if(carId && typeof Categories.getFrequentSubcategories === 'function') {
        const frequent = Categories.getFrequentSubcategories(state.expenses || [], carId, categoryId, state.subcategories || [], 5);
        const frequentList = document.getElementById('subcategory-frequent-list');
        if(frequentList && frequent.length > 0) {
          document.getElementById('subcategory-frequent').style.display = 'block';
          frequentList.innerHTML = '';
          const group = document.createElement('div');
          group.className = 'ios-group';
          frequent.forEach(sub => {
            const cell = document.createElement('div');
            cell.className = 'ios-cell';
            cell.dataset.subcategoryId = sub.id;
            cell.innerHTML = `
              <div class="ios-cell-content">
                <div class="ios-cell-title">${escapeHtml(sub.name)}</div>
              </div>
            `;
            group.appendChild(cell);
          });
          frequentList.appendChild(group);
        } else {
          document.getElementById('subcategory-frequent').style.display = 'none';
        }
      }
      
      // Render all subcategories
      const subcategoryList = document.getElementById('subcategory-list');
      if(subcategoryList) {
        subcategoryList.innerHTML = '';
        const group = document.createElement('div');
        group.className = 'ios-group';
        
        // "No subcategory" option
        const noSubCell = document.createElement('div');
        noSubCell.className = 'ios-cell';
        noSubCell.id = 'no-subcategory-btn';
        noSubCell.style.cursor = 'pointer';
        noSubCell.innerHTML = `
          <div class="ios-cell-content">
            <div class="ios-cell-title">Не указано</div>
            <div class="ios-cell-subtitle">Без подкатегории</div>
          </div>
        `;
        group.appendChild(noSubCell);
        
        // Subcategories
        subcategories.forEach(sub => {
          const cell = document.createElement('div');
          cell.className = 'ios-cell';
          cell.dataset.subcategoryId = sub.id;
          cell.innerHTML = `
            <div class="ios-cell-content">
              <div class="ios-cell-title">${escapeHtml(sub.name)}</div>
            </div>
          `;
          group.appendChild(cell);
        });
        subcategoryList.appendChild(group);
      }
    }
    
    function filterCategories(searchTerm) {
      // Simple filter - hide/show categories based on search
      const normalized = (searchTerm || '').toLowerCase().trim();
      const cells = document.querySelectorAll('#category-list .ios-cell');
      cells.forEach(cell => {
        const title = cell.querySelector('.ios-cell-title')?.textContent || '';
        cell.style.display = title.toLowerCase().includes(normalized) ? '' : 'none';
      });
    }
    
    function filterSubcategories(categoryId, searchTerm) {
      const normalized = (searchTerm || '').toLowerCase().trim();
      const cells = document.querySelectorAll('#subcategory-list .ios-cell');
      cells.forEach(cell => {
        if(cell.id === 'no-subcategory-btn') {
          cell.style.display = normalized === '' ? '' : 'none';
          return;
        }
        const title = cell.querySelector('.ios-cell-title')?.textContent || '';
        cell.style.display = title.toLowerCase().includes(normalized) ? '' : 'none';
      });
    }
    
    function showAddSubcategoryDialog(categoryId) {
      const name = prompt('Введите название подкатегории:');
      if(!name || !name.trim()) return;
      
      if(typeof Categories === 'undefined' || !Categories.createSubcategory) {
        showToast('Модуль категорий не загружен');
        return;
      }
      
      // Check uniqueness
      if(!Categories.isSubcategoryNameUnique(state.subcategories || [], categoryId, name)) {
        showToast('Подкатегория с таким названием уже существует');
        return;
      }
      
      const subcategory = Categories.createSubcategory(categoryId, name);
      if(!state.subcategories) state.subcategories = [];
      state.subcategories.push(subcategory);
      
      if(saveAppState()) {
        showToast('Подкатегория добавлена');
        renderSubcategoryPicker(categoryId);
      }
    }
    
    // Settings functions
    function initializeSettingsHandlers() {
      // Currency click handler
      const currencyItem = document.getElementById('currency-item');
      if(currencyItem) {
        currencyItem.addEventListener('click', () => {
          const settings = state.settings || {};
          const units = settings.units || {};
          const current = units.currency || '₴';
          const currencies = ['₴', '$', '€', '£', '₽', '¥'];
          const currentIndex = currencies.indexOf(current);
          const nextIndex = (currentIndex + 1) % currencies.length;
          const nextCurrency = currencies[nextIndex];
          
          if(!state.settings) state.settings = {};
          if(!state.settings.units) state.settings.units = {};
          state.settings.units.currency = nextCurrency;
          
          if(saveAppState()) {
            refreshSettingsScreen();
            showToast(`Валюта: ${nextCurrency}`);
          }
        });
      }
      
      // Require odometer toggle
      const requireOdometerEl = document.getElementById('set-require-odometer');
      if(requireOdometerEl) {
        requireOdometerEl.addEventListener('change', (e) => {
          if(!state.settings) state.settings = {};
          state.settings.requireOdometer = e.target.checked;
          if(saveAppState()) {
            showToast(e.target.checked ? 'Пробег обязателен' : 'Пробег необязателен');
          }
        });
      }
    }
    
    // Templates and Recurring functions
    function renderTemplates() {
      const container = document.getElementById('templates-list');
      const empty = document.getElementById('templates-empty');
      if(!container) return;
      
      if(typeof Templates === 'undefined') {
        if(empty) empty.style.display = 'block';
        container.innerHTML = '';
        return;
      }
      
      const templates = Templates.getTemplates(null, state);
      
      if(templates.length === 0) {
        container.innerHTML = '';
        if(empty) empty.style.display = 'block';
        return;
      }
      
      if(empty) empty.style.display = 'none';
      container.innerHTML = '';
      
      // Group by type
      const byType = { expense: [], fuel: [], service: [] };
      templates.forEach(t => {
        if(byType[t.type]) byType[t.type].push(t);
      });
      
      Object.keys(byType).forEach(type => {
        if(byType[type].length === 0) return;
        
        const group = document.createElement('div');
        group.className = 'ios-group';
        const header = document.createElement('div');
        header.className = 'ios-group-header';
        header.textContent = type === 'expense' ? 'Расходы' : type === 'fuel' ? 'Заправки' : 'Сервис';
        group.appendChild(header);
        
        byType[type].forEach(template => {
          const cell = document.createElement('div');
          cell.className = 'ios-cell';
          cell.innerHTML = `
            <div class="ios-cell-content">
              <div class="ios-cell-title">${escapeHtml(template.name || 'Шаблон')}</div>
              <div class="ios-cell-subtitle">
                ${template.data.amount ? template.data.amount + ' ₴' : ''}
                ${template.data.categoryId && typeof Categories !== 'undefined' ? 
                  ' • ' + Categories.getCategoryName(template.data.categoryId, state) : ''}
              </div>
            </div>
            <div class="ios-cell-trailing">
              <button class="ios-cell-action-btn" data-use-template="${template.id}" title="Использовать">
                <i data-lucide="plus"></i>
              </button>
              <button class="ios-cell-action-btn" data-delete-template="${template.id}" title="Удалить">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          `;
          group.appendChild(cell);
        });
        
        container.appendChild(group);
      });
      
      if(typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    function renderRecurring() {
      const upcomingList = document.getElementById('recurring-upcoming-list');
      const upcomingGroup = document.getElementById('recurring-upcoming-group');
      const rulesList = document.getElementById('recurring-rules-list');
      const empty = document.getElementById('recurring-empty');
      
      if(!rulesList) return;
      
      if(typeof Recurring === 'undefined') {
        if(empty) empty.style.display = 'block';
        if(upcomingGroup) upcomingGroup.style.display = 'none';
        rulesList.innerHTML = '';
        return;
      }
      
      const upcoming = Recurring.getUpcoming(state);
      const rules = (state.recurringRules || []).filter(r => !r.deletedAt);
      
      if(rules.length === 0 && upcoming.length === 0) {
        if(empty) empty.style.display = 'block';
        if(upcomingGroup) upcomingGroup.style.display = 'none';
        rulesList.innerHTML = '';
        return;
      }
      
      if(empty) empty.style.display = 'none';
      
      // Render upcoming
      if(upcoming.length > 0 && upcomingList && upcomingGroup) {
        upcomingGroup.style.display = 'block';
        upcomingList.innerHTML = '';
        
        upcoming.forEach(item => {
          const cell = document.createElement('div');
          cell.className = 'ios-cell';
          const dueDate = new Date(item.dueDate);
          cell.innerHTML = `
            <div class="ios-cell-content">
              <div class="ios-cell-title">${escapeHtml(item.template.name || 'Шаблон')}</div>
              <div class="ios-cell-subtitle">
                ${escapeHtml(item.car)} • ${dueDate.toLocaleDateString('ru-RU')}
              </div>
            </div>
            <div class="ios-cell-trailing">
              <button class="ios-cell-action-btn" data-mark-paid="${item.id}" title="Отметить как оплачено" style="color: var(--success);">
                <i data-lucide="check"></i>
              </button>
            </div>
          `;
          upcomingList.appendChild(cell);
        });
      } else if(upcomingGroup) {
        upcomingGroup.style.display = 'none';
      }
      
      // Update upcoming count in settings
      const upcomingCountEl = document.getElementById('recurring-upcoming-count');
      if(upcomingCountEl) upcomingCountEl.textContent = upcoming.length > 0 ? upcoming.length.toString() : '0';
      
      // Render rules
      rulesList.innerHTML = '';
      const group = document.createElement('div');
      group.className = 'ios-group';
      
      rules.forEach(rule => {
        const template = Templates.getTemplate(rule.templateId, state);
        const car = state.cars.find(c => c.id === rule.carId);
        const frequencyText = {
          'weekly': 'Еженедельно',
          'monthly': 'Ежемесячно',
          'yearly': 'Ежегодно',
          'custom': `Каждые ${rule.customDays} дней`
        }[rule.frequency] || rule.frequency;
        
        const cell = document.createElement('div');
        cell.className = 'ios-cell';
        cell.innerHTML = `
          <div class="ios-cell-content">
            <div class="ios-cell-title">${escapeHtml(template ? template.name : 'Шаблон')}</div>
            <div class="ios-cell-subtitle">
              ${car ? escapeHtml(`${car.brand} ${car.model}`) : 'Неизвестный автомобиль'} • ${frequencyText}
            </div>
            ${rule.nextDue ? `
              <div class="ios-cell-subtitle" style="margin-top: var(--space-xs); color: var(--text-secondary);">
                Следующий: ${new Date(rule.nextDue).toLocaleDateString('ru-RU')}
              </div>
            ` : ''}
          </div>
          <div class="ios-cell-trailing">
            <button class="ios-cell-action-btn" data-delete-recurring="${rule.id}" title="Удалить">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `;
        group.appendChild(cell);
      });
      
      rulesList.appendChild(group);
      if(typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    function renderCategoriesManagement() {
      const container = document.getElementById('categories-management-list');
      const empty = document.getElementById('categories-empty');
      if(!container) return;
      
      if(typeof Categories === 'undefined') {
        if(empty) empty.style.display = 'block';
        container.innerHTML = '';
        return;
      }
      
      const categories = Categories.getActive(state.categories || []);
      
      if(categories.length === 0) {
        container.innerHTML = '';
        if(empty) empty.style.display = 'block';
        return;
      }
      
      if(empty) empty.style.display = 'none';
      container.innerHTML = '';
      
      categories.forEach(category => {
        const group = document.createElement('div');
        group.className = 'ios-group';
        
        // Category header
        const categoryCell = document.createElement('div');
        categoryCell.className = 'ios-cell';
        categoryCell.setAttribute('data-category-id', category.id);
        categoryCell.innerHTML = `
          <div class="ios-cell-content">
            <div style="display: flex; align-items: center; gap: var(--space-sm);">
              <i data-lucide="${category.icon || 'folder'}" style="width: 20px; height: 20px;"></i>
              <div>
                <div class="ios-cell-title">${escapeHtml(category.name)}</div>
                <div class="ios-cell-subtitle" style="font-size: var(--font-size-caption);">
                  ${Categories.getSubcategoriesForCategory(state.subcategories || [], category.id).length} подкатегорий
                </div>
              </div>
            </div>
          </div>
          <div class="ios-cell-trailing">
            <button class="ios-cell-action-btn" data-category-edit="${category.id}" title="Редактировать">
              <i data-lucide="edit"></i>
            </button>
            <button class="ios-cell-action-btn" data-category-move-up="${category.id}" title="Вверх">
              <i data-lucide="chevron-up"></i>
            </button>
            <button class="ios-cell-action-btn" data-category-move-down="${category.id}" title="Вниз">
              <i data-lucide="chevron-down"></i>
            </button>
            <button class="ios-cell-action-btn" data-category-archive="${category.id}" title="Архивировать">
              <i data-lucide="archive"></i>
            </button>
            <button class="ios-cell-action-btn" data-category-toggle="${category.id}" title="Развернуть">
              <i data-lucide="chevron-right" class="category-toggle-icon"></i>
            </button>
          </div>
        `;
        group.appendChild(categoryCell);
        
        // Subcategories container (initially hidden)
        const subcategoriesContainer = document.createElement('div');
        subcategoriesContainer.className = 'category-subcategories';
        subcategoriesContainer.style.display = 'none';
        subcategoriesContainer.setAttribute('data-category-id', category.id);
        
        const subcategories = Categories.getSubcategoriesForCategory(state.subcategories || [], category.id);
        if(subcategories.length > 0) {
          subcategories.forEach(subcategory => {
            const subCell = document.createElement('div');
            subCell.className = 'ios-cell';
            subCell.style.paddingLeft = 'var(--space-xl)';
            subCell.setAttribute('data-subcategory-id', subcategory.id);
            subCell.innerHTML = `
              <div class="ios-cell-content">
                <div class="ios-cell-title">${escapeHtml(subcategory.name)}</div>
              </div>
              <div class="ios-cell-trailing">
                <button class="ios-cell-action-btn" data-subcategory-edit="${subcategory.id}" title="Редактировать">
                  <i data-lucide="edit"></i>
                </button>
                <button class="ios-cell-action-btn" data-subcategory-move-up="${subcategory.id}" title="Вверх">
                  <i data-lucide="chevron-up"></i>
                </button>
                <button class="ios-cell-action-btn" data-subcategory-move-down="${subcategory.id}" title="Вниз">
                  <i data-lucide="chevron-down"></i>
                </button>
                <button class="ios-cell-action-btn" data-subcategory-archive="${subcategory.id}" title="Архивировать">
                  <i data-lucide="archive"></i>
                </button>
              </div>
            `;
            subcategoriesContainer.appendChild(subCell);
          });
        } else {
          const emptySub = document.createElement('div');
          emptySub.className = 'ios-cell';
          emptySub.style.paddingLeft = 'var(--space-xl)';
          emptySub.style.color = 'var(--text-secondary)';
          emptySub.style.fontSize = 'var(--font-size-caption)';
          emptySub.textContent = 'Нет подкатегорий';
          subcategoriesContainer.appendChild(emptySub);
        }
        
        // Add subcategory button
        const addSubBtn = document.createElement('div');
        addSubBtn.className = 'ios-cell';
        addSubBtn.style.paddingLeft = 'var(--space-xl)';
        addSubBtn.style.cursor = 'pointer';
        addSubBtn.setAttribute('data-add-subcategory', category.id);
        addSubBtn.innerHTML = `
          <div class="ios-cell-content">
            <div class="ios-cell-title" style="color: var(--primary);">
              <i data-lucide="plus" style="width: 16px; height: 16px; margin-right: var(--space-xs);"></i>
              Добавить подкатегорию
            </div>
          </div>
        `;
        subcategoriesContainer.appendChild(addSubBtn);
        
        group.appendChild(subcategoriesContainer);
        container.appendChild(group);
      });
      
      if(typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    // Handle template and recurring actions
    document.body.addEventListener('click', (e) => {
      const target = e.target.closest('[data-use-template], [data-delete-template], [data-mark-paid], [data-delete-recurring]');
      if(!target) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      if(target.dataset.useTemplate) {
        const template = Templates.getTemplate(target.dataset.useTemplate, state);
        if(template) {
          const carId = currentCarId || state.cars[0]?.id;
          if(!carId) {
            showToast('Выберите автомобиль');
            return;
          }
          
          const data = Templates.applyTemplate(template, carId);
          
          if(template.type === 'expense') {
            // Fill expense form
            document.getElementById('expense-category-id').value = data.categoryId || '';
            document.getElementById('expense-subcategory-id').value = data.subcategoryId || '';
            if(data.amount) document.getElementById('amount').value = data.amount;
            if(data.notes) document.getElementById('notes').value = data.notes;
            if(data.date) document.getElementById('date').value = data.date;
            
            // Update category display
            if(data.categoryId && typeof Categories !== 'undefined') {
              const catName = Categories.getCategoryName(data.categoryId, state);
              const subName = data.subcategoryId ? Categories.getSubcategoryName(data.subcategoryId, state) : null;
              const display = subName ? `${catName} • ${subName}` : catName;
              const categoryValue = document.getElementById('expense-category-value');
              if(categoryValue) categoryValue.textContent = display;
            }
            
            showView('screen-expense-form');
            showToast('Шаблон применен');
          } else if(template.type === 'fuel') {
            // Fill fuel form
            if(data.liters) document.getElementById('fuel-liters').value = data.liters;
            if(data.totalCost) document.getElementById('fuel-cost').value = data.totalCost;
            if(data.fullTank) document.getElementById('fuel-full-tank').checked = true;
            if(data.station) document.getElementById('fuel-station').value = data.station;
            if(data.notes) document.getElementById('fuel-notes').value = data.notes;
            if(data.date) document.getElementById('fuel-date').value = data.date;
            
            showView('screen-add-fuel');
            showToast('Шаблон применен');
          } else if(template.type === 'service') {
            // Fill service form
            if(data.type) document.getElementById('service-type').value = data.type;
            if(data.cost) document.getElementById('service-cost').value = data.cost;
            if(data.shop) document.getElementById('service-shop').value = data.shop;
            if(data.notes) document.getElementById('service-notes').value = data.notes;
            if(data.date) document.getElementById('service-date').value = data.date;
            
            showView('screen-add-service');
            showToast('Шаблон применен');
          }
        }
        return;
      }
      
      if(target.dataset.deleteTemplate) {
        const template = Templates.getTemplate(target.dataset.deleteTemplate, state);
        if(template) {
          showModal('Удалить шаблон?', `Удалить шаблон "${template.name}"?`, () => {
            if(typeof SoftDelete !== 'undefined' && SoftDelete.delete) {
              SoftDelete.delete(template, 'template', state);
            } else {
              template.deletedAt = new Date().toISOString();
            }
            if(saveAppState()) {
              showToast('Шаблон удален');
              renderTemplates();
            }
          });
        }
        return;
      }
      
      if(target.dataset.markPaid) {
        if(typeof Recurring === 'undefined') {
          showToast('Модуль повторяющихся расходов не загружен');
          return;
        }
        
        const entry = Recurring.markAsPaid(target.dataset.markPaid, state);
        if(entry && saveAppState()) {
          showToast('Расход создан');
          renderRecurring();
          renderDiary();
          if(currentCarId) {
            renderFuelTab(currentCarId);
            renderServiceTab(currentCarId);
          }
        }
        return;
      }
      
      if(target.dataset.deleteRecurring) {
        const rule = state.recurringRules.find(r => r.id === target.dataset.deleteRecurring);
        if(rule) {
          showModal('Удалить правило?', 'Повторяющийся расход будет удален', () => {
            if(typeof SoftDelete !== 'undefined' && SoftDelete.delete) {
              SoftDelete.delete(rule, 'recurring', state);
            } else {
              rule.deletedAt = new Date().toISOString();
            }
            if(saveAppState()) {
              showToast('Правило удалено');
              renderRecurring();
            }
          });
        }
        return;
      }
    });
    
    // Handle categories management actions
    document.body.addEventListener('click', (e) => {
      const target = e.target.closest('[data-category-edit], [data-category-archive], [data-category-move-up], [data-category-move-down], [data-category-toggle], [data-subcategory-edit], [data-subcategory-archive], [data-subcategory-move-up], [data-subcategory-move-down], [data-add-subcategory], [data-add-category]');
      if(!target) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      if(target.dataset.categoryEdit) {
        const categoryId = target.dataset.categoryEdit;
        const category = (state.categories || []).find(c => c.id === categoryId);
        if(category) {
          document.getElementById('category-edit-title').textContent = 'Редактировать категорию';
          document.getElementById('category-edit-name').value = category.name;
          document.getElementById('category-edit-icon').value = category.icon || '';
          window.editingCategoryId = categoryId;
          window.editingSubcategoryId = null;
          const sheet = document.getElementById('category-edit-sheet');
          if(sheet) {
            sheet.style.display = 'block';
            setTimeout(() => sheet.classList.add('active'), 10);
          }
        }
        return;
      }
      
      if(target.dataset.subcategoryEdit) {
        const subcategoryId = target.dataset.subcategoryEdit;
        const subcategory = (state.subcategories || []).find(s => s.id === subcategoryId);
        if(subcategory) {
          document.getElementById('subcategory-edit-title').textContent = 'Редактировать подкатегорию';
          document.getElementById('subcategory-edit-name').value = subcategory.name;
          window.editingCategoryId = null;
          window.editingSubcategoryId = subcategoryId;
          const sheet = document.getElementById('subcategory-edit-sheet');
          if(sheet) {
            sheet.style.display = 'block';
            setTimeout(() => sheet.classList.add('active'), 10);
          }
        }
        return;
      }
      
      if(target.dataset.categoryArchive) {
        const categoryId = target.dataset.categoryArchive;
        const category = (state.categories || []).find(c => c.id === categoryId);
        if(category) {
          const action = category.isArchived ? 'восстановить' : 'архивировать';
          showModal(`${action.charAt(0).toUpperCase() + action.slice(1)} категорию?`, 
            category.isArchived ? 'Категория будет восстановлена' : 'Категория будет скрыта из списка', 
            () => {
              if(typeof Categories !== 'undefined' && Categories.archiveCategory) {
                Categories.archiveCategory(categoryId, !category.isArchived, state);
                if(saveAppState()) {
                  showToast(category.isArchived ? 'Категория восстановлена' : 'Категория архивирована');
                  renderCategoriesManagement();
                }
              }
            });
        }
        return;
      }
      
      if(target.dataset.subcategoryArchive) {
        const subcategoryId = target.dataset.subcategoryArchive;
        const subcategory = (state.subcategories || []).find(s => s.id === subcategoryId);
        if(subcategory) {
          const action = subcategory.isArchived ? 'восстановить' : 'архивировать';
          showModal(`${action.charAt(0).toUpperCase() + action.slice(1)} подкатегорию?`, 
            subcategory.isArchived ? 'Подкатегория будет восстановлена' : 'Подкатегория будет скрыта из списка', 
            () => {
              if(typeof Categories !== 'undefined' && Categories.archiveSubcategory) {
                Categories.archiveSubcategory(subcategoryId, !subcategory.isArchived, state);
                if(saveAppState()) {
                  showToast(subcategory.isArchived ? 'Подкатегория восстановлена' : 'Подкатегория архивирована');
                  renderCategoriesManagement();
                }
              }
            });
        }
        return;
      }
      
      if(target.dataset.categoryMoveUp || target.dataset.categoryMoveDown) {
        const categoryId = target.dataset.categoryMoveUp || target.dataset.categoryMoveDown;
        const direction = target.dataset.categoryMoveUp ? 'up' : 'down';
        if(typeof Categories !== 'undefined' && Categories.moveCategory) {
          if(Categories.moveCategory(categoryId, direction, state)) {
            if(saveAppState()) {
              renderCategoriesManagement();
            }
          }
        }
        return;
      }
      
      if(target.dataset.subcategoryMoveUp || target.dataset.subcategoryMoveDown) {
        const subcategoryId = target.dataset.subcategoryMoveUp || target.dataset.subcategoryMoveDown;
        const direction = target.dataset.subcategoryMoveUp ? 'up' : 'down';
        if(typeof Categories !== 'undefined' && Categories.moveSubcategory) {
          if(Categories.moveSubcategory(subcategoryId, direction, state)) {
            if(saveAppState()) {
              renderCategoriesManagement();
            }
          }
        }
        return;
      }
      
      if(target.dataset.categoryToggle) {
        const categoryId = target.dataset.categoryToggle;
        const container = document.querySelector(`[data-category-id="${categoryId}"].category-subcategories`);
        const icon = target.querySelector('.category-toggle-icon');
        if(container) {
          const isVisible = container.style.display !== 'none';
          container.style.display = isVisible ? 'none' : 'block';
          if(icon) {
            icon.setAttribute('data-lucide', isVisible ? 'chevron-right' : 'chevron-down');
            if(typeof lucide !== 'undefined') lucide.createIcons();
          }
        }
        return;
      }
      
      if(target.dataset.addSubcategory) {
        const categoryId = target.dataset.addSubcategory;
        const name = prompt('Введите название подкатегории:');
        if(name && name.trim()) {
          if(typeof Categories !== 'undefined' && Categories.createSubcategory) {
            const subcategory = Categories.createSubcategory(categoryId, name.trim());
            if(!state.subcategories) state.subcategories = [];
            if(Categories.isSubcategoryNameUnique(state.subcategories, categoryId, name.trim())) {
              state.subcategories.push(subcategory);
              if(saveAppState()) {
                showToast('Подкатегория добавлена');
                renderCategoriesManagement();
              }
            } else {
              showToast('Подкатегория с таким названием уже существует');
            }
          }
        }
        return;
      }
      
      if(target.dataset.addCategory || target.id === 'add-category-btn') {
        const name = prompt('Введите название категории:');
        if(name && name.trim()) {
          if(typeof Categories !== 'undefined' && Categories.createCategory) {
            const category = Categories.createCategory(name.trim());
            if(!state.categories) state.categories = [];
            if(Categories.isCategoryNameUnique(state.categories, name.trim())) {
              state.categories.push(category);
              if(saveAppState()) {
                showToast('Категория добавлена');
                renderCategoriesManagement();
              }
            } else {
              showToast('Категория с таким названием уже существует');
            }
          }
        }
        return;
      }
    });
    
    // Handle category/subcategory edit modals
    const categoryEditSave = document.getElementById('category-edit-save');
    const categoryEditCancel = document.getElementById('category-edit-cancel');
    const categoryEditClose = document.getElementById('category-edit-close');
    const subcategoryEditSave = document.getElementById('subcategory-edit-save');
    const subcategoryEditCancel = document.getElementById('subcategory-edit-cancel');
    const subcategoryEditClose = document.getElementById('subcategory-edit-close');
    
    function closeCategoryEditSheet() {
      const sheet = document.getElementById('category-edit-sheet');
      if(sheet) {
        sheet.classList.remove('active');
        setTimeout(() => sheet.style.display = 'none', 300);
      }
      window.editingCategoryId = null;
    }
    
    function closeSubcategoryEditSheet() {
      const sheet = document.getElementById('subcategory-edit-sheet');
      if(sheet) {
        sheet.classList.remove('active');
        setTimeout(() => sheet.style.display = 'none', 300);
      }
      window.editingSubcategoryId = null;
    }
    
    // Close modals on overlay click
    const categoryEditSheet = document.getElementById('category-edit-sheet');
    const subcategoryEditSheet = document.getElementById('subcategory-edit-sheet');
    if(categoryEditSheet) {
      categoryEditSheet.addEventListener('click', (e) => {
        if(e.target === categoryEditSheet) {
          closeCategoryEditSheet();
        }
      });
    }
    if(subcategoryEditSheet) {
      subcategoryEditSheet.addEventListener('click', (e) => {
        if(e.target === subcategoryEditSheet) {
          closeSubcategoryEditSheet();
        }
      });
    }
    
    if(categoryEditSave) {
      categoryEditSave.addEventListener('click', () => {
        const name = document.getElementById('category-edit-name').value.trim();
        const icon = document.getElementById('category-edit-icon').value.trim();
        if(!name) {
          showToast('Введите название категории');
          return;
        }
        
        if(window.editingCategoryId) {
          if(typeof Categories !== 'undefined' && Categories.updateCategory) {
            if(Categories.updateCategory(window.editingCategoryId, { name, icon }, state)) {
              if(saveAppState()) {
                showToast('Категория обновлена');
                closeCategoryEditSheet();
                renderCategoriesManagement();
              }
            } else {
              showToast('Категория с таким названием уже существует');
            }
          }
        }
      });
    }
    
    if(categoryEditCancel || categoryEditClose) {
      [categoryEditCancel, categoryEditClose].forEach(btn => {
        if(btn) btn.addEventListener('click', closeCategoryEditSheet);
      });
    }
    
    if(subcategoryEditSave) {
      subcategoryEditSave.addEventListener('click', () => {
        const name = document.getElementById('subcategory-edit-name').value.trim();
        if(!name) {
          showToast('Введите название подкатегории');
          return;
        }
        
        if(window.editingSubcategoryId) {
          if(typeof Categories !== 'undefined' && Categories.updateSubcategory) {
            if(Categories.updateSubcategory(window.editingSubcategoryId, { name }, state)) {
              if(saveAppState()) {
                showToast('Подкатегория обновлена');
                closeSubcategoryEditSheet();
                renderCategoriesManagement();
              }
            } else {
              showToast('Подкатегория с таким названием уже существует');
            }
          }
        }
      });
    }
    
    if(subcategoryEditCancel || subcategoryEditClose) {
      [subcategoryEditCancel, subcategoryEditClose].forEach(btn => {
        if(btn) btn.addEventListener('click', closeSubcategoryEditSheet);
      });
    }
    
    function initializeUnitsSettings() {
      const settings = state.settings || {};
      const units = settings.units || { distance: 'km', fuel: 'L/100km' };
      
      // Set radio buttons
      const distanceKm = document.getElementById('unit-distance-km');
      const distanceMi = document.getElementById('unit-distance-mi');
      if(distanceKm && distanceMi) {
        if(units.distance === 'mi') {
          distanceMi.checked = true;
          distanceKm.checked = false;
        } else {
          distanceKm.checked = true;
          distanceMi.checked = false;
        }
        
        distanceKm.addEventListener('change', () => {
          if(distanceKm.checked) {
            if(!state.settings) state.settings = {};
            if(!state.settings.units) state.settings.units = {};
            state.settings.units.distance = 'km';
            if(saveAppState()) {
              showToast('Единицы: километры');
            }
          }
        });
        
        distanceMi.addEventListener('change', () => {
          if(distanceMi.checked) {
            if(!state.settings) state.settings = {};
            if(!state.settings.units) state.settings.units = {};
            state.settings.units.distance = 'mi';
            if(saveAppState()) {
              showToast('Единицы: мили');
            }
          }
        });
      }
      
      const fuelL100km = document.getElementById('unit-fuel-l100km');
      const fuelKmL = document.getElementById('unit-fuel-kml');
      if(fuelL100km && fuelKmL) {
        if(units.fuel === 'km/L') {
          fuelKmL.checked = true;
          fuelL100km.checked = false;
        } else {
          fuelL100km.checked = true;
          fuelKmL.checked = false;
        }
        
        fuelL100km.addEventListener('change', () => {
          if(fuelL100km.checked) {
            if(!state.settings) state.settings = {};
            if(!state.settings.units) state.settings.units = {};
            state.settings.units.fuel = 'L/100km';
            if(saveAppState()) {
              showToast('Единицы: L/100km');
            }
          }
        });
        
        fuelKmL.addEventListener('change', () => {
          if(fuelKmL.checked) {
            if(!state.settings) state.settings = {};
            if(!state.settings.units) state.settings.units = {};
            state.settings.units.fuel = 'km/L';
            if(saveAppState()) {
              showToast('Единицы: km/L');
            }
          }
        });
      }
    }
    
    let selectedCategoryId = null;
    let selectedSubcategoryId = null;
    
    // Initialize advanced filters modal
    function initializeAdvancedFilters() {
      const advancedFiltersBtn = document.getElementById('advanced-filters-btn');
      const filtersSheet = document.getElementById('advanced-filters-sheet');
      const closeFiltersBtn = document.getElementById('close-filters-btn');
      const applyFiltersBtn = document.getElementById('apply-filters-btn');
      const resetFiltersBtn = document.getElementById('reset-filters-btn');
      
      if (!advancedFiltersBtn || !filtersSheet) return;
      
      // Open filters modal
      advancedFiltersBtn.addEventListener('click', () => {
        if (typeof Search !== 'undefined') {
          populateFiltersModal();
          filtersSheet.style.display = 'block';
          setTimeout(() => {
            filtersSheet.classList.add('active');
          }, 10);
        }
      });
      
      // Close filters modal
      if (closeFiltersBtn) {
        closeFiltersBtn.addEventListener('click', () => {
          filtersSheet.classList.remove('active');
          setTimeout(() => {
            filtersSheet.style.display = 'none';
          }, 300);
        });
      }
      
      // Apply filters
      if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
          if (typeof Search !== 'undefined') {
            applyAdvancedFilters();
            filtersSheet.classList.remove('active');
            setTimeout(() => {
              filtersSheet.style.display = 'none';
            }, 300);
            renderDiary();
          }
        });
      }
      
      // Reset filters
      if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
          if (typeof Search !== 'undefined') {
            Search.resetFilters();
            populateFiltersModal();
            applyAdvancedFilters();
            renderDiary();
          }
        });
      }
      
      // Close on overlay click
      filtersSheet.addEventListener('click', (e) => {
        if (e.target === filtersSheet) {
          filtersSheet.classList.remove('active');
          setTimeout(() => {
            filtersSheet.style.display = 'none';
          }, 300);
        }
      });
    }
    
    // Populate filters modal with current values
    function populateFiltersModal() {
      if (typeof Search === 'undefined') return;
      
      const filters = Search.advancedFilters;
      
      const carSelect = document.getElementById('filter-car');
      if (carSelect) {
        carSelect.innerHTML = '<option value="all">Все автомобили</option>';
        (state.cars || []).filter(c => !c.deletedAt).forEach(car => {
          const option = document.createElement('option');
          option.value = car.id;
          option.textContent = `${car.brand} ${car.model}`;
          if (car.id === filters.carId) option.selected = true;
          carSelect.appendChild(option);
        });
      }
      
      const typeSelect = document.getElementById('filter-type');
      if (typeSelect) typeSelect.value = filters.type || 'all';
      
      const dateFrom = document.getElementById('filter-date-from');
      if (dateFrom) dateFrom.value = filters.dateFrom || '';
      
      const dateTo = document.getElementById('filter-date-to');
      if (dateTo) dateTo.value = filters.dateTo || '';
      
      const amountFrom = document.getElementById('filter-amount-from');
      if (amountFrom) amountFrom.value = filters.amountFrom || '';
      
      const amountTo = document.getElementById('filter-amount-to');
      if (amountTo) amountTo.value = filters.amountTo || '';
      
      const hasReceipt = document.getElementById('filter-has-receipt');
      if (hasReceipt) hasReceipt.checked = filters.hasReceipt || false;
      
      const tags = document.getElementById('filter-tags');
      if (tags) tags.value = Array.isArray(filters.tags) ? filters.tags.join(', ') : '';
    }
    
    // Apply advanced filters from modal
    function applyAdvancedFilters() {
      if (typeof Search === 'undefined') return;
      
      const carSelect = document.getElementById('filter-car');
      const typeSelect = document.getElementById('filter-type');
      const dateFrom = document.getElementById('filter-date-from');
      const dateTo = document.getElementById('filter-date-to');
      const amountFrom = document.getElementById('filter-amount-from');
      const amountTo = document.getElementById('filter-amount-to');
      const hasReceipt = document.getElementById('filter-has-receipt');
      const tags = document.getElementById('filter-tags');
      
      Search.advancedFilters = {
        carId: carSelect ? carSelect.value : 'all',
        type: typeSelect ? typeSelect.value : 'all',
        dateFrom: dateFrom ? dateFrom.value : null,
        dateTo: dateTo ? dateTo.value : null,
        amountFrom: amountFrom ? amountFrom.value : null,
        amountTo: amountTo ? amountTo.value : null,
        hasReceipt: hasReceipt ? hasReceipt.checked : false,
        tags: tags ? tags.value.split(',').map(t => t.trim()).filter(Boolean) : []
      };
    }
    
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registered:', registration.scope);
          })
          .catch((error) => {
            console.log('Service Worker registration failed:', error);
          });
      });
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
