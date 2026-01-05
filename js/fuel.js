// Fuel module - first-class fuel tracking
// Handles fuel entries, consumption calculations, and fuel stats

const Fuel = {
  // Add fuel entry
  addEntry(carId, data) {
    const entry = {
      id: Date.now().toString(),
      carId,
      date: data.date || new Date().toISOString().split('T')[0],
      odometer: parseFloat(data.odometer) || 0,
      liters: parseFloat(data.liters) || 0,
      totalCost: parseFloat(data.totalCost) || 0,
      pricePerLiter: data.liters > 0 ? (data.totalCost / data.liters).toFixed(2) : 0,
      fullTank: data.fullTank || false,
      station: data.station || '',
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
      deletedAt: null
    };
    
    return entry;
  },
  
  // Calculate consumption using full-to-full method
  calculateConsumption(fuelEntries, entryIndex) {
    if (!fuelEntries || fuelEntries.length === 0) return null;
    
    const entry = fuelEntries[entryIndex];
    if (!entry || !entry.fullTank) return null;
    
    // Find previous full tank
    let prevFullTankIndex = -1;
    for (let i = entryIndex - 1; i >= 0; i--) {
      if (fuelEntries[i].fullTank) {
        prevFullTankIndex = i;
        break;
      }
    }
    
    if (prevFullTankIndex === -1) return null; // Not enough data
    
    const prevEntry = fuelEntries[prevFullTankIndex];
    const distance = entry.odometer - prevEntry.odometer;
    if (distance <= 0) return null;
    
    // Sum liters between full tanks
    let totalLiters = 0;
    for (let i = prevFullTankIndex + 1; i <= entryIndex; i++) {
      totalLiters += parseFloat(fuelEntries[i].liters) || 0;
    }
    
    // L/100km
    const consumption = (totalLiters / distance) * 100;
    return {
      consumption: parseFloat(consumption.toFixed(2)),
      distance: distance,
      liters: totalLiters,
      kmPerLiter: parseFloat((distance / totalLiters).toFixed(2))
    };
  },
  
  // Get average consumption for period
  getAverageConsumption(fuelEntries, days = null) {
    if (!fuelEntries || fuelEntries.length < 2) return null;
    
    // Filter by date if days specified
    let entries = [...fuelEntries];
    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      entries = entries.filter(e => new Date(e.date) >= cutoffDate);
    }
    
    // Sort by odometer
    entries.sort((a, b) => parseFloat(a.odometer) - parseFloat(b.odometer));
    
    // Calculate consumption for each full-to-full pair
    const consumptions = [];
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].fullTank) {
        const calc = Fuel.calculateConsumption(entries, i);
        if (calc) {
          consumptions.push(calc.consumption);
        }
      }
    }
    
    if (consumptions.length === 0) return null;
    
    const avg = consumptions.reduce((sum, c) => sum + c, 0) / consumptions.length;
    return parseFloat(avg.toFixed(2));
  },
  
  // Get fuel stats for car
  getStats(carId, fuelEntries) {
    const carFuel = fuelEntries.filter(f => f.carId === carId && !f.deletedAt);
    if (carFuel.length === 0) {
      return {
        totalSpent: 0,
        totalLiters: 0,
        avgPricePerLiter: 0,
        avgConsumption30: null,
        avgConsumption90: null,
        avgConsumptionAll: null,
        entriesCount: 0
      };
    }
    
    const totalSpent = carFuel.reduce((sum, f) => sum + parseFloat(f.totalCost || 0), 0);
    const totalLiters = carFuel.reduce((sum, f) => sum + parseFloat(f.liters || 0), 0);
    const avgPricePerLiter = totalLiters > 0 ? totalSpent / totalLiters : 0;
    
    // Sort by date for consumption calculation
    const sorted = [...carFuel].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return {
      totalSpent: parseFloat(totalSpent.toFixed(2)),
      totalLiters: parseFloat(totalLiters.toFixed(2)),
      avgPricePerLiter: parseFloat(avgPricePerLiter.toFixed(2)),
      avgConsumption30: Fuel.getAverageConsumption(sorted, 30),
      avgConsumption90: Fuel.getAverageConsumption(sorted, 90),
      avgConsumptionAll: Fuel.getAverageConsumption(sorted),
      entriesCount: carFuel.length
    };
  },
  
  // Format consumption for display
  formatConsumption(consumption, units = { fuel: 'L/100km' }) {
    if (!consumption) return '—';
    
    if (units.fuel === 'L/100km') {
      return `${consumption.toFixed(2)} L/100km`;
    } else {
      // km/L
      const kmPerL = 100 / consumption;
      return `${kmPerL.toFixed(2)} km/L`;
    }
  }
};

// Export to window for global access
window.Fuel = Fuel;

