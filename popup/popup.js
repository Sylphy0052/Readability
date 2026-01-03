async function checkAIAvailability() {
    const logMessage = document.getElementById('log-message');

    try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            logMessage.textContent = 'Navigate to a webpage to check AI';
            logMessage.style.color = 'orange';
            return;
        }

        // Inject script to check AI availability in page context
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async () => {
                if (!self.ai || !self.ai.languageModel) {
                    return { available: false, status: 'not_found' };
                }
                try {
                    const caps = await self.ai.languageModel.capabilities();
                    if (caps.available === 'readily') {
                        return { available: true, status: 'ready' };
                    } else if (caps.available === 'after-download') {
                        return { available: false, status: 'downloading' };
                    } else {
                        return { available: false, status: 'not_available' };
                    }
                } catch (e) {
                    return { available: false, status: 'error', message: e.message };
                }
            }
        });

        const result = results[0]?.result;

        if (result?.available) {
            logMessage.textContent = 'AI Ready (Gemini Nano)';
            logMessage.style.color = 'green';
        } else if (result?.status === 'downloading') {
            logMessage.textContent = 'AI model downloading...';
            logMessage.style.color = 'orange';
        } else if (result?.status === 'not_found') {
            logMessage.textContent = 'AI API not found. Enable flags?';
            logMessage.style.color = 'red';
            addSetupGuideLink(logMessage);
        } else {
            logMessage.textContent = 'AI not available: ' + (result?.status || 'unknown');
            logMessage.style.color = 'red';
        }
    } catch (e) {
        logMessage.textContent = 'Cannot check AI on this page';
        logMessage.style.color = 'orange';
        console.warn('AI check failed:', e);
    }
}

function addSetupGuideLink(container) {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = ' [Setup Guide]';
    link.style.marginLeft = '4px';
    link.onclick = (e) => {
        e.preventDefault();
        alert(
            'To enable Gemini Nano:\n\n' +
            '1. Go to chrome://flags/#optimization-guide-on-device-model\n' +
            '   → Set to "Enabled BypassPerfRequirement"\n\n' +
            '2. Go to chrome://flags/#prompt-api-for-gemini-nano\n' +
            '   → Set to "Enabled"\n\n' +
            '3. Restart Chrome\n\n' +
            '4. Check chrome://components\n' +
            '   → "Optimization Guide On Device Model" should show a version'
        );
    };
    container.appendChild(link);
}

document.addEventListener('DOMContentLoaded', () => {
    const btnStart = document.getElementById('btn-start');
    const btnCancel = document.getElementById('btn-cancel');
    const statusText = document.getElementById('status-text');
    
    btnStart.addEventListener('click', () => {
      // Mock logic for now
      console.log('Start clicked');
      const depth = document.querySelector('input[name="depth"]:checked').value;
      const scope = document.querySelector('input[name="scope"]:checked').value;
      
      const aiOptions = {
        format: document.getElementById('opt-format').checked,
        summary: document.getElementById('opt-summary').checked,
        merge: document.getElementById('opt-merge').checked
      };
      // TODO: Send message to background
      chrome.runtime.sendMessage({ 
        type: 'START_CRAWL', 
        payload: { depth, scope, aiOptions } 
      });
      
      updateUIState(true);
    });
  
    btnCancel.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'STOP_CRAWL' });
      updateUIState(false);
    });
  
    function updateUIState(isRunning) {
      btnStart.style.display = isRunning ? 'none' : 'block';
      btnCancel.style.display = isRunning ? 'block' : 'none';
      statusText.textContent = isRunning ? 'Crawling...' : 'Ready';
    }

    // Check AI capabilities via content script injection
    checkAIAvailability();

    // Listen for updates from Background
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'UPDATE_STATUS') {
            const { currentUrl, processed, queue } = message.payload;
            statusText.textContent = `Processing: ${processed} done, ${queue} queued`;
            document.getElementById('log-message').textContent = `Fetching: ${currentUrl}`;
            
            // Simple progress visualization (indefinite or based on queue size?)
            // If we knew total expected, we could do %. For now, just pulse or simple counter.
            // Let's assume max 100 for visual sake or just animate.
            const pct = Math.min(100, (processed / (processed + queue + 1)) * 100); 
            document.getElementById('progress-fill').style.width = `${pct}%`;

        } else if (message.type === 'CRAWL_COMPLETE') {
            updateUIState(false);
            statusText.textContent = `Completed! (${message.count} pages)`;
            document.getElementById('progress-fill').style.width = '100%';
            document.getElementById('log-message').textContent = 'Download started.';
        } else if (message.type === 'CRAWL_ERROR') {
            updateUIState(false);
            statusText.textContent = 'Error';
            document.getElementById('log-message').textContent = message.error;
            document.getElementById('log-message').style.color = 'red';
        }
    });

    // Check if crawl is already running (recover state) upon popup open
    // We would need to ask BG for state. 
    // Skipped for MVP, but good to have if user re-opens popup.
  });
