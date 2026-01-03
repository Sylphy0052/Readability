/**
 * offscreen/offscreen.js
 * Handles parsing of HTML strings using Readability and Turndown in a background DOM context.
 */

chrome.runtime.onMessage.addListener(handleMessage);

function handleMessage(message, sender, sendResponse) {
  if (message.type === 'PARSE_HTML') {
    parseHtml(message.payload);
  }
  // Return true to indicate we might respond asynchronously (though we use sendMessage back)
  return true;
}

async function parseHtml({ html, url, options }) {
  // Create a DOM from the HTML string
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Set base URI if possible (complex in parsed doc, but we can resolve links manually)
  // Readability needs a document object
  // We need to inject the <base> tag to handle relative links correctly?
  // Or just rely on URL resolution manually.
  
  if (url) {
    const base = doc.createElement('base');
    base.href = url;
    doc.head.append(base);
  }

  // Use our extractor wrapper
  // We need to make sure extractor.js functions are available here.
  // Since we loaded them in script tags in offscreen.html, they should be global.
  
  // 1. Run Readability
  // Note: runReadability in extractor.js expects 'document' global or we should pass doc.
  // My extractor.js uses 'document.cloneNode'. 
  // I should update extractor.js or modify how I call it.
  
  // Quick fix: Replace global document temporarily? No, that's bad.
  // Best: Update extractor.js to accept a document argument.
  
  // Let's assume I will update extractor.js to take an optional document argument.
  const article = runReadability(doc); 
  
  if (!article) {
    sendResult({ error: 'Readability failed' }, url);
    return;
  }

  // 2. Run Turndown
  let markdown = runTurndown(article.content);

  // 3. AI Processing (if configured)
  // We assume AIHandler is loaded.
  // config should be passed in message.payload.options
  const options = message.payload.options || {};
  
  if (options.aiFormat) {
     markdown = await AIHandler.formatMarkdown(markdown);
  }
  
  // 4. Summarize (if configured)
  let summary = null;
  if (options.aiSummary) {
     summary = await AIHandler.summarize(markdown);
  }

  // 5. Extract Links
  // We need to find links in the *raw* doc or the *article* content?
  // Requirement: "Scope selection... links found in Main Content Area" (for External)
  const links = extractLinks(doc, article.content);

  sendResult({
    title: article.title,
    url: url,
    content: markdown,
    summary: summary,
    excerpt: article.excerpt,
    links: links
  }, url);
}

function extractLinks(doc, contentHtml) {
  // Extract links from the processed content to ensure we only get relevant links
  const tempSpan = document.createElement('span');
  tempSpan.innerHTML = contentHtml;
  
  const anchorTags = tempSpan.getElementsByTagName('a');
  const links = [];
  
  for (let a of anchorTags) {
    if (a.href) {
        links.push(a.href);
    }
  }
  
  // Also extracting from full doc if needed? 
  // Spec says: 
  // - "Same Domain": Link tracking (usually all links on page? or just content?)
  // - "External": "Body Links Only"
  // Let's Stick to content links for arguably higher quality crawling.
  
  return [...new Set(links)]; // Dedupe
}

function sendResult(data, origUrl) {
  chrome.runtime.sendMessage({
    type: 'PARSE_COMPLETE',
    payload: data,
    origUrl: origUrl
  });
}

// Update extractor.js to support passing document
// Redefining here temporarily if needed, but better to update the shared file.
