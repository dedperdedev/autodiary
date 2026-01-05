// Reports module
// Handles report generation, statistics, and export

const Reports = {
  // Generate report data for car or global
  generateReport(carId, dateFrom, dateTo, state) {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    
    // Filter by date range
    const filterByDate = (item) => {
      if (!from && !to) return true;
      const itemDate = new Date(item.date);
      if (from && itemDate < from) return false;
      if (to && itemDate > to) return false;
      return true;
    };
    
    // Get expenses
    const expenses = (state.expenses || [])
      .filter(e => !e.deletedAt && (!carId || e.carId === carId))
      .filter(filterByDate);
    
    // Get fuel entries
    const fuelEntries = (state.fuel || [])
      .filter(f => !f.deletedAt && (!carId || f.carId === carId))
      .filter(filterByDate);
    
    // Get service records
    const serviceRecords = (state.service || [])
      .filter(s => !s.deletedAt && (!carId || s.carId === carId))
      .filter(filterByDate);
    
    // Calculate totals
    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const totalFuel = fuelEntries.reduce((sum, f) => sum + parseFloat(f.totalCost || 0), 0);
    const totalService = serviceRecords.reduce((sum, s) => sum + parseFloat(s.cost || 0), 0);
    const totalSpent = totalExpenses + totalFuel + totalService;
    
    // Expenses by category
    const expensesByCategory = {};
    expenses.forEach(exp => {
      const catId = exp.categoryId || 'other';
      const catName = (typeof Categories !== 'undefined' && Categories.getCategoryName) ?
        Categories.getCategoryName(catId, state) : (exp.category || 'Другое');
      
      if (!expensesByCategory[catId]) {
        expensesByCategory[catId] = {
          id: catId,
          name: catName,
          total: 0,
          count: 0,
          bySubcategory: {}
        };
      }
      expensesByCategory[catId].total += parseFloat(exp.amount || 0);
      expensesByCategory[catId].count++;
      
      // By subcategory
      if (exp.subcategoryId) {
        const subName = (typeof Categories !== 'undefined' && Categories.getSubcategoryName) ?
          Categories.getSubcategoryName(exp.subcategoryId, state) : 'Не указано';
        
        if (!expensesByCategory[catId].bySubcategory[exp.subcategoryId]) {
          expensesByCategory[catId].bySubcategory[exp.subcategoryId] = {
            id: exp.subcategoryId,
            name: subName,
            total: 0,
            count: 0
          };
        }
        expensesByCategory[catId].bySubcategory[exp.subcategoryId].total += parseFloat(exp.amount || 0);
        expensesByCategory[catId].bySubcategory[exp.subcategoryId].count++;
      }
    });
    
    // Fuel statistics
    let fuelConsumption = null;
    let fuelEntriesCount = fuelEntries.length;
    if (fuelEntries.length >= 2 && typeof Fuel !== 'undefined' && Fuel.getAverageConsumption) {
      const sorted = [...fuelEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
      fuelConsumption = Fuel.getAverageConsumption(sorted);
    }
    
    // Service statistics
    const serviceByType = {};
    serviceRecords.forEach(s => {
      const type = s.type || 'other';
      if (!serviceByType[type]) {
        serviceByType[type] = {
          type: s.typeLabel || type,
          total: 0,
          count: 0
        };
      }
      serviceByType[type].total += parseFloat(s.cost || 0);
      serviceByType[type].count++;
    });
    
    // Cost per km (if odometer data available)
    let costPerKm = null;
    if (carId) {
      const allEntries = [
        ...expenses.filter(e => e.odometer > 0),
        ...fuelEntries.filter(f => f.odometer > 0),
        ...serviceRecords.filter(s => s.odometer > 0)
      ];
      
      if (allEntries.length >= 2) {
        const sorted = allEntries.sort((a, b) => parseFloat(a.odometer) - parseFloat(b.odometer));
        const minOdo = parseFloat(sorted[0].odometer);
        const maxOdo = parseFloat(sorted[sorted.length - 1].odometer);
        const distance = maxOdo - minOdo;
        
        if (distance > 0) {
          costPerKm = totalSpent / distance;
        }
      }
    }
    
    return {
      carId,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      totals: {
        expenses: totalExpenses,
        fuel: totalFuel,
        service: totalService,
        total: totalSpent
      },
      expensesByCategory,
      fuel: {
        total: totalFuel,
        consumption: fuelConsumption,
        entriesCount: fuelEntriesCount
      },
      service: {
        total: totalService,
        byType: serviceByType,
        recordsCount: serviceRecords.length
      },
      costPerKm,
      entriesCount: {
        expenses: expenses.length,
        fuel: fuelEntries.length,
        service: serviceRecords.length
      }
    };
  },
  
  // Export to CSV
  exportToCSV(reportData, state, type = 'all') {
    const rows = [];
    const headers = [];
    
    if (type === 'all' || type === 'expenses') {
      headers.push(['Дата', 'Категория', 'Подкатегория', 'Сумма', 'Пробег', 'Заметки']);
      const expenses = (state.expenses || [])
        .filter(e => !e.deletedAt && (!reportData.carId || e.carId === reportData.carId));
      
      expenses.forEach(exp => {
        const catName = (typeof Categories !== 'undefined' && Categories.getCategoryName) ?
          Categories.getCategoryName(exp.categoryId, state) : (exp.category || 'Другое');
        const subName = exp.subcategoryId && (typeof Categories !== 'undefined' && Categories.getSubcategoryName) ?
          Categories.getSubcategoryName(exp.subcategoryId, state) : 'Не указано';
        
        rows.push([
          exp.date,
          catName,
          subName,
          exp.amount || 0,
          exp.odometer || '',
          (exp.notes || '').replace(/"/g, '""')
        ]);
      });
    }
    
    if (type === 'all' || type === 'fuel') {
      if (headers.length === 0) {
        headers.push(['Дата', 'Пробег', 'Литры', 'Стоимость', 'Цена за литр', 'Полный бак', 'АЗС', 'Заметки']);
      }
      const fuel = (state.fuel || [])
        .filter(f => !f.deletedAt && (!reportData.carId || f.carId === reportData.carId));
      
      fuel.forEach(f => {
        rows.push([
          f.date,
          f.odometer || '',
          f.liters || 0,
          f.totalCost || 0,
          f.pricePerLiter || 0,
          f.fullTank ? 'Да' : 'Нет',
          (f.station || '').replace(/"/g, '""'),
          (f.notes || '').replace(/"/g, '""')
        ]);
      });
    }
    
    if (type === 'all' || type === 'service') {
      if (headers.length === 0) {
        headers.push(['Дата', 'Пробег', 'Тип', 'Стоимость', 'Сервис', 'Заметки']);
      }
      const service = (state.service || [])
        .filter(s => !s.deletedAt && (!reportData.carId || s.carId === reportData.carId));
      
      service.forEach(s => {
        rows.push([
          s.date,
          s.odometer || '',
          s.typeLabel || s.type || 'Другое',
          s.cost || 0,
          (s.shop || '').replace(/"/g, '""'),
          (s.notes || '').replace(/"/g, '""')
        ]);
      });
    }
    
    const csv = [
      headers[0].map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return '\ufeff' + csv; // BOM for Excel
  }
};

window.Reports = Reports;

