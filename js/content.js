// Handle messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getImages') {
    const images = getAllImages();
    sendResponse({ images: Array.from(images) });
  }
  return true;  // Keep the message channel open
});

function getAllImages() {
  const imageSet = new Set();

  // Get all img elements
  Array.from(document.getElementsByTagName('img')).forEach(img => {
    if (isValidImage(img)) {
      imageSet.add({
        src: img.src,
        alt: img.alt || '',
        width: img.width || img.naturalWidth,
        height: img.height || img.naturalHeight,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      });
    }

    // Process srcset if available
    if (img.srcset) {
      const srcSetUrls = parseSrcSet(img.srcset);
      srcSetUrls.forEach(url => {
        if (isValidImageUrl(url)) {
          imageSet.add({
            src: url,
            alt: img.alt || '',
            width: img.width || img.naturalWidth,
            height: img.height || img.naturalHeight,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight
          });
        }
      });
    }
  });

  // Get background images
  Array.from(document.getElementsByTagName('*')).forEach(element => {
    const style = window.getComputedStyle(element);
    const backgroundImage = style.backgroundImage;
    
    if (backgroundImage && backgroundImage !== 'none') {
      const urls = backgroundImage.match(/url\(['"]?(.*?)['"]?\)/g) || [];
      urls.forEach(url => {
        const cleanUrl = url.replace(/url\(['"]?|['"]?\)/g, '');
        if (isValidImageUrl(cleanUrl)) {
          imageSet.add({
            src: cleanUrl,
            alt: 'Background Image',
            width: element.offsetWidth || 0,
            height: element.offsetHeight || 0,
            type: 'background'
          });
        }
      });
    }
  });

  return imageSet;
}

function isValidImage(img) {
  return img.src && 
         img.src.startsWith('http') && 
         !img.src.includes('data:image') &&
         (img.width > 30 || img.naturalWidth > 30) &&
         (img.height > 30 || img.naturalHeight > 30);
}

function isValidImageUrl(url) {
  return url && 
         url.startsWith('http') && 
         !url.includes('data:image');
}

function parseSrcSet(srcset) {
  return srcset.split(',')
    .map(src => src.trim().split(' ')[0])
    .filter(Boolean);
}