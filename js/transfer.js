// Transfer Car Module (MVP)

function initTransferScreen() {
  const cars = state && state.cars ? state.cars.filter(c => !c.deletedAt) : [];
  const listEl = document.getElementById('transfer-car-list');
  if (!listEl) return;

  const selected = new Set();

  // Render car checkboxes
  if (cars.length === 0) {
    listEl.innerHTML = '<div class="ios-cell"><div class="ios-cell-content"><div class="ios-cell-title" style="color:var(--text-secondary);font-style:italic;">Нет добавленных авто</div></div></div>';
  } else {
    listEl.innerHTML = '';
    cars.forEach(c => {
      const cell = document.createElement('div');
      cell.className = 'ios-cell';
      cell.style.cursor = 'pointer';
      cell.innerHTML = `
        <div class="ios-cell-icon ios-cell-icon-car" style="background:var(--accent-tint);color:var(--accent);">
          <i data-lucide="car"></i>
        </div>
        <div class="ios-cell-content">
          <div class="ios-cell-title">${escapeHtml(c.brand + ' ' + c.model)}</div>
          <div class="ios-cell-subtitle">${c.year} · ${escapeHtml(c.fuel || '')}</div>
        </div>
        <div class="transfer-car-checkbox" id="chk-${c.id}"></div>
      `;
      cell.addEventListener('click', () => {
        const chk = document.getElementById('chk-' + c.id);
        if (selected.has(c.id)) {
          selected.delete(c.id);
          chk.classList.remove('checked');
          chk.innerHTML = '';
        } else {
          selected.add(c.id);
          chk.classList.add('checked');
          chk.innerHTML = '<i data-lucide="check"></i>';
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        updateTransferStep2(selected);
      });
      listEl.appendChild(cell);
    });
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Select all
  const selectAllBtn = document.getElementById('transfer-select-all-btn');
  if (selectAllBtn) {
    selectAllBtn.onclick = () => {
      cars.forEach(c => {
        selected.add(c.id);
        const chk = document.getElementById('chk-' + c.id);
        if (chk) { chk.classList.add('checked'); chk.innerHTML = '<i data-lucide="check"></i>'; }
      });
      if (typeof lucide !== 'undefined') lucide.createIcons();
      updateTransferStep2(selected);
    };
  }

  // Method buttons
  ['link', 'qr', 'contact', 'code'].forEach(method => {
    const btn = document.getElementById('method-' + method);
    if (btn) {
      btn.onclick = () => {
        if (selected.size === 0) { showToast('Выберите хотя бы одно авто'); return; }
        document.querySelectorAll('.transfer-method-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        showTransferResult(method);
      };
    }
  });

  // Reset
  const resetBtn = document.getElementById('transfer-reset-btn');
  if (resetBtn) resetBtn.onclick = resetTransfer;

  // Copy link
  const copyLinkBtn = document.getElementById('transfer-copy-link-btn');
  if (copyLinkBtn) {
    copyLinkBtn.onclick = () => {
      const val = document.getElementById('transfer-link-value')?.textContent;
      if (val) navigator.clipboard?.writeText(val).then(() => showToast('Ссылка скопирована'));
    };
  }

  // Share link
  const shareLinkBtn = document.getElementById('transfer-share-link-btn');
  if (shareLinkBtn) {
    shareLinkBtn.onclick = () => {
      const val = document.getElementById('transfer-link-value')?.textContent;
      if (navigator.share && val) navigator.share({ url: val, title: 'Передача авто AutoDiary' });
    };
  }

  // Copy code
  const copyCodeBtn = document.getElementById('transfer-copy-code-btn');
  if (copyCodeBtn) {
    copyCodeBtn.onclick = () => {
      const val = document.getElementById('transfer-code-value')?.textContent;
      if (val) navigator.clipboard?.writeText(val).then(() => showToast('Код скопирован: ' + val));
    };
  }

  // Share QR
  const shareQrBtn = document.getElementById('transfer-share-qr-btn');
  if (shareQrBtn) {
    shareQrBtn.onclick = () => {
      const code = document.getElementById('transfer-qr-code-value')?.textContent;
      if (navigator.share && code) navigator.share({ text: 'Код передачи авто: ' + code, title: 'AutoDiary' });
    };
  }

  // Send to contact
  const sendContactBtn = document.getElementById('transfer-send-contact-btn');
  if (sendContactBtn) {
    sendContactBtn.onclick = () => {
      const val = document.getElementById('transfer-contact-input')?.value?.trim();
      if (!val) { showToast('Введите email или телефон'); return; }
      showToast('Приглашение отправлено на ' + val);
      document.getElementById('transfer-contact-input').value = '';
    };
  }

  // Receive code
  const receiveBtn = document.getElementById('transfer-receive-btn');
  if (receiveBtn) {
    receiveBtn.onclick = () => {
      const code = document.getElementById('transfer-receive-code')?.value?.trim().toUpperCase();
      if (!code || code.length < 6) { showToast('Введите корректный код'); return; }
      showTransferAcceptBanner(code);
    };
  }

  // Accept
  const acceptBtn = document.getElementById('transfer-accept-btn');
  if (acceptBtn) {
    acceptBtn.onclick = () => {
      document.getElementById('transfer-accept-banner').style.display = 'none';
      document.getElementById('transfer-receive-code').value = '';
      showToast('Авто успешно добавлено в ваш гараж');
    };
  }

  // Decline
  const declineBtn = document.getElementById('transfer-decline-btn');
  if (declineBtn) {
    declineBtn.onclick = () => {
      document.getElementById('transfer-accept-banner').style.display = 'none';
      document.getElementById('transfer-receive-code').value = '';
    };
  }
}

function updateTransferStep2(selected) {
  const step2 = document.getElementById('transfer-step-2');
  if (step2) step2.style.opacity = selected.size > 0 ? '1' : '0.4';
}

function generateTransferToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let t = '';
  for (let i = 0; i < 8; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

function showTransferResult(method) {
  const step3 = document.getElementById('transfer-step-3');
  if (!step3) return;
  step3.style.display = 'block';

  ['link', 'qr', 'contact', 'code'].forEach(m => {
    const el = document.getElementById('transfer-result-' + m);
    if (el) el.style.display = 'none';
  });

  const token = generateTransferToken();
  const label = document.getElementById('transfer-result-label');

  if (method === 'link') {
    if (label) label.textContent = 'Ссылка для передачи';
    const url = 'https://autodiary.app/transfer?token=' + token;
    const el = document.getElementById('transfer-link-value');
    if (el) el.textContent = url;
    document.getElementById('transfer-result-link').style.display = 'block';

  } else if (method === 'qr') {
    if (label) label.textContent = 'QR-код передачи';
    const url = 'https://autodiary.app/transfer?token=' + token;
    const img = document.getElementById('transfer-qr-img');
    if (img) img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(url) + '&bgcolor=ffffff&color=000000&margin=2';
    const codeEl = document.getElementById('transfer-qr-code-value');
    if (codeEl) codeEl.textContent = token;
    document.getElementById('transfer-result-qr').style.display = 'block';

  } else if (method === 'contact') {
    if (label) label.textContent = 'Отправить приглашение';
    document.getElementById('transfer-result-contact').style.display = 'block';

  } else if (method === 'code') {
    if (label) label.textContent = 'Код передачи';
    const codeEl = document.getElementById('transfer-code-value');
    if (codeEl) codeEl.textContent = token;
    document.getElementById('transfer-result-code').style.display = 'block';
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
  step3.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showTransferAcceptBanner(code) {
  const banner = document.getElementById('transfer-accept-banner');
  const desc = document.getElementById('transfer-accept-desc');
  if (desc) desc.textContent = 'Получен запрос на передачу авто (код: ' + code + '). Принять автомобиль в свой гараж?';
  if (banner) {
    banner.style.display = 'block';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function resetTransfer() {
  const step3 = document.getElementById('transfer-step-3');
  if (step3) step3.style.display = 'none';
  document.querySelectorAll('.transfer-method-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.transfer-car-checkbox').forEach(chk => {
    chk.classList.remove('checked');
    chk.innerHTML = '';
  });
}

// Hook: re-init when navigating to transfer screen
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-goto="screen-transfer-car"]')) {
    setTimeout(initTransferScreen, 60);
  }
});

// ============================================
// Service Quick Chips
// ============================================

function initServiceQuickChips() {
  const chips = document.querySelectorAll('.service-chip');
  if (!chips.length) return;

  chips.forEach(chip => {
    // Remove old listeners by cloning
    const newChip = chip.cloneNode(true);
    chip.parentNode.replaceChild(newChip, chip);
  });

  document.querySelectorAll('.service-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const wasSelected = chip.classList.contains('selected');

      // Deselect all
      document.querySelectorAll('.service-chip').forEach(c => c.classList.remove('selected'));

      if (!wasSelected) {
        chip.classList.add('selected');
        applyServiceChip(chip.dataset.value, chip.dataset.label);
      } else {
        // Deselected — clear field
        const typeEl = document.getElementById('service-type');
        if (typeEl) typeEl.value = '';
        const otherField = document.getElementById('service-other-field');
        if (otherField) otherField.style.display = 'none';
      }
    });
  });
}

function applyServiceChip(value, label) {
  const typeEl = document.getElementById('service-type');
  const otherField = document.getElementById('service-other-field');
  const typeLabelEl = document.getElementById('service-type-label');

  if (!typeEl) return;

  // Map chip values to select options
  const valueMap = {
    'oil':          'oil',
    'oilFilter':    'oilFilter',
    'airFilter':    'airFilter',
    'cabinFilter':  'cabinFilter',
    'fuelFilter':   'fuelFilter',
    'brakePads':    'brakes',
    'brakePadsRear':'brakes',
    'brakeDiscs':   'brakes',
    'sparkPlugs':   'sparkPlugs'
  };

  const selectValue = valueMap[value] || 'other';
  typeEl.value = selectValue;

  if (selectValue === 'other' || selectValue === 'brakes') {
    // For brakes subtypes — use "other" with label prefilled
    typeEl.value = 'other';
    if (otherField) otherField.style.display = 'flex';
    if (typeLabelEl) typeLabelEl.value = label;
  } else {
    if (otherField) otherField.style.display = 'none';
    if (typeLabelEl) typeLabelEl.value = '';
  }

  // Clear multi-select and update visual display
  window.selectedServiceTypes = [];
  if (typeof updateServiceTypeDisplay === 'function') updateServiceTypeDisplay();
}
