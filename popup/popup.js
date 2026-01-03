document.addEventListener('DOMContentLoaded', () => {
    const btnStart = document.getElementById('btn-start');
    const btnCancel = document.getElementById('btn-cancel');
    const statusText = document.getElementById('status-text');
    
    btnStart.addEventListener('click', () => {
      // Mock logic for now
      console.log('Start clicked');
      const depth = document.querySelector('input[name="depth"]:checked').value;
      const scope = document.querySelector('input[name="scope"]:checked').value;
      
      // TODO: Send message to background
      chrome.runtime.sendMessage({ 
        type: 'START_CRAWL', 
        payload: { depth, scope } 
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

    // Check AI capabilities on load
    if (window.ai && window.ai.languageModel) {
        window.ai.languageModel.capabilities().then(caps => {
            if (caps.available === 'no') {
                document.getElementById('log-message').textContent = 'Warning: AI not available on this device/browser.';
                document.getElementById('log-message').style.color = 'orange';
            } else {
                 document.getElementById('log-message').textContent = 'AI Ready (Gemini Nano)';
                 document.getElementById('log-message').style.color = 'green';
            }
        }).catch(e => {
            document.getElementById('log-message').textContent = 'Error checking AI: ' + e.message;
        });
    } else {
         document.getElementById('log-message').textContent = 'AI API not found. Enable flags?';
         document.getElementById('log-message').style.color = 'red';
         
         // User requested: "設定されていない場合エラーを表示し、手順を表示するようにしたいです。"
         const link = document.createElement('a');
         link.href = '#';
         link.textContent = ' [Setup Guide]';
         link.onclick = (e) => {
             e.preventDefault();
             alert('Please enable "Prompt API for Gemini Nano" in chrome://flags. You may need Chrome Canary.');
         };
         document.getElementById('log-message').appendChild(link);
    }

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
