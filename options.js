document.addEventListener("DOMContentLoaded", async () => {
  const bidInterval = document.getElementById("bidInterval");
  const testMode = document.getElementById("testMode");
  const currentBidSelector = document.getElementById("currentBidSelector");
  const currentLotIdSelector = document.getElementById("currentLotIdSelector");

  chrome.storage.sync.get([
    "bidInterval",
    "currentBidSelector", "currentLotIdSelector",
    "testMode"
  ], (data) => {
    bidInterval.value = data.bidInterval;
    testMode.checked = data.testMode;
    currentBidSelector.value = data.currentBidSelector || "";
    currentLotIdSelector.value = data.currentLotIdSelector || "";
  });

  document.getElementById("saveBtn").addEventListener("click", () => {
    chrome.storage.sync.set({
      bidInterval: +bidInterval.value,
      currentBidSelector: currentBidSelector.value,
      currentLotIdSelector: currentLotIdSelector.value,
      testMode: testMode.checked
    }, () => {
      alert("Настройки сохранены");
    });

    chrome.runtime.sendMessage({ action: "update-settings" });
  });
});
