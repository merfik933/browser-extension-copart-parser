const toggleBtn = document.getElementById('toggleBtn');
const toggleIcon = document.getElementById('toggleIcon');

let isRunning = false;

function updateButtonState() {
  if (isRunning) {
    toggleIcon.src = 'icons/stop.png';
    toggleIcon.alt = 'Stop';
    toggleBtn.title = 'Стоп';
  } else {
    toggleIcon.src = 'icons/start.png';
    toggleIcon.alt = 'Start';
    toggleBtn.title = 'Старт';
  }
}

toggleBtn.addEventListener('click', () => {
  isRunning = !isRunning;
  updateButtonState();
  chrome.runtime.sendMessage({
    action: isRunning ? 'start-parsing' : 'stop-parsing'
  });
});

chrome.runtime.sendMessage({ action: 'get-parsing-state' }, (response) => {
  if (response && response.isRunning !== undefined) {
    isRunning = response.isRunning;
    updateButtonState();
  }
});

