const summonBtn = document.getElementById('summonBtn');
const dismissBtn = document.getElementById('dismissBtn');
const status = document.getElementById('status');

summonBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'summonDoggy' }, (response) => {
    if (response && response.success) {
      status.textContent = '🐕 Doggy is here!';
      dismissBtn.disabled = false;
    }
  });
});

dismissBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'dismissDoggy' }, (response) => {
    if (response && response.success) {
      status.textContent = '👋 Doggy went home';
      dismissBtn.disabled = true;
    }
  });
});

// Check doggy status on popup open
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  chrome.tabs.sendMessage(tab.id, { action: 'checkDoggy' }, (response) => {
    if (response && response.active) {
      status.textContent = '🐕 Doggy is here!';
      dismissBtn.disabled = false;
    } else {
      status.textContent = 'Ready to play!';
      dismissBtn.disabled = true;
    }
  });
});