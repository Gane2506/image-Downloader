// Set default settings when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    theme: 'light',
    mode: 'basic',
    settings: {
      downloadPath: '',
      baseFileName: '',
      askForPath: false,
      useCustomNaming: false
    }
  });
});

// Handle download messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadImages') {
    handleDownloads(request.images, request.settings)
      .then(count => sendResponse({ success: true, count }))
      .catch(error => sendResponse({ success: false, error }));
    return true;
  }
});

async function handleDownloads(images, settings) {
  let downloadCount = 0;

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    try {
      // Generate filename
      const extension = getFileExtension(img);
      let filename = settings?.useCustomNaming && settings?.baseFileName
        ? `${settings.baseFileName}_${i + 1}.${extension}`
        : `image_${i + 1}.${extension}`;

      // Add path if specified
      if (settings?.downloadPath) {
        filename = `${settings.downloadPath}/${filename}`;
      }

      // Start download
      await chrome.downloads.download({
        url: img.src,
        filename: filename,
        saveAs: settings?.askForPath && i === 0
      });

      downloadCount++;
    } catch (error) {
      console.error('Download failed:', error);
    }
  }

  return downloadCount;
}

function getFileExtension(img) {
  // Try to get extension from URL
  const urlExtension = img.src.split('.').pop().toLowerCase().split(/[#?]/)[0];
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(urlExtension)) {
    return urlExtension;
  }

  // Try to get from type
  if (img.type) {
    const typeExtension = img.type.split('/')[1];
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(typeExtension)) {
      return typeExtension;
    }
  }

  return 'jpg';
}

// Track download status
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === 'complete') {
    console.log('Download completed:', delta.id);
  }
});