console.log("Загружен скрипт content_lot.js");

function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const interval = 100;
    let elapsed = 0;

    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
      } else {
        elapsed += interval;
        if (elapsed >= timeout) {
          reject(new Error(`Елемент ${selector} не з'явився протягом ${timeout} мс`));
        } else {
          setTimeout(check, interval);
        }
      }
    };

    check();
  });
}

async function collectLotData() {
    let lotData = {};

    try {
        await waitForElement("h1", 5000);

        const titleSelector = "h1";
        const lotTitle = document.querySelector(titleSelector);
        if (!lotTitle) {
            console.error("Не удалось найти элемент с заголовком лота");
        }
        lotData.title = lotTitle.textContent.trim();

        const url = window.location.href;
        if (!url) {
            console.error("Не удалось получить URL страницы");
        }
        lotData.url = url;

        const lotNumberSelector = ".lot-details-heading .lot-number";
        const lotNumberElem = document.querySelector(lotNumberSelector);
        let lotNumber = null;
        if (lotNumberElem) {
            const match = lotNumberElem.textContent.match(/\d+/g);
            lotNumber = match ? match.join('') : null;
        } else if (!lotNumber) {
            console.error("Не удалось найти элемент с номером лота");
        }
        lotData.number = lotNumber;
        
        lotData.minBid = "Not found";
        lotData.maxBid = "Not found";

        const imagesSelector = "img.thumbnailImg";
        lotData.images = [];
        try {
            await waitForElement(imagesSelector, 5000);
        } catch (err) {
            console.warn(`Элемент(ы) ${imagesSelector} не найдены: ${err.message}`);
        }
        const images = document.querySelectorAll(imagesSelector);
        console.log(`Найдено ${images.length} изображений лота`);
        images.forEach(img => {
            lotData.images.push({
                hdUrl: img.getAttribute("hd-url") || img.getAttribute("full-url") || img.src
            });
        });

        lotData.imagesPath = 'images/' + lotData.number + '_images.zip';

        try {
            await downloadImagesAsZip(lotData.number, lotData.images);
        } catch (e) {
        console.error("Ошибка при создании архива:", e);
        chrome.runtime.sendMessage({
            action: "lot-data-error",
            error: `Ошибка при создании архива: ${e.message}`
        });
        return;
        }

        const detailSelector = ".lot-display-list .details, .sales-info-content .details";
        const lotDetails = document.querySelectorAll(detailSelector);
        if (!lotDetails) {
            console.error("Не удалось найти элемент с деталями лота");
        }
        lotDetails.forEach(detail => {
            let label = detail.querySelector("label");
            let dataUname = label.getAttribute("data-uname");
            console.log("Обработка детали:", label.textContent, "с data-uname:", dataUname);
            if (!dataUname) {
                console.warn("Не найдено data-uname для элемента:", label.textContent);
                if (label.textContent.includes("Евронорма")) {
                    dataUname = "euroNorm";
                } else if (label.textContent.includes("Мощность")) {
                    dataUname = "power";
                } else if (label.textContent.includes("Выброс CO2")) {
                    dataUname = "co2Emissions";
                } else if (label.textContent.includes("Рабочий объем двигателя")) {
                    dataUname = "engineDisplacement";
                } else if (label.textContent.includes("Коробка передач")) {
                    dataUname = "transmission";
                } else if (label.textContent.includes("Дата первой регистрации")) {
                    dataUname = "firstRegistrationDate";
                } else if (label.textContent.includes("Применяется НДС")) {
                    dataUname = "vatApplicable";
                } else if (label.textContent.includes("Документы на автомобиль")) {
                    dataUname = "documents";
                } else if (label.textContent.includes("Вес")) {
                    dataUname = "weight";
                } else if (label.textContent.includes("Дополнительная информация")) {
                    dataUname = "additionalInfo";
                } else if (label.textContent.includes("Отчет о транспортном средстве")) {
                    dataUname = "vehicleReport";
                } else if (label.textContent.includes("Подушки безопасности сработали")) {
                    dataUname = "airbagsDeployed";
                } else if (label.textContent.includes("Сервисная книжка")) {
                    dataUname = "serviceBook";
                } else if (label.textContent.includes("Название аукциона")) {
                    dataUname = "auctionName";
                } else {
                    let nextElem = label.nextElementSibling;
                    let detailValue = nextElem ? nextElem.textContent.replace(/\n\s*/g, '').trim() : "";

                    if (lotData["not defined"]) {
                        lotData["not defined"].push({ label: label.textContent.trim(), data: detailValue });
                    } else {
                        lotData["not defined"] = [{ label: label.textContent.trim(), data: detailValue }];
                    }
                }
            }
            if (dataUname && dataUname !== "vehicleReport") {
                console.log("Обработка детали с data-uname:", dataUname);
                let detailKey = dataUname.replace(/^lotdetail/, "");
                detailKey = detailKey.charAt(0).toLowerCase() + detailKey.slice(1);

                let nextElem = label.nextElementSibling;
                let detailValue = nextElem ? nextElem.textContent.replace(/\n\s*/g, '').trim() : "";

                lotData[detailKey] = detailValue;
            }
        });

        console.log("Собранные данные лота:", lotData);
        
        chrome.runtime.sendMessage({
            action: "lot-data",
            data: lotData,
            error: null
        });
    } catch (error) {
        console.error("Ошибка при сборе данных лота:", error);
        chrome.runtime.sendMessage({
            action: "lot-data-error",
            error: error.message
        });
    }
}

async function downloadImagesAsZip(lotId, images) {
  const zip = new JSZip();
  const folder = zip.folder(`${lotId}`);
  let index = 1;

  for (const img of images) {
    const url = img.hdUrl;
    if (!url) continue;

    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) throw new Error(`HTTP error! ${response.status}`);

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      folder.file(`${index}.jpg`, arrayBuffer);
      index++;
    } catch (err) {
      console.warn(`⚠️ Невозможно загрузить: ${url}`, err);
    }
  }

  if (index === 1) {
    console.warn("❌ Ни одного изображения не удалось добавить");
    return;
  }

  const blob = await zip.generateAsync({ type: "blob" });

  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = `${lotId}.zip`;
  a.click();
}

collectLotData();