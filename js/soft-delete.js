// Soft delete and undo system
// Provides trash functionality and undo for destructive actions

let undoStack = [];
const UNDO_TIMEOUT = 10000; // 10 seconds

const SoftDelete = {
  // Move item to trash (soft delete)
  delete(item, type, state) {
    const deletedAt = new Date().toISOString();
    item.deletedAt = deletedAt;
    
    // Save to undo stack
    undoStack.push({
      item: { ...item },
      type: type,
      timestamp: Date.now()
    });
    
    // Clean old undo items
    const now = Date.now();
    undoStack = undoStack.filter(u => now - u.timestamp < UNDO_TIMEOUT);
    
    return item;
  },
  
  // Restore item from trash
  restore(item) {
    item.deletedAt = null;
    return item;
  },
  
  // Hard delete (permanent)
  hardDelete(item, type, state) {
    if (type === 'car') {
      state.cars = state.cars.filter(c => c.id !== item.id);
      // Also delete related expenses, fuel, service
      state.expenses = state.expenses.filter(e => e.carId !== item.id);
      state.fuel = (state.fuel || []).filter(f => f.carId !== item.id);
      state.service = (state.service || []).filter(s => s.carId !== item.id);
    } else if (type === 'expense') {
      state.expenses = state.expenses.filter(e => e.id !== item.id);
    } else if (type === 'reminder') {
      state.reminders = state.reminders.filter(r => r.id !== item.id);
    } else if (type === 'fuel') {
      state.fuel = (state.fuel || []).filter(f => f.id !== item.id);
    } else if (type === 'service') {
      state.service = (state.service || []).filter(s => s.id !== item.id);
    }
  },
  
  // Get active items (not deleted)
  getActive(items) {
    return items.filter(item => !item.deletedAt);
  },
  
  // Get trashed items
  getTrash(items) {
    return items.filter(item => item.deletedAt);
  },
  
  // Empty trash
  emptyTrash(state) {
    state.cars = SoftDelete.getActive(state.cars);
    state.expenses = SoftDelete.getActive(state.expenses);
    state.reminders = SoftDelete.getActive(state.reminders);
    state.fuel = SoftDelete.getActive(state.fuel || []);
    state.service = SoftDelete.getActive(state.service || []);
  },
  
  // Get last undo action
  getLastUndo() {
    if (undoStack.length === 0) return null;
    return undoStack[undoStack.length - 1];
  },
  
  // Undo last action
  undo(state) {
    if (undoStack.length === 0) return false;
    
    const lastAction = undoStack.pop();
    const item = lastAction.item;
    
    // Find and restore item
    if (lastAction.type === 'car') {
      const car = state.cars.find(c => c.id === item.id);
      if (car) {
        car.deletedAt = null;
      }
    } else if (lastAction.type === 'expense') {
      const expense = state.expenses.find(e => e.id === item.id);
      if (expense) {
        expense.deletedAt = null;
      }
    } else if (lastAction.type === 'reminder') {
      const reminder = state.reminders.find(r => r.id === item.id);
      if (reminder) {
        reminder.deletedAt = null;
      }
    } else if (lastAction.type === 'fuel') {
      const fuel = (state.fuel || []).find(f => f.id === item.id);
      if (fuel) {
        fuel.deletedAt = null;
      }
    } else if (lastAction.type === 'service') {
      const service = (state.service || []).find(s => s.id === item.id);
      if (service) {
        service.deletedAt = null;
      }
    }
    
    return true;
  },
  
  // Clear undo stack
  clearUndoStack() {
    undoStack = [];
  }
};

// Export to window for global access
window.SoftDelete = SoftDelete;

