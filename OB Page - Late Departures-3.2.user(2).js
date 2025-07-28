// ==UserScript==
// @name         OB Page - Late Departures 
// @namespace    https://trans-logistics-eu.amazon.com/
// @version      3.2
// @description  Highlights late ADTs (passively) and shows editable popup with persistent fields (12h)
// @match        https://trans-logistics-eu.amazon.com/ssp/dock/hrz/ob*
// @grant        none
// @author       chatzidk
// ==/UserScript==

(function () {
    'use strict';

    const BUTTON_ID = 'lateDeparturesBtn';
    const STORAGE_KEY = 'lateDepartureInputs';
    const EXPIRATION_MS = 12 * 60 * 60 * 1000;

    function createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #${BUTTON_ID} {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                padding: 10px 18px;
                font-size: 14px;
                background-color: #f0ad4e;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            }
            .late-adt-highlight {
                outline: 3px solid red !important;
                outline-offset: -2px;
            }
            #lateDeparturesPopupWrapper {
                position: fixed;
                top: 0; left: 0;
                width: 100vw; height: 100vh;
                background: rgba(0,0,0,0.3);
                z-index: 9998;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            #lateDeparturesPopup {
                background: white;
                border: 1px solid #ccc;
                border-radius: 8px;
                padding: 10px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 5px 20px rgba(0,0,0,0.3);
                z-index: 9999;
            }
            #lateDeparturesPopup table {
                border-collapse: collapse;
                font-size: 13px;
                font-family: Segoe UI, sans-serif;
            }
            #lateDeparturesPopup th, #lateDeparturesPopup td {
                border: 1px solid #ccc;
                padding: 4px 8px;
                white-space: nowrap;
                text-align: left;
                vertical-align: middle;
            }
            #lateDeparturesPopup th {
                background: #f2f2f2;
            }
            td[contenteditable="true"] {
                background: #f9f9f9;
                min-width: 100px;
                max-width: 200px;
                white-space: pre-wrap;
            }
        `;
        document.head.appendChild(style);
    }

    function parseDate(str) {
        if (!str.includes(' ')) return null;
        const [datePart, timePart] = str.split(' ');
        const [day, monthAbbr, year] = datePart.split('-');
        const [hour, minute] = timePart.split(':').map(Number);
        const monthMap = {
            Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
            Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
        };
        return new Date(2000 + +year, monthMap[monthAbbr], +day, hour, minute);
    }

    function getThreshold(route) {
        return route === 'BER8->CC-HEKE-HRMS-KETZIN-DE-H1' ? 40 : 30;
    }

    function getSdtCptTag(cells) {
        const sdt = parseDate(cells[13].innerText.trim());
        const cpt = parseDate(cells[14].innerText.trim());
        const ahIcon = cells[5].querySelector('.badge-hint')?.textContent.includes('AH');
        if (!sdt || !cpt) return 'SDT';
        if (ahIcon || sdt > cpt) return 'AH';
        if (sdt.getTime() === cpt.getTime()) return 'CPT';
        return 'SDT';
    }

    function loadStorage() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const data = JSON.parse(raw);
        const now = Date.now();
        const fresh = {};
        for (const [key, value] of Object.entries(data)) {
            if (now - value.timestamp < EXPIRATION_MS) {
                fresh[key] = value;
            }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        return fresh;
    }

    function saveInput(vrid, field, value) {
        const stored = loadStorage();
        const entry = stored[vrid] || { timestamp: Date.now() };
        entry[field] = value;
        entry.timestamp = Date.now();
        stored[vrid] = entry;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    }

    function processLateDepartures(highlightOnly = false) {
        const late = [];
        document.querySelectorAll('#dashboard tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 16) return;
            const vrid = cells[7].querySelector('span[data-vrid]')?.getAttribute('data-vrid');
            if (!vrid) return;

            const sdtStr = cells[13].innerText.trim();
            const adtStr = cells[15].innerText.trim();
            const route = cells[5].innerText.trim();
            const sdt = parseDate(sdtStr);
            const adt = parseDate(adtStr);
            if (!sdt || !adt) return;

            const diff = (adt - sdt) / 60000;
            const threshold = getThreshold(route);

            if (diff >= threshold) {
                cells[15].classList.add('late-adt-highlight');
                if (!highlightOnly) {
                    const fmc = `https://trans-logistics-eu.amazon.com/fmc/execution/search/${vrid}`;
                    const pkgs = cells[11].innerText.trim();
                    const tag = getSdtCptTag(cells);
                    late.push({ vrid, fmc, route, sdtStr, adtStr, pkgs, tag });
                }
            }
        });
        return late;
    }

    function showPopup(entries) {
        if (document.getElementById('lateDeparturesPopupWrapper')) return;

        const stored = loadStorage();
        const wrapper = document.createElement('div');
        wrapper.id = 'lateDeparturesPopupWrapper';

        const popup = document.createElement('div');
        popup.id = 'lateDeparturesPopup';

        const table = document.createElement('table');
        table.innerHTML = `<thead><tr>
            <th>FMC</th><th>VRID</th><th>Route</th><th>SDT</th><th>ADT</th><th>Pkgs</th><th>SDT/CPT</th>
            <th>Case</th><th>Rootcause</th><th>Comments</th><th>Check in</th>
        </tr></thead>`;

        const tbody = document.createElement('tbody');
        for (const entry of entries) {
            const row = document.createElement('tr');
            const saved = stored[entry.vrid] || {};
            row.innerHTML = `
                <td><a href="${entry.fmc}" target="_blank">FMC</a></td>
                <td>${entry.vrid}</td>
                <td>${entry.route}</td>
                <td>${entry.sdtStr}</td>
                <td>${entry.adtStr}</td>
                <td>${entry.pkgs}</td>
                <td>${entry.tag}</td>
                <td contenteditable="true">${saved.case || ''}</td>
                <td contenteditable="true">${saved.rootcause || ''}</td>
                <td contenteditable="true">${saved.comments || ''}</td>
                <td contenteditable="true">${saved.checkin || ''}</td>
            `;
            [...row.querySelectorAll('td[contenteditable]')].forEach((cell, i) => {
                const fields = ['case', 'rootcause', 'comments', 'checkin'];
                cell.addEventListener('input', () => {
                    saveInput(entry.vrid, fields[i], cell.innerText.trim());
                });
            });
            tbody.appendChild(row);
        }

        table.appendChild(tbody);
        popup.appendChild(table);
        wrapper.appendChild(popup);
        document.body.appendChild(wrapper);

        wrapper.addEventListener('click', e => {
            if (e.target === wrapper) wrapper.remove();
        });
    }

    function createButton() {
        if (document.getElementById(BUTTON_ID)) return;
        const button = document.createElement('button');
        button.id = BUTTON_ID;
        button.textContent = 'Late Departures';
        button.onclick = () => showPopup(processLateDepartures(false));
        document.body.appendChild(button);
    }

    const observer = new MutationObserver(() => {
        if (document.querySelector('#dashboard')) {
            createButton();
            processLateDepartures(true); // passive highlight
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    createStyles();
})();
