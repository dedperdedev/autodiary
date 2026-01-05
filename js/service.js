// Service/Maintenance module - first-class service tracking
// Handles service records, schedules, due logic, and snooze

const Service = {
  // Service types
  TYPES: {
    'oil': 'Замена масла',
    'oilFilter': 'Замена масляного фильтра',
    'airFilter': 'Замена воздушного фильтра',
    'cabinFilter': 'Замена фильтра салона',
    'fuelFilter': 'Замена топливного фильтра',
    'transmissionOil': 'Замена масла КПП',
    'brakes': 'Тормозные колодки/диски',
    'tires': 'Шины',
    'battery': 'Аккумулятор',
    'coolant': 'Охлаждающая жидкость',
    'sparkPlugs': 'Свечи зажигания',
    'timingBelt': 'Ремень ГРМ',
    'other': 'Другое'
  },
  
  // Add service record
  addRecord(carId, data) {
    const record = {
      id: Date.now().toString(),
      carId,
      date: data.date || new Date().toISOString().split('T')[0],
      odometer: parseFloat(data.odometer) || 0,
      type: data.type || 'other',
      typeLabel: Service.TYPES[data.type] || data.typeLabel || 'Другое',
      cost: parseFloat(data.cost) || 0,
      shop: data.shop || '',
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
      deletedAt: null
    };
    
    return record;
  },
  
  // Get default service intervals
  getDefaultIntervals() {
    return {
      'oil': { intervalKm: 10000, intervalMonths: 12 },
      'oilFilter': { intervalKm: 10000, intervalMonths: 12 },
      'airFilter': { intervalKm: 30000, intervalMonths: 24 },
      'cabinFilter': { intervalKm: 20000, intervalMonths: 12 },
      'fuelFilter': { intervalKm: 60000, intervalMonths: 36 },
      'transmissionOil': { intervalKm: 60000, intervalMonths: 60 },
      'brakes': { intervalKm: 50000, intervalMonths: 36 },
      'tires': { intervalKm: 50000, intervalMonths: 60 },
      'battery': { intervalKm: 0, intervalMonths: 36 },
      'coolant': { intervalKm: 60000, intervalMonths: 24 },
      'sparkPlugs': { intervalKm: 60000, intervalMonths: 60 },
      'timingBelt': { intervalKm: 100000, intervalMonths: 60 }
    };
  },
  
  // Check if service is due
  checkDue(serviceType, lastRecord, intervals, currentOdometer, currentDate) {
    if (!lastRecord) {
      return { status: 'ok', message: 'Нет записей' };
    }
    
    const interval = intervals[serviceType] || { intervalKm: 0, intervalMonths: 0 };
    const lastDate = new Date(lastRecord.date);
    const lastOdo = parseFloat(lastRecord.odometer) || 0;
    
    // Calculate due thresholds
    const dueKm = lastOdo + interval.intervalKm;
    const dueDate = new Date(lastDate);
    dueDate.setMonth(dueDate.getMonth() + interval.intervalMonths);
    
    // Calculate "due soon" thresholds (10% or 14 days)
    const dueSoonKm = dueKm - (interval.intervalKm * 0.1);
    const dueSoonDate = new Date(dueDate);
    dueSoonDate.setDate(dueSoonDate.getDate() - 14);
    
    const currentOdoNum = parseFloat(currentOdometer) || 0;
    const isOverdueKm = currentOdoNum >= dueKm;
    const isOverdueDate = currentDate >= dueDate;
    const isDueSoonKm = currentOdoNum >= dueSoonKm && currentOdoNum < dueKm;
    const isDueSoonDate = currentDate >= dueSoonDate && currentDate < dueDate;
    
    if (isOverdueKm || isOverdueDate) {
      return {
        status: 'due',
        message: isOverdueKm ? `Просрочено по пробегу (${currentOdoNum} км из ${dueKm} км)` : `Просрочено по дате`,
        dueKm,
        dueDate
      };
    }
    
    if (isDueSoonKm || isDueSoonDate) {
      return {
        status: 'soon',
        message: `Скоро потребуется (${currentOdoNum} км из ${dueKm} км)`,
        dueKm,
        dueDate
      };
    }
    
    return {
      status: 'ok',
      message: 'В порядке',
      dueKm,
      dueDate
    };
  },
  
  // Snooze service (postpone)
  snooze(serviceType, intervals, byKm = null, byDays = null) {
    const interval = intervals[serviceType] || { intervalKm: 0, intervalMonths: 0 };
    
    if (byKm) {
      interval.intervalKm += byKm;
    }
    
    if (byDays) {
      interval.intervalMonths += Math.ceil(byDays / 30);
    }
    
    return interval;
  },
  
  // Get service stats for car
  getStats(carId, serviceRecords) {
    // serviceRecords already filtered by carId, just filter deleted
    const carService = serviceRecords.filter(s => !s.deletedAt);
    if (carService.length === 0) {
      return {
        totalSpent: 0,
        recordsCount: 0,
        byType: {}
      };
    }
    
    const totalSpent = carService.reduce((sum, s) => sum + parseFloat(s.cost || 0), 0);
    const byType = {};
    
    carService.forEach(record => {
      const type = record.type || 'other';
      if (!byType[type]) {
        byType[type] = {
          count: 0,
          totalCost: 0,
          lastDate: null
        };
      }
      byType[type].count++;
      byType[type].totalCost += parseFloat(record.cost || 0);
      if (!byType[type].lastDate || new Date(record.date) > new Date(byType[type].lastDate)) {
        byType[type].lastDate = record.date;
      }
    });
    
    return {
      totalSpent: parseFloat(totalSpent.toFixed(2)),
      recordsCount: carService.length,
      byType
    };
  }
};

// Export to window for global access
window.Service = Service;

