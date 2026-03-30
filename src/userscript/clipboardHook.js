function isImageMimeType(type) {
  return typeof type === 'string' && /^image\//i.test(type);
}

async function buildClipboardReplacementItems(items, replacementBlob, ClipboardItemClass) {
  const replacementItems = [];
  let replacedAny = false;

  for (const item of Array.from(items || [])) {
    const types = Array.isArray(item?.types) ? item.types.filter(Boolean) : [];
    if (!types.some(isImageMimeType) || typeof ClipboardItemClass !== 'function') {
      replacementItems.push(item);
      continue;
    }

    const replacementData = {};
    for (const type of types) {
      if (isImageMimeType(type)) {
        continue;
      }
      if (typeof item.getType === 'function') {
        replacementData[type] = item.getType(type);
      }
    }

    replacementData[replacementBlob.type || 'image/png'] = replacementBlob;
    replacementItems.push(new ClipboardItemClass(replacementData));
    replacedAny = true;
  }

  return replacedAny ? replacementItems : items;
}

async function resolveProcessedClipboardBlob({
  intentMetadata,
  resolveImageElement,
  fetchBlobDirect
}) {
  let imageElement = intentMetadata?.imageElement || null;
  if (
    (!imageElement?.dataset?.gwrWatermarkObjectUrl)
    && typeof resolveImageElement === 'function'
  ) {
    imageElement = resolveImageElement(intentMetadata) || imageElement;
  }

  const objectUrl = typeof imageElement?.dataset?.gwrWatermarkObjectUrl === 'string'
    ? imageElement.dataset.gwrWatermarkObjectUrl.trim()
    : '';
  if (!objectUrl || typeof fetchBlobDirect !== 'function') {
    return null;
  }

  return fetchBlobDirect(objectUrl);
}

export function installGeminiClipboardImageHook(targetWindow, {
  getIntentMetadata = () => null,
  resolveImageElement = null,
  fetchBlobDirect = async (url) => {
    const response = await fetch(url);
    return response.blob();
  },
  logger = console
} = {}) {
  const clipboard = targetWindow?.navigator?.clipboard;
  if (!clipboard || typeof clipboard.write !== 'function') {
    return () => {};
  }

  const originalWrite = clipboard.write.bind(clipboard);
  const ClipboardItemClass = targetWindow?.ClipboardItem || globalThis.ClipboardItem;

  const hookedWrite = async function gwrClipboardWriteHook(items) {
    try {
      const intentMetadata = typeof getIntentMetadata === 'function'
        ? getIntentMetadata()
        : null;
      const processedBlob = await resolveProcessedClipboardBlob({
        intentMetadata,
        resolveImageElement,
        fetchBlobDirect
      });
      if (!processedBlob) {
        return originalWrite(items);
      }

      const replacementItems = await buildClipboardReplacementItems(
        items,
        processedBlob,
        ClipboardItemClass
      );
      return originalWrite(replacementItems);
    } catch (error) {
      logger?.warn?.('[Gemini Watermark Remover] Clipboard image hook failed, falling back:', error);
      return originalWrite(items);
    }
  };
  clipboard.write = hookedWrite;

  return () => {
    if (clipboard.write === hookedWrite) {
      clipboard.write = originalWrite;
    }
  };
}
