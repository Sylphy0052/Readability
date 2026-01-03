/**
 * offscreen/offscreen.js
 * Handles parsing of HTML strings using Readability and Turndown in a background DOM context.
 */

chrome.runtime.onMessage.addListener(handleMessage);

function handleMessage(message, sender, sendResponse) {
  if (message.type === 'PARSE_HTML') {
    parseHtml(message.payload);
  }
  // We respond via chrome.runtime.sendMessage, not sendResponse.
  return false;
}

async function parseHtml({ html, url, options, requestId }) {
  try {
    // Create a DOM from the HTML string
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    if (url) {
      const base = doc.createElement('base');
      base.href = url;
      doc.head.append(base);
    }

    const article = runReadability(doc);
    if (!article) {
      sendResult({ error: 'Readability failed' }, url, requestId);
      return;
    }

    // 2. Run Turndown
    let markdown = runTurndown(article.content);

    // 3. AI Processing (if configured)
    if (options?.aiFormat) {
      markdown = await AIHandler.formatMarkdown(markdown);
    }

    // 4. Summarize (if configured)
    let summary = null;
    if (options?.aiSummary) {
      summary = await AIHandler.summarize(markdown);
      if (!summary) {
        console.error('AI summary unavailable.');
        summary = createFallbackSummary(markdown);
        if (!summary) {
          console.warn('Fallback summary could not be generated.');
        }
      }
    }

    // 5. Extract Links
    const links = extractLinks(doc, article.content);

    sendResult({
      title: article.title,
      url: url,
      content: markdown,
      summary: summary,
      excerpt: article.excerpt,
      links: links
    }, url, requestId);
  } catch (error) {
    console.error('Offscreen parse failed', error);
    sendResult({ error: error?.message || 'Offscreen parse failed' }, url, requestId);
  }
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

function createFallbackSummary(markdown) {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/#+\s*/g, '')
    .replace(/>\s*/g, '')
    .trim();
  if (!plain) return null;
  const sentences = plain.split(/(?<=[。.!?])\s+/).filter(Boolean);
  const picks = sentences.slice(0, 5);
  return picks.map((s) => `- ${s.trim()}`).join('\n');
}

function sendResult(data, origUrl, requestId) {
  chrome.runtime.sendMessage({
    type: 'PARSE_COMPLETE',
    payload: data,
    origUrl: origUrl,
    requestId: requestId
  });
}

// Update extractor.js to support passing document
// Redefining here temporarily if needed, but better to update the shared file.
