// Templates and Recurring expenses module
// Handles expense/service/fuel templates and recurring rules

const Templates = {
  // Create template from entry
  createTemplate(entry, type, state) {
    const template = {
      id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: type, // 'expense', 'fuel', 'service'
      name: entry.name || `${type} template`,
      data: {
        categoryId: entry.categoryId || null,
        subcategoryId: entry.subcategoryId || null,
        amount: entry.amount || 0,
        notes: entry.notes || '',
        // For fuel
        liters: entry.liters || null,
        fullTank: entry.fullTank || false,
        station: entry.station || '',
        // For service
        type: entry.type || null,
        typeLabel: entry.typeLabel || null,
        shop: entry.shop || ''
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null
    };
    
    if(!state.templates) state.templates = [];
    state.templates.push(template);
    return template;
  },
  
  // Get template by ID
  getTemplate(id, state) {
    return (state.templates || []).find(t => t.id === id && !t.deletedAt);
  },
  
  // Get all templates
  getTemplates(type = null, state) {
    let templates = (state.templates || []).filter(t => !t.deletedAt);
    if(type) {
      templates = templates.filter(t => t.type === type);
    }
    return templates;
  },
  
  // Apply template to create entry data
  applyTemplate(template, carId, date = null) {
    const data = {
      ...template.data,
      carId,
      date: date || new Date().toISOString().split('T')[0]
    };
    return data;
  }
};

const Recurring = {
  // Create recurring rule
  createRule(templateId, carId, frequency, state) {
    const rule = {
      id: `recurring-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      templateId,
      carId,
      frequency: frequency, // 'weekly', 'monthly', 'yearly', 'custom'
      customDays: frequency === 'custom' ? 30 : null,
      lastGenerated: null,
      nextDue: this.calculateNextDue(frequency, null),
      createdAt: new Date().toISOString(),
      deletedAt: null
    };
    
    if(!state.recurringRules) state.recurringRules = [];
    state.recurringRules.push(rule);
    return rule;
  },
  
  // Calculate next due date
  calculateNextDue(frequency, lastDate) {
    const now = new Date();
    const next = new Date(lastDate || now);
    
    switch(frequency) {
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
      case 'custom':
        // Will use customDays
        break;
      default:
        return null;
    }
    
    return next.toISOString().split('T')[0];
  },
  
  // Get upcoming items (not yet created)
  getUpcoming(state) {
    const now = new Date();
    const upcoming = [];
    
    (state.recurringRules || []).filter(r => !r.deletedAt).forEach(rule => {
      const nextDue = new Date(rule.nextDue || rule.lastGenerated || now);
      if(nextDue <= now || !rule.lastGenerated) {
        const template = Templates.getTemplate(rule.templateId, state);
        if(template) {
          const car = state.cars.find(c => c.id === rule.carId);
          upcoming.push({
            id: rule.id,
            rule,
            template,
            car: car ? `${car.brand} ${car.model}` : 'Неизвестный автомобиль',
            dueDate: rule.nextDue,
            type: template.type
          });
        }
      }
    });
    
    return upcoming.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  },
  
  // Mark as paid - creates actual entry
  markAsPaid(ruleId, state) {
    const rule = state.recurringRules.find(r => r.id === ruleId && !r.deletedAt);
    if(!rule) return null;
    
    const template = Templates.getTemplate(rule.templateId, state);
    if(!template) return null;
    
    // Create entry from template
    const entryData = Templates.applyTemplate(template, rule.carId, rule.nextDue);
    
    let entry = null;
    if(template.type === 'expense') {
      entry = {
        id: Date.now().toString(),
        ...entryData,
        deletedAt: null
      };
      if(!state.expenses) state.expenses = [];
      state.expenses.push(entry);
    } else if(template.type === 'fuel') {
      if(typeof Fuel !== 'undefined' && Fuel.addEntry) {
        entry = Fuel.addEntry(rule.carId, entryData);
      } else {
        entry = {
          id: Date.now().toString(),
          carId: rule.carId,
          ...entryData,
          deletedAt: null
        };
      }
      if(!state.fuel) state.fuel = [];
      state.fuel.push(entry);
    } else if(template.type === 'service') {
      if(typeof Service !== 'undefined' && Service.addRecord) {
        entry = Service.addRecord(rule.carId, entryData);
      } else {
        entry = {
          id: Date.now().toString(),
          carId: rule.carId,
          ...entryData,
          deletedAt: null
        };
      }
      if(!state.service) state.service = [];
      state.service.push(entry);
    }
    
    // Update rule
    rule.lastGenerated = rule.nextDue;
    rule.nextDue = this.calculateNextDue(rule.frequency, rule.nextDue);
    
    return entry;
  }
};

window.Templates = Templates;
window.Recurring = Recurring;

