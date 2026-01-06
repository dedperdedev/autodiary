// Storage module with schema versioning and migrations
// Handles all data persistence, versioning, and recovery

const STORAGE_SCHEMA_VERSION = 4; // Increment when schema changes (v4: maintenance plan per vehicle)
const STORAGE_PREFIX = 'autodiary:';

// Storage utility with error handling
// Supports both old format (autodiary:key) and new format (key)
const Storage = {
  get(key, def = []) {
    try {
      // Try new format first
      let item = localStorage.getItem(STORAGE_PREFIX + key);
      // If not found, try old format for backward compatibility
      if (!item && key !== 'schemaVersion') {
        item = localStorage.getItem('autodiary:' + key);
      }
      return item ? JSON.parse(item) : def;
    } catch (e) {
      console.error('Storage get error:', e);
      return def;
    }
  },
  
  set(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      if(e.name === 'QuotaExceededError') {
        return { error: 'QUOTA_EXCEEDED', message: 'Недостаточно места в хранилище' };
      } else {
        console.error('Storage set error:', e);
        return { error: 'STORAGE_ERROR', message: 'Ошибка сохранения данных' };
      }
    }
  },
  
  remove(key) {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
      return true;
    } catch (e) {
      console.error('Storage remove error:', e);
      return false;
    }
  },
  
  clear() {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
      keys.forEach(k => localStorage.removeItem(k));
      return true;
    } catch (e) {
      console.error('Storage clear error:', e);
      return false;
    }
  },
  
  getStorageSize() {
    let total = 0;
    try {
      for (let key in localStorage) {
        if (key.startsWith(STORAGE_PREFIX)) {
          total += localStorage[key].length + key.length;
        }
      }
    } catch (e) {
      console.error('Storage size calculation error:', e);
    }
    return total;
  }
};

// Schema migrations
const migrations = {
  // Migration from v1 to v2: Add soft delete fields and schema version
  1: (data) => {
    const migrated = { ...data };
    
    // Add deletedAt to cars
    if (migrated.cars) {
      migrated.cars = migrated.cars.map(car => ({
        ...car,
        deletedAt: null
      }));
    }
    
    // Add deletedAt to expenses
    if (migrated.expenses) {
      migrated.expenses = migrated.expenses.map(exp => ({
        ...exp,
        deletedAt: null
      }));
    }
    
    // Add deletedAt to reminders
    if (migrated.reminders) {
      migrated.reminders = migrated.reminders.map(rem => ({
        ...rem,
        deletedAt: null
      }));
    }
    
    // Add schema version
    migrated.schemaVersion = 2;
    
    return migrated;
  },
  
  // Migration from v2 to v3: Add categories/subcategories structure
  2: (data) => {
    const migrated = { ...data };
    
    // Initialize categories and subcategories if missing
    if (!migrated.categories) {
      migrated.categories = [];
    }
    if (!migrated.subcategories) {
      migrated.subcategories = [];
    }
    
    // Migrate legacy category strings to categoryId/subcategoryId
    if (migrated.expenses) {
      migrated.expenses = migrated.expenses.map(exp => {
        if (exp.category && !exp.categoryId) {
          // Try to parse category string (e.g., "A/B", "A: B", "A - B")
          const parts = exp.category.split(/[\/:\-]/).map(p => p.trim()).filter(Boolean);
          if (parts.length > 0) {
            // Find or create category
            let category = migrated.categories.find(c => 
              c.name.toLowerCase() === parts[0].toLowerCase() && !c.isArchived
            );
            if (!category) {
              category = {
                id: 'cat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                name: parts[0],
                icon: 'folder',
                sortOrder: migrated.categories.length + 1,
                isArchived: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              migrated.categories.push(category);
            }
            exp.categoryId = category.id;
            
            // If there's a second part, create subcategory
            if (parts.length > 1) {
              let subcategory = migrated.subcategories.find(s => 
                s.categoryId === category.id && 
                s.name.toLowerCase() === parts[1].toLowerCase() && 
                !s.isArchived
              );
              if (!subcategory) {
                subcategory = {
                  id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                  categoryId: category.id,
                  name: parts[1],
                  sortOrder: migrated.subcategories.filter(s => s.categoryId === category.id).length + 1,
                  isArchived: false,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                migrated.subcategories.push(subcategory);
              }
              exp.subcategoryId = subcategory.id;
            }
          }
        }
        return exp;
      });
    }
    
    // Update schema version
    migrated.schemaVersion = 3;
    
    return migrated;
  },
  
  // Migration from v3 to v4: Add servicePlan to vehicles
  3: (data) => {
    const migrated = { ...data };
    
    // Add servicePlan array to each vehicle if missing
    if (migrated.cars) {
      migrated.cars = migrated.cars.map(car => {
        if (!car.servicePlan) {
          car.servicePlan = [];
        }
        return car;
      });
    }
    
    // Update schema version
    migrated.schemaVersion = 4;
    
    return migrated;
  }
};

// Load and migrate state
function loadState() {
  try {
    // Check for old format and migrate keys if needed
    const hasOldFormat = localStorage.getItem('autodiary:cars') !== null;
    if (hasOldFormat) {
      // Migrate old keys to new format
      const oldKeys = ['cars', 'expenses', 'maintenance', 'intervals', 'reminders'];
      oldKeys.forEach(key => {
        const oldValue = localStorage.getItem('autodiary:' + key);
        if (oldValue) {
          localStorage.setItem(STORAGE_PREFIX + key, oldValue);
          localStorage.removeItem('autodiary:' + key);
        }
      });
    }
    
    // Load all data
    let data = {
      schemaVersion: Storage.get('schemaVersion', 1),
      cars: Storage.get('cars', []),
      expenses: Storage.get('expenses', []),
      maintenance: Storage.get('maintenance', {}),
      intervals: Storage.get('intervals', {}),
      reminders: Storage.get('reminders', []),
      fuel: Storage.get('fuel', []),
      service: Storage.get('service', []),
      categories: Storage.get('categories', []),
      subcategories: Storage.get('subcategories', []),
      settings: Storage.get('settings', {
        units: { distance: 'km', fuel: 'L/100km', currency: '₴' },
        darkMode: false,
        autoBackup: false
      })
    };
    
    // Migrate if needed
    let currentVersion = data.schemaVersion || 1;
    if (currentVersion < STORAGE_SCHEMA_VERSION) {
      console.log(`Migrating from schema version ${currentVersion} to ${STORAGE_SCHEMA_VERSION}`);
      
      for (let v = currentVersion; v < STORAGE_SCHEMA_VERSION; v++) {
        if (migrations[v]) {
          data = migrations[v](data);
          currentVersion = v + 1;
        }
      }
      
      // Save migrated data
      saveState(data);
    }
    
    // Validate data structure
    if (!validateState(data)) {
      return { success: false, error: 'Data validation failed', data: null, corrupted: true };
    }
    
    return { success: true, data };
  } catch (e) {
    console.error('Load state error:', e);
    // Try to extract raw data for recovery
    let rawData = null;
    try {
      rawData = {
        cars: Storage.get('cars', []),
        expenses: Storage.get('expenses', []),
        maintenance: Storage.get('maintenance', {}),
        intervals: Storage.get('intervals', {}),
        reminders: Storage.get('reminders', []),
        fuel: Storage.get('fuel', []),
        service: Storage.get('service', []),
        categories: Storage.get('categories', []),
        subcategories: Storage.get('subcategories', [])
      };
    } catch (e2) {
      console.error('Failed to extract raw data:', e2);
    }
    return { success: false, error: e.message, data: rawData, corrupted: true };
  }
}

// Save state
function saveState(state) {
  try {
    // Ensure schema version is set
    state.schemaVersion = STORAGE_SCHEMA_VERSION;
    
    const result = Storage.set('schemaVersion', state.schemaVersion);
    if (result && result.error) return result;
    
    Storage.set('cars', state.cars || []);
    Storage.set('expenses', state.expenses || []);
    Storage.set('maintenance', state.maintenance || {});
    Storage.set('intervals', state.intervals || {});
    Storage.set('reminders', state.reminders || []);
    Storage.set('fuel', state.fuel || []);
    Storage.set('service', state.service || []);
    Storage.set('categories', state.categories || []);
    Storage.set('subcategories', state.subcategories || []);
    Storage.set('settings', state.settings || {});
    
    return { success: true };
  } catch (e) {
    console.error('Save state error:', e);
    return { success: false, error: e.message };
  }
}

// Validate state structure
function validateState(data) {
  if (!data) return false;
  
  // Basic structure checks
  if (!Array.isArray(data.cars)) return false;
  if (!Array.isArray(data.expenses)) return false;
  if (!Array.isArray(data.reminders)) return false;
  if (typeof data.maintenance !== 'object') return false;
  if (typeof data.intervals !== 'object') return false;
  
  return true;
}

// Export backup
function exportBackup() {
  try {
    const data = {
      version: STORAGE_SCHEMA_VERSION,
      exportDate: new Date().toISOString(),
      cars: Storage.get('cars', []),
      expenses: Storage.get('expenses', []),
      maintenance: Storage.get('maintenance', {}),
      intervals: Storage.get('intervals', {}),
      reminders: Storage.get('reminders', []),
      fuel: Storage.get('fuel', []),
      service: Storage.get('service', []),
      categories: Storage.get('categories', []),
      subcategories: Storage.get('subcategories', []),
      settings: Storage.get('settings', {})
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `autodiary_backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    return { success: true };
  } catch (e) {
    console.error('Export backup error:', e);
    return { success: false, error: e.message };
  }
}

// Import backup with merge support
function importBackup(file, merge = false) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        if (merge) {
          // Merge mode: combine with existing data
          const currentData = loadState();
          const current = currentData.success ? currentData.data : {};
          
          // Merge strategy: prefer matching by id, generate new ids for collisions
          const merged = { ...current };
          const idMap = {}; // Maps old ids to new ids
          
          // Merge cars
          if (importedData.cars) {
            if (!merged.cars) merged.cars = [];
            importedData.cars.forEach(importedCar => {
              const existing = merged.cars.find(c => c.id === importedCar.id);
              if (!existing) {
                // Check for duplicate by brand/model/year
                const duplicate = merged.cars.find(c => 
                  c.brand === importedCar.brand && 
                  c.model === importedCar.model && 
                  c.year === importedCar.year
                );
                if (duplicate) {
                  idMap[importedCar.id] = duplicate.id;
                } else {
                  merged.cars.push({ ...importedCar });
                }
              }
            });
          }
          
          // Merge expenses with id remapping
          if (importedData.expenses) {
            if (!merged.expenses) merged.expenses = [];
            importedData.expenses.forEach(importedExp => {
              const existing = merged.expenses.find(e => e.id === importedExp.id);
              if (!existing) {
                const newExp = { ...importedExp };
                if (idMap[importedExp.carId]) {
                  newExp.carId = idMap[importedExp.carId];
                }
                merged.expenses.push(newExp);
              }
            });
          }
          
          // Merge fuel entries
          if (importedData.fuel) {
            if (!merged.fuel) merged.fuel = [];
            importedData.fuel.forEach(importedFuel => {
              const existing = merged.fuel.find(f => f.id === importedFuel.id);
              if (!existing) {
                const newFuel = { ...importedFuel };
                if (idMap[importedFuel.carId]) {
                  newFuel.carId = idMap[importedFuel.carId];
                }
                merged.fuel.push(newFuel);
              }
            });
          }
          
          // Merge service records
          if (importedData.service) {
            if (!merged.service) merged.service = [];
            importedData.service.forEach(importedService => {
              const existing = merged.service.find(s => s.id === importedService.id);
              if (!existing) {
                const newService = { ...importedService };
                if (idMap[importedService.carId]) {
                  newService.carId = idMap[importedService.carId];
                }
                merged.service.push(newService);
              }
            });
          }
          
          // Merge categories and subcategories (match by normalized name)
          if (importedData.categories) {
            if (!merged.categories) merged.categories = [];
            importedData.categories.forEach(importedCat => {
              const normalized = (importedCat.name || '').trim().toLowerCase();
              const existing = merged.categories.find(c => 
                (c.name || '').trim().toLowerCase() === normalized
              );
              if (!existing) {
                merged.categories.push({ ...importedCat });
              }
            });
          }
          
          if (importedData.subcategories) {
            if (!merged.subcategories) merged.subcategories = [];
            importedData.subcategories.forEach(importedSub => {
              const normalized = (importedSub.name || '').trim().toLowerCase();
              const existing = merged.subcategories.find(s => 
                s.categoryId === importedSub.categoryId &&
                (s.name || '').trim().toLowerCase() === normalized
              );
              if (!existing) {
                merged.subcategories.push({ ...importedSub });
              }
            });
          }
          
          // Merge reminders
          if (importedData.reminders) {
            if (!merged.reminders) merged.reminders = [];
            importedData.reminders.forEach(importedRem => {
              const existing = merged.reminders.find(r => r.id === importedRem.id);
              if (!existing) {
                const newRem = { ...importedRem };
                if (idMap[importedRem.carId]) {
                  newRem.carId = idMap[importedRem.carId];
                }
                merged.reminders.push(newRem);
              }
            });
          }
          
          // Ensure schema version
          merged.schemaVersion = STORAGE_SCHEMA_VERSION;
          
          const result = saveState(merged);
          if (result.success) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: result.error || 'Ошибка сохранения' });
          }
        } else {
          // Replace mode: validate and save
          if (!validateState(importedData)) {
            resolve({ success: false, error: 'Неверный формат файла резервной копии' });
            return;
          }
          
          // Migrate imported data if needed
          let migratedData = importedData;
          const importedVersion = importedData.schemaVersion || 1;
          if (importedVersion < STORAGE_SCHEMA_VERSION) {
            for (let v = importedVersion; v < STORAGE_SCHEMA_VERSION; v++) {
              if (migrations[v]) {
                migratedData = migrations[v](migratedData);
              }
            }
          }
          
          const result = saveState(migratedData);
          if (result.success) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: result.error || 'Ошибка импорта' });
          }
        }
      } catch (e) {
        console.error('Import backup error:', e);
        resolve({ success: false, error: 'Ошибка чтения файла: ' + e.message });
      }
    };
    reader.onerror = () => {
      resolve({ success: false, error: 'Ошибка чтения файла' });
    };
    reader.readAsText(file);
  });
}

// Export to window for global access
window.Storage = Storage;
window.loadState = loadState;
window.saveState = saveState;
window.exportBackup = exportBackup;
window.importBackup = importBackup;

