async function runInTab(tabId, func, args = []) {
    const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func,
        args
    });
    return result?.result;
}

export async function clickOn(tabId, selector) {
    return await runInTab(tabId, (sel) => {
        const el = document.querySelector(sel);
        if (el) {
            el.click();
            return true;
        }
        return false;
    }, [selector]);
}

export async function waitFor(tabId, selector, timeout = 60000) {
    return await runInTab(tabId, async (sel, timeout) => {
        return await new Promise((resolve) => {
            const start = Date.now();
            const interval = setInterval(() => {
                const el = document.querySelector(sel);
                if (el) {
                    clearInterval(interval);
                    resolve("Element appeared");
                } else if (Date.now() - start > timeout) {
                    clearInterval(interval);
                    resolve("Timeout waiting for " + sel);
                }
            }, 200);
        });
    }, [selector, timeout]);
}

export async function getAllLotUrlsBySelector(tabId, selector) {
    return await runInTab(tabId, (sel) => {
        const elements = document.querySelectorAll(sel);
        const urls = {};

        elements.forEach(el => {
            const href = el.href;
            const text = el.textContent;
            urls[text] = href;
        });
        return urls;
    }, [selector]);
}

export async function textElementsChecker(tabId, selectors, actionMessage, interval = 1000) {
    await runInTab(tabId, (sels, msg, intvl) => {
        console.log("[textElementsChecker] Started with selectors:", sels, "interval:", intvl);
        const timer = setInterval(() => {
            const data = {};
            sels.forEach(sel => {
                const el = document.querySelector(sel);
                const text = el ? el.textContent : null;
                data[sel] = text;
                console.log(`[textElementsChecker] Selector: ${sel}, Found: ${!!el}, Text:`, text);
            });
            if (Object.keys(data).length > 0) {
                chrome.runtime.sendMessage({ action: msg, data});    
                console.log("[textElementsChecker] Sent message:", { action: msg, data: data });
            } else {
                console.warn("[textElementsChecker] No elements found for selectors:", sels);
            }
        }, intvl);
    }, [selectors, actionMessage, interval]);
}