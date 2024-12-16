let images = [];

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded');
  initializeThemeToggle();
  initializeModeToggle();
  initializeFilters();
  initializeVirtualScroll();
  initializeRefresh();
  initializeSettings();
  initializeDownloads();
  await loadImages();
});

async function loadImages() {
  try {
    showLoader(true);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Current tab:', tab);

    // Ensure content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['js/content.js']
      });
    } catch (error) {
      console.log('Content script already loaded');
    }

    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'getImages' 
    });

    if (response && response.images) {
      images = await processImages(response.images);
      displayImages(images);
      updateFilterCounts();
      updateImageCount(images.length);
    }
  } catch (error) {
    console.error('Error loading images:', error);
    showNotification('Please refresh the page and try again.', 'error');
  } finally {
    showLoader(false);
  }
}

async function processImages(rawImages) {
  const processedImages = [];
  for (const img of rawImages) {
    try {
      const response = await fetch(img.src);
      const blob = await response.blob();
      processedImages.push({
        ...img,
        size: blob.size,
        type: getImageType(img.src, blob.type),
        filename: getFilename(img.src)
      });
    } catch (error) {
      console.log('Skipping invalid image:', img.src);
    }
  }
  return processedImages;
}

function initializeThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const html = document.documentElement;
  
  chrome.storage.local.get('theme', ({ theme }) => {
    html.setAttribute('data-theme', theme || 'light');
  });

  themeToggle.addEventListener('click', () => {
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    chrome.storage.local.set({ theme: newTheme });
  });
}

function initializeModeToggle() {
  const modeToggle = document.getElementById('modeToggle');
  const proFeatures = document.getElementById('proFeatures');
  
  modeToggle.addEventListener('click', () => {
    modeToggle.classList.toggle('pro');
    proFeatures.classList.toggle('active');
    if (proFeatures.classList.contains('active')) {
      updateFilterCounts();
    }
  });
}

function displayImages(imagesToShow) {
  const grid = document.getElementById('imageGrid');
  if (!grid) return;

  grid.innerHTML = '';

  if (!imagesToShow || imagesToShow.length === 0) {
    grid.innerHTML = '<div class="no-images">No images found</div>';
    return;
  }

  imagesToShow.forEach(img => {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.dataset.src = img.src;
    
    card.innerHTML = `
      <div class="image-preview-wrapper">
        <input type="checkbox" class="checkbox">
        <img src="${img.src}" class="image-preview" alt="${img.alt || 'Image'}">
      </div>
      <div class="image-info">
        <div class="image-attributes">
          <span>Size: ${formatSize(img.size)}</span>
          <span>Type: ${img.type ? img.type.toUpperCase() : 'Unknown'}</span>
          <span>Dimensions: ${img.width}x${img.height}</span>
        </div>
        <div class="image-actions">
          <button class="btn btn-secondary open-btn">Open</button>
          <button class="btn btn-primary download-btn">Download</button>
        </div>
      </div>
    `;

    const openBtn = card.querySelector('.open-btn');
    const downloadBtn = card.querySelector('.download-btn');
    const checkbox = card.querySelector('.checkbox');

    openBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: img.src });
    });

    downloadBtn.addEventListener('click', () => {
      downloadSingleImage(img);
    });

    checkbox.addEventListener('change', updateSelectedCount);
    grid.appendChild(card);
  });
}

// I'll continue with the rest of popup.js in the next message

function updateFilterCounts() {
  updateTypeFilters();
  updateDimensionFilters();
}

function updateTypeFilters() {
  const typeFilters = document.getElementById('typeFilters');
  const types = {};
  
  // Count image types
  images.forEach(img => {
    const type = img.type.toUpperCase();
    types[type] = (types[type] || 0) + 1;
  });
  
  // Create filter chips
  typeFilters.innerHTML = `
    <div class="filter-chip active" data-type="all">
      All <span class="count">(${images.length})</span>
    </div>
    ${Object.entries(types).map(([type, count]) => `
      <div class="filter-chip" data-type="${type.toLowerCase()}">
        ${type} <span class="count">(${count})</span>
      </div>
    `).join('')}
  `;
  
  // Add click handlers
  typeFilters.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      typeFilters.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterImages();
    });
  });
}

function updateDimensionFilters() {
  const dimensions = images.reduce((acc, img) => ({
    minWidth: Math.min(acc.minWidth, img.width),
    maxWidth: Math.max(acc.maxWidth, img.width),
    minHeight: Math.min(acc.minHeight, img.height),
    maxHeight: Math.max(acc.maxHeight, img.height)
  }), { minWidth: Infinity, maxWidth: 0, minHeight: Infinity, maxHeight: 0 });

  const inputs = {
    minWidth: document.getElementById('minWidth'),
    maxWidth: document.getElementById('maxWidth'),
    minHeight: document.getElementById('minHeight'),
    maxHeight: document.getElementById('maxHeight')
  };

  if (inputs.minWidth) {
    inputs.minWidth.placeholder = `Min (${dimensions.minWidth}px)`;
    inputs.maxWidth.placeholder = `Max (${dimensions.maxWidth}px)`;
    inputs.minHeight.placeholder = `Min (${dimensions.minHeight}px)`;
    inputs.maxHeight.placeholder = `Max (${dimensions.maxHeight}px)`;
  }
}

function initializeFilters() {
  document.querySelectorAll('.filter-select').forEach(select => {
    select.addEventListener('change', filterImages);
  });

  const dimensionFilter = document.getElementById('dimensionFilter');
  const customDimensions = document.getElementById('customDimensions');

  dimensionFilter?.addEventListener('change', () => {
    if (customDimensions) {
      customDimensions.style.display = 
        dimensionFilter.value === 'custom' ? 'grid' : 'none';
      filterImages();
    }
  });

  ['minWidth', 'minHeight', 'maxWidth', 'maxHeight'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', filterImages);
  });
}

function filterImages() {
  const typeChip = document.querySelector('.filter-chip.active');
  const sizeFilter = document.getElementById('sizeFilter').value;
  const dimensionFilter = document.getElementById('dimensionFilter').value;
  
  const filteredImages = images.filter(img => {
    // Type filter
    if (typeChip?.dataset.type !== 'all' && 
        img.type.toLowerCase() !== typeChip?.dataset.type) return false;
    
    // Size filter
    const sizeKB = img.size / 1024;
    if (sizeFilter === 'small' && sizeKB >= 100) return false;
    if (sizeFilter === 'medium' && (sizeKB < 100 || sizeKB >= 1024)) return false;
    if (sizeFilter === 'large' && sizeKB < 1024) return false;
    
    // Dimension filter
    if (dimensionFilter === 'custom') {
      const minW = Number(document.getElementById('minWidth')?.value) || 0;
      const minH = Number(document.getElementById('minHeight')?.value) || 0;
      const maxW = Number(document.getElementById('maxWidth')?.value) || Infinity;
      const maxH = Number(document.getElementById('maxHeight')?.value) || Infinity;
      
      if (img.width < minW || img.height < minH) return false;
      if (img.width > maxW || img.height > maxH) return false;
    } else {
      if (dimensionFilter === 'small' && (img.width > 32 || img.height > 32)) return false;
      if (dimensionFilter === 'medium' && (img.width > 128 || img.height > 128)) return false;
      if (dimensionFilter === 'large' && (img.width <= 128 || img.height <= 128)) return false;
    }
    
    return true;
  });
  
  displayImages(filteredImages);
  updateImageCount(filteredImages.length);
}

// I'll continue with more functions in the next message...

function initializeDownloads() {
  document.getElementById('downloadAll')?.addEventListener('click', () => {
    downloadImages(images);
  });

  document.getElementById('downloadSelected')?.addEventListener('click', () => {
    const selectedImages = Array.from(document.querySelectorAll('.checkbox:checked'))
      .map(checkbox => {
        const card = checkbox.closest('.image-card');
        return images.find(img => img.src === card.dataset.src);
      })
      .filter(Boolean);

    if (selectedImages.length === 0) {
      showNotification('Please select at least one image', 'error');
      return;
    }

    downloadImages(selectedImages);
  });
}

async function downloadImages(imagesToDownload) {
  const { settings = {} } = await chrome.storage.local.get('settings');
  
  chrome.runtime.sendMessage({
    action: 'downloadImages',
    images: imagesToDownload,
    settings: settings
  }, response => {
    if (response?.success) {
      showNotification(`Downloading ${imagesToDownload.length} images`);
    } else {
      showNotification('Failed to start download', 'error');
    }
  });
}

function downloadSingleImage(img) {
  chrome.storage.local.get('settings', ({ settings = {} }) => {
    if (!settings.baseFileName) {
      // Download with original name
      chrome.downloads.download({
        url: img.src,
        saveAs: true
      });
    } else {
      // Download with custom name but preserve extension
      const extension = getFileExtension(img.src, img.type);
      const filename = `${settings.baseFileName}.${extension}`;
      const downloadPath = settings.downloadPath 
        ? `${settings.downloadPath}/${filename}` 
        : filename;

      chrome.downloads.download({
        url: img.src,
        filename: downloadPath,
        saveAs: true
      });
    }
  });

  showNotification('Image downloaded successfully');
}

function initializeSettings() {
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const closeSettings = document.getElementById('closeSettings');
  const saveSettings = document.getElementById('saveSettings');
  const useCustomNaming = document.getElementById('useCustomNaming');
  const baseFileNameInput = document.getElementById('baseFileName');

  if (settingsBtn && settingsPanel) {
    // Load saved settings
    chrome.storage.local.get('settings', ({ settings = {} }) => {
      if (useCustomNaming) {
        useCustomNaming.checked = Boolean(settings.baseFileName);
      }
      
      if (baseFileNameInput) {
        baseFileNameInput.value = settings.baseFileName || '';
        baseFileNameInput.disabled = !settings.baseFileName;
      }
      
      const downloadPathInput = document.getElementById('downloadPath');
      if (downloadPathInput) {
        downloadPathInput.value = settings.downloadPath || '';
      }
      
      const pathOption = settings.askForPath ? 'ask' : 'preset';
      const radioInput = document.querySelector(`input[value="${pathOption}"]`);
      if (radioInput) {
        radioInput.checked = true;
      }
    });

    // Toggle settings panel
    settingsBtn.addEventListener('click', () => {
      settingsPanel.style.display = 'flex';
      settingsPanel.classList.add('active');
    });

    closeSettings?.addEventListener('click', () => {
      settingsPanel.style.display = 'none';
      settingsPanel.classList.remove('active');
    });

    // Toggle custom naming input
    useCustomNaming?.addEventListener('change', (e) => {
      if (baseFileNameInput) {
        baseFileNameInput.disabled = !e.target.checked;
        baseFileNameInput.value = e.target.checked ? 'image' : '';
      }
    });

    // Save settings
    saveSettings?.addEventListener('click', () => {
      const settings = {
        baseFileName: useCustomNaming?.checked ? baseFileNameInput?.value || 'image' : '',
        downloadPath: document.getElementById('downloadPath')?.value?.trim() || '',
        askForPath: document.querySelector('input[name="pathOption"]:checked')?.value === 'ask'
      };

      chrome.storage.local.set({ settings }, () => {
        showNotification('Settings saved successfully');
        settingsPanel.style.display = 'none';
        settingsPanel.classList.remove('active');
      });
    });
  }
}

// Utility Functions
function showLoader(show) {
  const refreshButton = document.getElementById('refreshButton');
  if (refreshButton) {
    refreshButton.classList.toggle('loading', show);
  }
}

function getImageType(url, blobType) {
  const extension = url.split('.').pop().toLowerCase().split(/[#?]/)[0];
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) {
    return extension;
  }
  return blobType.split('/')[1];
}

function getFilename(url) {
  return url.split('/').pop().split(/[#?]/)[0] || `image_${Date.now()}.jpg`;
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showNotification(message, type = 'success') {
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(n => n.remove());

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function updateImageCount(count) {
  const imageCount = document.getElementById('imageCount');
  if (imageCount) {
    imageCount.textContent = count;
  }
}

function updateSelectedCount() {
  const selectedCount = document.querySelectorAll('.checkbox:checked').length;
  const downloadSelectedBtn = document.getElementById('downloadSelected');
  if (downloadSelectedBtn) {
    downloadSelectedBtn.textContent = selectedCount > 0 
      ? `Download Selected (${selectedCount})`
      : 'Download Selected';
  }
}

// Initialize Keyboard Shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    const checkboxes = document.querySelectorAll('.checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
    updateSelectedCount();
  }

  if (e.key === 'Escape') {
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel?.classList.contains('active')) {
      settingsPanel.style.display = 'none';
      settingsPanel.classList.remove('active');
    }
  }
});

function initializeVirtualScroll() {
  const container = document.querySelector('.image-grid-container');
  const scrollIndicator = document.getElementById('scrollIndicator');
  let isScrolling;

  if (!container || !scrollIndicator) return;

  container.addEventListener('scroll', () => {
    // Show scroll indicator
    scrollIndicator.classList.add('visible');
    
    // Hide indicator after scrolling stops
    clearTimeout(isScrolling);
    isScrolling = setTimeout(() => {
      scrollIndicator.classList.remove('visible');
    }, 1000);

    // Update scroll percentage
    const percentScrolled = (container.scrollTop / (container.scrollHeight - container.clientHeight)) * 100;
    if (percentScrolled > 1) {
      scrollIndicator.textContent = `${Math.round(percentScrolled)}% scrolled`;
    }
  });
}

function initializeRefresh() {
  const refreshButton = document.getElementById('refreshButton');
  
  if (!refreshButton) return;

  refreshButton.addEventListener('click', async () => {
    // Show loading state
    refreshButton.classList.add('loading');
    
    try {
      // Reload images
      await loadImages();
      showNotification(`Found ${images.length} images`);
    } catch (error) {
      console.error('Refresh failed:', error);
      showNotification('Failed to refresh images', 'error');
    } finally {
      // Remove loading state
      refreshButton.classList.remove('loading');
    }
  });
}