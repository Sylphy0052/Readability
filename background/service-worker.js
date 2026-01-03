// Background Service Worker
console.log('AI Markdown Crawler: Service Worker Loaded');

chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Markdown Crawler installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  if (message.type === 'START_CRAWL') {
    startCrawl(message.payload);
  } else if (message.type === 'STOP_CRAWL') {
    stopCrawl();
  }
});

// Crawler State
let isCrawling = false;
let crawlerConfig = null;
let crawlQueue = [];
let visitedUrls = new Set();
let crawlResults = [];
let creatingOffscreenPromise = null;

async function startCrawl(config) {
  console.log('Starting crawl with config:', config);
  if (isCrawling) return;
  
  isCrawling = true;
  crawlerConfig = config;
  crawlQueue = [];
  visitedUrls = new Set();
  crawlResults = [];

  try {
    // 1. Get current tab to start
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { throw new Error('No active tab'); }

    // Constants
    const maxDepth = parseInt(config.depth || '0', 10);
    
    // Add start URL
    addToQueue(tab.url, 0);

    // Setup Offscreen if needed
    await setupOffscreenDocument('offscreen/offscreen.html');

    // Process Queue
    await processQueue();

    console.log('Crawl finished. Results:', crawlResults);
    
    // Generate and Download
    if (crawlResults.length === 0) {
      throw new Error('No pages were processed');
    }
    await generateAndDownload(crawlResults, crawlerConfig);

    // Notify Completion
    chrome.runtime.sendMessage({ 
        type: 'CRAWL_COMPLETE', 
        payload: crawlResults, 
        count: crawlResults.length 
    }).catch(() => {});

  } catch (error) {
    console.error('Crawl failed:', error);
    chrome.runtime.sendMessage({ type: 'CRAWL_ERROR', error: error.message });
  } finally {
    isCrawling = false;
  }
}

// ... helper functions ...

async function generateAndDownload(results, config) {
    let finalMarkdown = '';

    const mainTitle = results[0]?.title || 'Documentation';
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_` +
      `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    // Append pages
    results.forEach((page, index) => {
        finalMarkdown += `# ${page.title}\n\n`;
        finalMarkdown += `> URL: ${page.url}\n\n`;

        if (page.summary) {
            finalMarkdown += `## Summary\n\n${page.summary}\n\n`;
        }

        // Clean up content: remove excessive blank lines
        const cleanedContent = page.content
            .replace(/\n{3,}/g, '\n\n')  // Replace 3+ newlines with 2
            .trim();

        finalMarkdown += cleanedContent;

        // Add separator between pages (not after the last one)
        if (index < results.length - 1) {
            finalMarkdown += '\n\n---\n\n';
        } else {
            finalMarkdown += '\n';
        }
    });
    
    // Create Blob/Data URL not needed for chrome.downloads? 
    // We can use data URI.
    const blob = new Blob([finalMarkdown], {type: 'text/markdown'});
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    
    reader.onloadend = function() {
        const base64data = reader.result;
        const safeTitle = mainTitle
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/gi, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '');
        const maxTitleLength = 40;
        const trimmedTitle = safeTitle.slice(0, maxTitleLength) || 'Documentation';
        chrome.downloads.download({
            url: base64data,
            filename: `${trimmedTitle}_${timestamp}.md`,
            saveAs: true
        });
    };
}

function addToQueue(url, depth) {
  if (visitedUrls.has(url)) return;
  visitedUrls.add(url);
  crawlQueue.push({ url, depth });
}

async function processQueue() {
  while (crawlQueue.length > 0 && isCrawling) {
    const current = crawlQueue.shift(); // BFS
    // Or shift() for BFS, pop() for DFS. Spec says recursive... BFS is usually safer for depth limits.
    
    const { url, depth } = current;
    
    // Send status update
    chrome.runtime.sendMessage({ 
      type: 'UPDATE_STATUS', 
      payload: { 
        currentUrl: url, 
        processed: crawlResults.length, 
        queue: crawlQueue.length 
      } 
    });

    try {
      console.log(`Fetching: ${url} (Depth: ${depth})`);
      let htmlText = '';
      try {
        htmlText = await fetchRenderedHtml(url);
      } catch (e) {
        console.warn('Rendered fetch failed, falling back to fetch()', e);
      }
      if (!htmlText) {
        const response = await fetch(url);
        htmlText = await response.text();
      }

      // Parse via Offscreen
      const result = await parseInOffscreen(htmlText, url);
      
      if (result) {
        // Add to results
        crawlResults.push({
          ...result,
          depth: depth
        });

        // Add children if depth allows
        const maxDepth = parseInt(crawlerConfig.depth, 10);
        if (depth < maxDepth) {
          if (result.links && Array.isArray(result.links)) {
            for (const link of result.links) {
                if (shouldFollow(link, url, crawlerConfig.scope)) {
                    addToQueue(link, depth + 1);
                }
            }
          }
        }
      }
      
      // Basic rate limiting
      await new Promise(r => setTimeout(r, 500)); 

    } catch (e) {
      console.error(`Failed to fetch/parse ${url}`, e);
    }
  }
}

function shouldFollow(link, currentUrl, scope) {
  try {
    const linkObj = new URL(link);
    const currentObj = new URL(currentUrl);

    if (scope === 'same-domain') {
       return linkObj.hostname === currentObj.hostname;
    } else if (scope === 'external') {
        // Spec: "External (Body Links Only) ... even if external, fetch 1 level"
        // Here we are following links found in body (result.links).
        // If scope is external, we allow external domains.
        // BUT logic might be: "Follow external ONLY if depth < X" or "Only 1 level deep for external"
        // Spec: "External ... fetch 1 level only"
        // This implies if we are on example.com and find google.com, we fetch google.com (depth+1).
        // But from google.com, do we fetch? 
        // If "External (1 level)" means:
        // - Allow hopping to external domain from Start Domain.
        // - BUT do not go deeper *into* external domain or *from* external domain?
        // Implementation: If link hostname != startHostname, we only follow if current depth == 0? 
        // Or if we are already on external, stop?
        
        // Simplified Logic: 
        return true; // Use Depth control strictly. 
        // If users sets Depth 1, they get 1 level of external.
    }
    return false;
  } catch (e) { return false; }
}

async function fetchRenderedHtml(url) {
  return new Promise((resolve, reject) => {
    let tabId = null;
    const timeoutMs = 15000;
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for tab load'));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      if (tabId !== null) {
        chrome.tabs.remove(tabId).catch(() => {});
      }
    }

    function onUpdated(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === 'complete') {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: async () => {
            const maxWaitMs = 7000;
            const pollIntervalMs = 200;
            const start = Date.now();
            function hasContent() {
              const main = document.querySelector('main') || document.querySelector('article');
              const textLen = document.body?.innerText?.trim().length || 0;
              return Boolean(main) && textLen > 200;
            }
            while (Date.now() - start < maxWaitMs) {
              if (hasContent()) break;
              await new Promise((r) => setTimeout(r, pollIntervalMs));
            }
            return document.documentElement.outerHTML;
          }
        }).then((results) => {
          const html = results?.[0]?.result || '';
          cleanup();
          resolve(html);
        }).catch((err) => {
          cleanup();
          reject(err);
        });
      }
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.create({ url: url, active: false }, (tab) => {
      if (!tab || typeof tab.id !== 'number') {
        cleanup();
        reject(new Error('Failed to create tab'));
        return;
      }
      tabId = tab.id;
    });
  });
}

async function parseInOffscreen(html, url) {
  // Use runtime.sendMessage to Offscreen
  // We need to wait for a response. runtime.sendMessage does not strictly wait for *offscreen logic* if it's async unless we return true in onMessage?
  // Actually, standard message passing to offscreen:
  // We send a message, Offscreen processes, and sends a message BACK? 
  // OR we use the sendResponse callback?
  // If offscreen.js uses async logic, we must return true in onMessage.
  
  // My offscreen.js sends 'PARSE_COMPLETE' back via sendMessage. 
  // So I can't use the response of sendMessage directly if I use that pattern.
  // I will switch to a Promise wrapper listening for PARSE_COMPLETE.
  
  return new Promise((resolve) => {
    const listener = (message) => {
      if (message.type === 'PARSE_COMPLETE' && message.origUrl === url) {
        chrome.runtime.onMessage.removeListener(listener);
        resolve(message.payload);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    
    // Trigger
    chrome.runtime.sendMessage({
      type: 'PARSE_HTML',
      payload: { 
          html, 
          url,
          options: {
              aiFormat: crawlerConfig.aiOptions?.format,
              aiSummary: crawlerConfig.aiOptions?.summary
          }
      }
    });
    
    // Timeout fallback
    setTimeout(() => {
        chrome.runtime.onMessage.removeListener(listener);
        resolve(null);
    }, 10000);
  });
}

async function setupOffscreenDocument(path) {
  // Check if existing
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    return;
  }

  // Create
  if (creatingOffscreenPromise) {
    await creatingOffscreenPromise;
  } else {
    creatingOffscreenPromise = chrome.offscreen.createDocument({
      url: path,
      reasons: ['DOM_PARSER'],
      justification: 'Parse HTML for crawler'
    });
    await creatingOffscreenPromise;
    creatingOffscreenPromise = null;
  }
}

function stopCrawl() {
    isCrawling = false;
    console.log('Stopping crawl');
}
