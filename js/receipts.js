// Receipts/Attachments module
// Handles image upload, compression, storage, and viewing

const Receipts = {
  // Max image size (long side in pixels)
  MAX_SIZE: 1280,
  // JPEG quality
  JPEG_QUALITY: 0.75,
  // Max images per entry
  MAX_IMAGES: 5,
  
  // Compress and resize image
  compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > this.MAX_SIZE) {
              height = (height * this.MAX_SIZE) / width;
              width = this.MAX_SIZE;
            }
          } else {
            if (height > this.MAX_SIZE) {
              width = (width * this.MAX_SIZE) / height;
              height = this.MAX_SIZE;
            }
          }
          
          // Create canvas and compress
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to JPEG data URL
          const dataUrl = canvas.toDataURL('image/jpeg', this.JPEG_QUALITY);
          
          resolve({
            dataUrl,
            originalSize: file.size,
            compressedSize: this.estimateSize(dataUrl),
            width,
            height
          });
        };
        img.onerror = () => reject(new Error('Ошибка загрузки изображения'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.readAsDataURL(file);
    });
  },
  
  // Estimate size of data URL in bytes
  estimateSize(dataUrl) {
    // Base64 encoding adds ~33% overhead
    const base64Length = dataUrl.length - dataUrl.indexOf(',') - 1;
    return Math.ceil(base64Length * 0.75);
  },
  
  // Calculate total storage usage
  calculateStorageUsage(state) {
    let totalBytes = 0;
    let imageCount = 0;
    
    // Check expenses
    (state.expenses || []).forEach(exp => {
      if (exp.receipts && Array.isArray(exp.receipts)) {
        exp.receipts.forEach(receipt => {
          if (receipt.dataUrl) {
            totalBytes += this.estimateSize(receipt.dataUrl);
            imageCount++;
          }
        });
      }
    });
    
    // Check service records
    (state.service || []).forEach(service => {
      if (service.receipts && Array.isArray(service.receipts)) {
        service.receipts.forEach(receipt => {
          if (receipt.dataUrl) {
            totalBytes += this.estimateSize(receipt.dataUrl);
            imageCount++;
          }
        });
      }
    });
    
    return {
      totalBytes,
      imageCount,
      totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
      formatted: this.formatBytes(totalBytes)
    };
  },
  
  // Format bytes to human readable
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  
  // Add receipt to entry
  addReceipt(entry, receiptData) {
    if (!entry.receipts) {
      entry.receipts = [];
    }
    
    if (entry.receipts.length >= this.MAX_IMAGES) {
      throw new Error(`Максимум ${this.MAX_IMAGES} изображений на запись`);
    }
    
    const receipt = {
      id: `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      dataUrl: receiptData.dataUrl,
      originalSize: receiptData.originalSize,
      compressedSize: receiptData.compressedSize,
      width: receiptData.width,
      height: receiptData.height,
      addedAt: new Date().toISOString()
    };
    
    entry.receipts.push(receipt);
    return receipt;
  },
  
  // Remove receipt from entry
  removeReceipt(entry, receiptId) {
    if (!entry.receipts) return false;
    const index = entry.receipts.findIndex(r => r.id === receiptId);
    if (index >= 0) {
      entry.receipts.splice(index, 1);
      return true;
    }
    return false;
  },
  
  // Get receipt by ID
  getReceipt(entry, receiptId) {
    if (!entry.receipts) return null;
    return entry.receipts.find(r => r.id === receiptId) || null;
  }
};

// Make globally available
window.Receipts = Receipts;

