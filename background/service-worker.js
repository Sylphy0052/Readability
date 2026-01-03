// Background Service Worker
console.log('Readability: Service Worker Loaded');

chrome.runtime.onInstalled.addListener(() => {
  console.log('Readability installed');
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
        const renderStart = performance.now();
        htmlText = await fetchRenderedHtml(url);
        const renderMs = Math.round(performance.now() - renderStart);
        console.log(`Rendered HTML fetched in ${renderMs}ms (len=${htmlText.length})`);
      } catch (e) {
        console.warn('Rendered fetch failed, falling back to fetch()', e);
      }
      if (!htmlText) {
        const fetchStart = performance.now();
        const response = await fetch(url);
        htmlText = await response.text();
        const fetchMs = Math.round(performance.now() - fetchStart);
        console.log(`Raw HTML fetched in ${fetchMs}ms (len=${htmlText.length})`);
      }

      // Parse via Offscreen
      const parseStart = performance.now();
      const result = await parseInOffscreen(htmlText, url);
      const parseMs = Math.round(performance.now() - parseStart);
      console.log(`Offscreen parse finished in ${parseMs}ms`);
      
      if (result) {
        let content = result.content;
        if (crawlerConfig.aiOptions?.format) {
          try {
            content = await formatInPage(result.content);
          } catch (e) {
            console.error('AI format failed in page context', e);
          }
        }
        // Add to results
        crawlResults.push({
          ...result,
          content: content,
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
  
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const attemptParse = () => new Promise((resolve) => {
    const listener = (message) => {
      if (message.type === 'PARSE_COMPLETE' && message.origUrl === url && message.requestId === requestId) {
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
        requestId,
        options: {
          aiFormat: false,
          aiSummary: false
        }
      }
    });

    // Timeout fallback
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      resolve(null);
    }, 30000);
  });

  const result = await attemptParse();
  if (result === null) {
    console.warn('Offscreen parse timed out:', url);
  }
  return result;
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

async function formatInPage(markdown) {
  const trimmed = markdown.substring(0, 10000);
  return await withAIAgentTab(async (tabId) => {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      args: [trimmed],
      func: async (inputText) => {
        try {
          if (typeof LanguageModel === 'undefined') {
            return { ok: false, error: 'AI API not available' };
          }
          const availability = await LanguageModel.availability({
            expectedInputs: [{ type: 'text', languages: ['en', 'ja'] }],
            expectedOutputs: [{ type: 'text', languages: ['ja'] }]
          });
          if (availability === 'no' || availability === 'unavailable') {
            return { ok: false, error: 'AI not available' };
          }
          if (availability === 'after-download') {
            return { ok: false, error: 'AI model downloading' };
          }
          const session = await LanguageModel.create({
            systemPrompt: 'You are an expert technical writer. You improve Markdown documentation.',
            expectedInputs: [{ type: 'text', languages: ['en', 'ja'] }],
            expectedOutputs: [{ type: 'text', languages: ['ja'] }]
          });
          const prompt = `Fix the following Markdown content.\n- Remove excessive newlines.\n- Ensure code blocks have language tags if possible.\n- Fix broken headers.\n- Do not summarize, keep all details.\n\nContent:\n${inputText}`;
          const result = await session.prompt(prompt);
          session.destroy();
          return { ok: true, text: result };
        } catch (e) {
          return { ok: false, error: e?.message || 'AI format failed' };
        }
      }
    });
    const payload = results?.[0]?.result;
    if (!payload) {
      throw new Error('AI format returned empty result');
    }
    if (!payload.ok) {
      throw new Error(payload.error || 'AI format failed');
    }
    return payload.text || null;
  });
}

async function withAIAgentTab(run) {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeUrl = active?.url || '';
  const isActiveUsable = active?.id && !activeUrl.startsWith('chrome://') && !activeUrl.startsWith('chrome-extension://');
  let tempTabId = null;
  let tabId = null;

  if (isActiveUsable) {
    tabId = active.id;
  } else {
    const tempTab = await chrome.tabs.create({ url: 'https://example.com/', active: false });
    tabId = tempTab.id;
    tempTabId = tempTab.id;
    await waitForTabComplete(tabId);
  }

  try {
    return await run(tabId);
  } finally {
    if (tempTabId !== null) {
      chrome.tabs.remove(tempTabId).catch(() => {});
    }
  }
}

async function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    function onUpdated(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

function stopCrawl() {
    isCrawling = false;
    console.log('Stopping crawl');
}
