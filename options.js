document.addEventListener("DOMContentLoaded", async () => {
  const lotMinDelay = document.getElementById("lotMinDelay");
  const lotMaxDelay = document.getElementById("lotMaxDelay");
  const bidInterval = document.getElementById("bidInterval");
  const lotInterval = document.getElementById("lotInterval");
  const testMode = document.getElementById("testMode");
  const currentBidSelector = document.getElementById("currentBidSelector");
  const currentLotIdSelector = document.getElementById("currentLotIdSelector");
  const lotsListSelector = document.getElementById("lotsListSelector");

  chrome.storage.sync.get([
    "lotMinDelay", "lotMaxDelay", "bidInterval", "lotInterval",
    "currentBidSelector", "currentLotIdSelector", "lotsListSelector",
    "testMode"
  ], (data) => {
    lotMinDelay.value = data.lotMinDelay;
    lotMaxDelay.value = data.lotMaxDelay;
    bidInterval.value = data.bidInterval;
    lotInterval.value = data.lotInterval || 1000; // Default to 1000ms if not set
    testMode.checked = data.testMode;
    currentBidSelector.value = data.currentBidSelector || "";
    currentLotIdSelector.value = data.currentLotIdSelector || "";
    lotsListSelector.value = data.lotsListSelector || "";
  });

  document.getElementById("saveBtn").addEventListener("click", () => {
    chrome.storage.sync.set({
      lotMinDelay: +lotMinDelay.value,
      lotMaxDelay: +lotMaxDelay.value,
      bidInterval: +bidInterval.value,
      lotInterval: +lotInterval.value,
      currentBidSelector: currentBidSelector.value,
      currentLotIdSelector: currentLotIdSelector.value,
      lotsListSelector: lotsListSelector.value,
      testMode: testMode.checked
    }, () => {
      alert("Настройки сохранены");
    });

    chrome.runtime.sendMessage({ action: "update-settings" });
  });
});
