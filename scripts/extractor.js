/**
 * scripts/extractor.js
 * Wrapper around Readability.js to extract main content.
 */

function runReadability(docArg) {
  if (typeof Readability === 'undefined') {
    console.error('AI Markdown Crawler: Readability is undefined.');
    return null;
  }

  try {
    // Clone document to avoid modifying the actual page
    // If docArg is provided (e.g. from offscreen), use it. Otherwise use global document.
    const docToUse = docArg || document;
    const documentClone = docToUse.cloneNode(true);
    const reader = new Readability(documentClone, {
      keepClasses: false,
      debug: false
    });
    
    const article = reader.parse();
    return article;
  } catch (error) {
    console.error('AI Markdown Crawler: Readability failed', error);
    return null;
  }
}
