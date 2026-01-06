// Maintenance Plan (Регламент обслуживания) module
// Handles maintenance schedule per vehicle with intervals, due calculations, and templates

const MaintenancePlan = {
  // Preset maintenance item types
  PRESET_TYPES: {
    'engineOil': { title: 'Масло двигателя', icon: 'droplet', defaultKm: 10000, defaultMonths: 12 },
    'brakeFluid': { title: 'Тормозная жидкость', icon: 'droplet', defaultKm: 60000, defaultMonths: 24 },
    'coolant': { title: 'Охлаждающая жидкость', icon: 'droplet', defaultKm: 60000, defaultMonths: 24 },
    'transmissionOil': { title: 'Масло КПП', icon: 'droplet', defaultKm: 60000, defaultMonths: 60 },
    'oilFilter': { title: 'Масляный фильтр', icon: 'filter', defaultKm: 10000, defaultMonths: 12 },
    'airFilter': { title: 'Воздушный фильтр', icon: 'filter', defaultKm: 30000, defaultMonths: 24 },
    'cabinFilter': { title: 'Салонный фильтр', icon: 'filter', defaultKm: 20000, defaultMonths: 12 },
    'fuelFilter': { title: 'Топливный фильтр', icon: 'filter', defaultKm: 60000, defaultMonths: 36 },
    'sparkPlugs': { title: 'Свечи зажигания', icon: 'zap', defaultKm: 60000, defaultMonths: 60 },
    'timingBelt': { title: 'Ремень ГРМ / цепь', icon: 'settings', defaultKm: 100000, defaultMonths: 60 },
    'powerSteeringOil': { title: 'Масло ГУР', icon: 'droplet', defaultKm: 60000, defaultMonths: 36 },
    'differentialOil': { title: 'Масло дифференциала / раздатки', icon: 'droplet', defaultKm: 80000, defaultMonths: 48 }
  },
  
  // Get basic template items
  getBasicTemplate() {
    return [
      'engineOil',
      'brakeFluid',
      'coolant',
      'transmissionOil',
      'oilFilter',
      'airFilter',
      'cabinFilter',
      'fuelFilter',
      'sparkPlugs',
      'timingBelt'
    ];
  },
  
  // Get extended template items (includes basic + additional)
  getExtendedTemplate() {
    return [
      ...this.getBasicTemplate(),
      'powerSteeringOil',
      'differentialOil'
    ];
  },
  
  // Create a plan item from preset type
  createPresetItem(typeKey) {
    const preset = this.PRESET_TYPES[typeKey];
    if (!preset) return null;
    
    return {
      id: 'plan-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      typeKey: typeKey,
      title: preset.title,
      intervalKm: preset.defaultKm,
      intervalMonths: preset.defaultMonths,
      remindBeforeKm: Math.round(preset.defaultKm * 0.1), // 10% of interval
      remindBeforeDays: 14,
      lastServiceOdometer: null,
      lastServiceDate: null,
      enabled: true,
      notes: null
    };
  },
  
  // Create a custom plan item
  createCustomItem(title) {
    return {
      id: 'plan-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      typeKey: null,
      title: title || 'Новый пункт',
      intervalKm: null,
      intervalMonths: null,
      remindBeforeKm: null,
      remindBeforeDays: null,
      lastServiceOdometer: null,
      lastServiceDate: null,
      enabled: true,
      notes: null
    };
  },
  
  // Get plan for vehicle
  getPlan(car, state) {
    if (!car) return [];
    return car.servicePlan || [];
  },
  
  // Upsert plan item
  upsertPlanItem(car, item, state) {
    if (!car || !item) return false;
    
    if (!car.servicePlan) {
      car.servicePlan = [];
    }
    
    const existingIndex = car.servicePlan.findIndex(p => p.id === item.id);
    if (existingIndex >= 0) {
      car.servicePlan[existingIndex] = { ...item };
    } else {
      car.servicePlan.push({ ...item });
    }
    
    return true;
  },
  
  // Delete plan item
  deletePlanItem(car, itemId, state) {
    if (!car || !car.servicePlan) return false;
    
    car.servicePlan = car.servicePlan.filter(p => p.id !== itemId);
    return true;
  },
  
  // Apply template to vehicle
  applyTemplate(car, templateKey, state) {
    if (!car) return false;
    
    if (!car.servicePlan) {
      car.servicePlan = [];
    }
    
    const templateTypes = templateKey === 'extended' 
      ? this.getExtendedTemplate() 
      : this.getBasicTemplate();
    
    // Add items that don't already exist
    templateTypes.forEach(typeKey => {
      const exists = car.servicePlan.some(p => p.typeKey === typeKey);
      if (!exists) {
        const item = this.createPresetItem(typeKey);
        if (item) {
          car.servicePlan.push(item);
        }
      }
    });
    
    if (car.servicePlan.length > 0) {
      car.maintenanceTemplatesApplied = true;
    }
    
    return true;
  },
  
  // Compute plan status for all items
  computePlanStatus(car, nowDate, currentOdometer, state) {
    if (!car || !car.servicePlan) return [];
    
    const now = nowDate || new Date();
    const currentOdo = parseFloat(currentOdometer) || 0;
    
    return car.servicePlan.map(item => {
      if (!item.enabled) {
        return {
          ...item,
          status: 'ok',
          nextDueOdometer: null,
          nextDueDate: null,
          statusMessage: 'Отключено'
        };
      }
      
      // Calculate next due
      let nextDueOdometer = null;
      let nextDueDate = null;
      
      if (item.lastServiceOdometer !== null && item.intervalKm !== null) {
        nextDueOdometer = item.lastServiceOdometer + item.intervalKm;
      }
      
      if (item.lastServiceDate !== null && item.intervalMonths !== null) {
        const lastDate = new Date(item.lastServiceDate);
        nextDueDate = new Date(lastDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + item.intervalMonths);
      }
      
      // Determine status
      let status = 'ok';
      let statusMessage = 'В порядке';
      
      // Check if overdue
      const isOverdueKm = nextDueOdometer !== null && currentOdo >= nextDueOdometer;
      const isOverdueDate = nextDueDate !== null && now >= nextDueDate;
      
      if (isOverdueKm || isOverdueDate) {
        status = 'overdue';
        if (isOverdueKm && isOverdueDate) {
          statusMessage = `Просрочено: ${currentOdo} км из ${nextDueOdometer} км, ${formatDate(nextDueDate)}`;
        } else if (isOverdueKm) {
          statusMessage = `Просрочено: ${currentOdo} км из ${nextDueOdometer} км`;
        } else {
          statusMessage = `Просрочено: ${formatDate(nextDueDate)}`;
        }
      } else {
        // Check if soon
        const remindBeforeKm = item.remindBeforeKm || 0;
        const remindBeforeDays = item.remindBeforeDays || 0;
        
        const soonKm = nextDueOdometer !== null && 
          (currentOdo >= (nextDueOdometer - remindBeforeKm)) && 
          currentOdo < nextDueOdometer;
        
        const soonDate = nextDueDate !== null && 
          remindBeforeDays > 0 && 
          (now >= new Date(nextDueDate.getTime() - remindBeforeDays * 24 * 60 * 60 * 1000)) &&
          now < nextDueDate;
        
        if (soonKm || soonDate) {
          status = 'soon';
          if (soonKm && soonDate) {
            statusMessage = `Скоро: через ${nextDueOdometer - currentOdo} км или ${formatDate(nextDueDate)}`;
          } else if (soonKm) {
            statusMessage = `Скоро: через ${nextDueOdometer - currentOdo} км`;
          } else {
            statusMessage = `Скоро: ${formatDate(nextDueDate)}`;
          }
        }
      }
      
      // Determine which due is more urgent for display
      let displayDue = null;
      if (nextDueOdometer !== null && nextDueDate !== null) {
        // Show the earlier one
        const kmRemaining = nextDueOdometer - currentOdo;
        const daysRemaining = Math.ceil((nextDueDate - now) / (1000 * 60 * 60 * 24));
        
        // Estimate km per day (rough calculation)
        const avgKmPerDay = 50; // Default estimate
        const kmDays = kmRemaining / avgKmPerDay;
        
        displayDue = kmDays < daysRemaining 
          ? { type: 'km', value: nextDueOdometer, remaining: kmRemaining }
          : { type: 'date', value: nextDueDate, remaining: daysRemaining };
      } else if (nextDueOdometer !== null) {
        displayDue = { type: 'km', value: nextDueOdometer, remaining: nextDueOdometer - currentOdo };
      } else if (nextDueDate !== null) {
        displayDue = { type: 'date', value: nextDueDate, remaining: Math.ceil((nextDueDate - now) / (1000 * 60 * 60 * 24)) };
      }
      
      return {
        ...item,
        status,
        statusMessage,
        nextDueOdometer,
        nextDueDate,
        displayDue
      };
    }).sort((a, b) => {
      // Sort: overdue first, then soon, then ok
      const statusOrder = { 'overdue': 0, 'soon': 1, 'ok': 2 };
      const aOrder = statusOrder[a.status] || 2;
      const bOrder = statusOrder[b.status] || 2;
      
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      
      // Within same status, sort by urgency (closer due first)
      if (a.status === 'overdue' || a.status === 'soon') {
        if (a.displayDue && b.displayDue) {
          return a.displayDue.remaining - b.displayDue.remaining;
        }
      }
      
      return 0;
    });
  },
  
  // Match service entry to plan item
  matchServiceToPlan(serviceEntry, planItems) {
    if (!serviceEntry || !planItems) return null;
    
    // Try to match by type
    const serviceType = serviceEntry.type || '';
    const serviceTypeLabel = serviceEntry.typeLabel || '';
    
    // Map service types to plan typeKeys
    const typeMap = {
      'oil': 'engineOil',
      'oilFilter': 'oilFilter',
      'airFilter': 'airFilter',
      'cabinFilter': 'cabinFilter',
      'fuelFilter': 'fuelFilter',
      'transmissionOil': 'transmissionOil',
      'coolant': 'coolant',
      'sparkPlugs': 'sparkPlugs',
      'timingBelt': 'timingBelt'
    };
    
    const matchedTypeKey = typeMap[serviceType];
    if (matchedTypeKey) {
      const planItem = planItems.find(p => p.typeKey === matchedTypeKey && p.enabled);
      if (planItem) return planItem;
    }
    
    // Try to match by label text (fuzzy)
    const lowerLabel = serviceTypeLabel.toLowerCase();
    for (const item of planItems) {
      if (!item.enabled) continue;
      
      const preset = this.PRESET_TYPES[item.typeKey];
      if (preset && lowerLabel.includes(preset.title.toLowerCase().substring(0, 5))) {
        return item;
      }
    }
    
    return null;
  },
  
  // Update plan item from service entry
  updateFromServiceEntry(planItem, serviceEntry) {
    if (!planItem || !serviceEntry) return planItem;
    
    const updated = { ...planItem };
    
    if (serviceEntry.odometer !== null && serviceEntry.odometer !== undefined) {
      updated.lastServiceOdometer = parseFloat(serviceEntry.odometer);
    }
    
    if (serviceEntry.date) {
      updated.lastServiceDate = serviceEntry.date;
    }
    
    return updated;
  }
};

// Helper function to format date
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

// Export to window for global access
window.MaintenancePlan = MaintenancePlan;

