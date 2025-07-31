import { waitFor, clickOn, textElementsChecker } from './content_utils.js';

let isRunning = false;

let dataJSON = {};
let settings = {};

loadSettings().then(() => {
    console.log("Настройки загружены", settings);
});
async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get([
            "bidInterval", "testMode",
            "currentBidSelector", "currentLotIdSelector"
        ], (data) => {
            settings.bidInterval = Number(data.bidInterval) || 1000;
            settings.testMode = data.testMode || false;

            settings.currentBidSelector = data.currentBidSelector || "circle + text";
            settings.currentLotIdSelector = data.currentLotIdSelector || ".itempair a[data-uname='lot-details-value']";

            chrome.storage.sync.set({
                bidInterval: settings.bidInterval,
                testMode: settings.testMode,
                currentBidSelector: settings.currentBidSelector,
                currentLotIdSelector: settings.currentLotIdSelector,
            });
        });
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'get-parsing-state') {
        sendResponse({ isRunning });
    } else if (message.action === 'start-parsing') {
        isRunning = true;
        startParsing();
    } else if (message.action === 'stop-parsing') {
        isRunning = false;
        stopParsing();
    } else if (message.action === 'update-settings') {
        loadSettings().then(() => {
            console.log("Настройки обновлены", settings);
        });
    } else if (message.action === 'bid-checker') {
        const lotId = message.data[settings.currentLotIdSelector];
        const currentBidRaw = message.data[settings.currentBidSelector];

        const currentBid = parseFloat((currentBidRaw || '').toString().replace(/\D/g, '') || '0');

        if (!lotId || !currentBid) {
            return false;
        }

        console.log(`Текущая ставка для лота ${lotId}: ${currentBid}`);

        if (!dataJSON[lotId]) dataJSON[lotId] = {};

        if (dataJSON[lotId].maxBid === "Not found" || dataJSON[lotId].maxBid === undefined) {
            dataJSON[lotId].maxBid = currentBid;
        } else if (dataJSON[lotId].maxBid < currentBid) {
            dataJSON[lotId].maxBid = currentBid;
        }

        if (dataJSON[lotId].minBid === "Not found" || dataJSON[lotId].minBid === undefined) {
            dataJSON[lotId].minBid = currentBid;
        } else if (dataJSON[lotId].minBid > currentBid) {
            dataJSON[lotId].minBid = currentBid;
        }

        console.log(`Обновлены данные для лота ${lotId}: maxBid=${dataJSON[lotId].maxBid}, minBid=${dataJSON[lotId].minBid}`);
    }

    return true;
});

function stopParsing() {
    console.log('Сохранение данных...');
    saveDataJSON();

    console.log('Остановка парсинга...');
    chrome.runtime.reload()
}

function saveDataJSON() {
    const jsonStr = JSON.stringify(dataJSON, null, 2);
    const dataUrl = "data:application/json;base64," + btoa(unescape(encodeURIComponent(jsonStr)));
    chrome.downloads.download({
        url: dataUrl,
        filename: "data.json",
        saveAs: false
    });
    console.log('Данные сохранены в data.json');
}

function startParsing() {
    console.log('Начало парсинга...');
    parsing()
}

async function parsing() {
    let auctionCount = 2; // TEST TODO
    const promises = [];
    for (let i = 0; i < auctionCount; i++) {
        promises.push((async () => {
            // Открытие страницы с аукционами
            console.log(`Открытие вкладки с аукционами...`);
            const result = await gotoAuctionsListPage();
            const tabId = result.tabId;

            console.log(`Вкладка с аукционами открыта: ${tabId}`);

            // Нажатие кнопки для перехода к аукциону
            console.log(`Переход к аукциону ${i + 1}...`);
            await clickToActionPage(i + 1, tabId);
            console.log(`Переход к аукциону ${i + 1} завершен`);

            // Проверка текущей ставки и ID лота
            textElementsChecker(tabId, [settings.currentBidSelector, settings.currentLotIdSelector], "bid-checker", settings.bidInterval);
        })());
    }
    await Promise.all(promises);
}

async function gotoAuctionsListPage() {
    return new Promise((resolve, reject) => {
        if (settings.testMode) {
            console.log("Тестовый режим: Открытие страницы аукционов с локального файла");
            chrome.windows.create({
                url: chrome.runtime.getURL("test_data/auctions_list_page.html"),
                type: "normal"
            }, (window) => {
                const tab = window.tabs?.[0];
                if (!tab || !tab.id) return reject("Вкладка не найдена");
                resolve({ tabId: tab.id, windowId: window.id });
            });
        } else {
            chrome.windows.create({
                url: "https://g2auction.copart.de/g2/auctions.html?siteLanguage=ru&appId=g2",
                type: "normal"
            }, (window) => {
                try {
                    const tab = window.tabs?.[0];
                    if (!tab || !tab.id) return reject("Вкладка не найдена");

                    chrome.tabs.update(tab.id, { muted: true });

                    const tabId = tab.id;

                    console.log(`Ожидание загрузки страницы аукционов...`);
                    const listener = async (updatedTabId, info) => {
                        if (updatedTabId === tabId && info.status === 'complete') {
                            chrome.tabs.onUpdated.removeListener(listener);

                            while (true) {
                                try {
                                    const result = await waitFor(tabId, ".auction-list .bid.COPARTDE", 60000);
                                    console.log(`Ожидание завершено: ${result}`);
                                    resolve({ tabId, windowId: window.id });
                                    break;
                                } catch (err) {
                                    console.error(`Ошибка при ожидании элемента: ${err}`);
                                    console.log("Повторная попытка через 5 секунд...");
                                    await new Promise(resolve => setTimeout(resolve, 5000));
                                }
                            }
                        }
                    };

                    chrome.tabs.onUpdated.addListener(listener);
                } catch (e) {
                    reject(e);
                }
            });
        }
    });
}

async function clickToActionPage(auctionId, tabId) {
    if (settings.testMode) {
        console.log(`Тестовый режим: Загрузка страницы аукциона ${auctionId} с локального файла`);
        chrome.tabs.update(tabId, {
            url: chrome.runtime.getURL("test_data/auction_page.html")
        });
    } else {
        try {
            let result = await clickOn(tabId, `.auction-list tr.liveAuction:nth-child(${auctionId + 1}) .bid.COPARTDE`);
            console.log(`Нажатие на аукцион ${auctionId} выполнено: ${result}`);

            console.log(`Ожидание загрузки страницы аукциона ${auctionId}...`);
            result = await waitFor(tabId, settings.currentLotIdSelector, 60000);
            console.log(`Ожидание завершено: ${result}`);
        } catch (error) {
            console.error(`Ошибка при переходе к аукциону ${auctionId}: ${error}`);
        }
    }
}