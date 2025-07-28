// ==UserScript==
// @name         IB Page - Late Arrivals 
// @namespace    https://trans-logistics-eu.amazon.com/
// @version      1.4
// @description  Highlights late AATs, auto-fills earliest CPT (same day, P ≥ 10), with clean route text
// @match        https://trans-logistics-eu.amazon.com/ssp/dock/hrz/ib*
// @grant        none
// @author chatzidk
// ==/UserScript==

(function () {
    'use strict';

    const BUTTON_ID = 'lateArrivalsBtn';
    const LATE_THRESHOLD_MIN = 15;
    const STORAGE_KEY = 'lateArrivalInputs';
    const EXPIRATION_MS = 12 * 60 * 60 * 1000;

    const monthMap = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };

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
                background-color: #5bc0de;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            }
            #lateArrivalsPopupWrapper {
                position: fixed;
                top: 0; left: 0;
                width: 100vw; height: 100vh;
                background: rgba(0,0,0,0.3);
                z-index: 9998;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            #lateArrivalsPopup {
                background: white;
                border: 1px solid #ccc;
                border-radius: 8px;
                padding: 10px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 5px 20px rgba(0,0,0,0.3);
                z-index: 9999;
            }
            #lateArrivalsPopup table {
                border-collapse: collapse;
                font-size: 13px;
                font-family: Segoe UI, sans-serif;
            }
            #lateArrivalsPopup th, #lateArrivalsPopup td {
                border: 1px solid #ccc;
                padding: 4px 8px;
                white-space: nowrap;
                text-align: left;
                vertical-align: middle;
            }
            #lateArrivalsPopup th {
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
        return new Date(2000 + +year, monthMap[monthAbbr], +day, hour, minute);
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

    async function getEarliestCPT(vrid, aat) {
        return new Promise((resolve) => {
            const cptLink = document.querySelector(`#earliestCpt_${vrid}`);
            if (!cptLink) return resolve(null);
            cptLink.click();

            const interval = setInterval(() => {
                const table = document.querySelector('#tableViewCPTMix tbody');
                if (!table) return;

                const rows = Array.from(table.querySelectorAll('tr'));
                const aatDay = aat.getDate(), aatMonth = aat.getMonth(), aatYear = aat.getFullYear();

                const valid = rows.map(row => {
                    const cells = row.querySelectorAll('td');
                    const cptStr = cells[0]?.innerText.trim();
                    const pVal = parseInt(cells[2]?.innerText.trim(), 10);
                    const cpt = parseDate(cptStr);
                    if (!cpt || isNaN(pVal)) return null;

                    const sameDay = (
                        cpt.getDate() === aatDay &&
                        cpt.getMonth() === aatMonth &&
                        cpt.getFullYear() === aatYear
                    );

                    return (sameDay && pVal >= 10) ? { cpt, cptStr } : null;
                }).filter(Boolean);

                clearInterval(interval);
                if (valid.length === 0) return resolve(null);

                valid.sort((a, b) => a.cpt - b.cpt);
                resolve(valid[0].cptStr);
            }, 500);
        });
    }

    async function processLateArrivals() {
        const late = [];
        const rows = document.querySelectorAll('#dashboard tbody tr');

        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length < 22) continue;

            const rawVrid = cells[7].innerText.trim();
            const vrid = rawVrid.split(' ')[0];
            if (!vrid) continue;

            const rawRoute = cells[5].innerText.trim();
            const route = rawRoute.includes('→') ? rawRoute.split('→')[0].trim() : rawRoute;

            const pkgs = cells[11].innerText.trim();
            const satStr = cells[20].innerText.trim();
            const aatStr = cells[21].innerText.trim();
            const sat = parseDate(satStr);
            const aat = parseDate(aatStr);
            if (!sat || !aat) continue;

            const delayMin = (aat - sat) / 60000;
            if (delayMin >= LATE_THRESHOLD_MIN) {
                cells[21].style.outline = '2px solid red';

                const fmc = `https://trans-logistics-eu.amazon.com/fmc/execution/search/${vrid}`;
                const cptStr = await getEarliestCPT(vrid, aat);
                late.push({ vrid, fmc, route, satStr, aatStr, pkgs, cptStr: cptStr || '' });
            }
        }
        return late;
    }

    async function showPopup(entries) {
        if (document.getElementById('lateArrivalsPopupWrapper')) return;

        const stored = loadStorage();
        const wrapper = document.createElement('div');
        wrapper.id = 'lateArrivalsPopupWrapper';

        const popup = document.createElement('div');
        popup.id = 'lateArrivalsPopup';

        const table = document.createElement('table');
        table.innerHTML = `<thead><tr>
            <th>FMC</th><th>VRID</th><th>Route</th><th>SAT</th><th>AAT</th><th>Pkgs</th>
            <th>1st CPT</th><th>Case</th><th>Rootcause</th><th>Comments</th>
        </tr></thead>`;

        const tbody = document.createElement('tbody');
        for (const entry of entries) {
            const row = document.createElement('tr');
            const saved = stored[entry.vrid] || {};
            row.innerHTML = `
                <td><a href="${entry.fmc}" target="_blank">FMC</a></td>
                <td>${entry.vrid}</td>
                <td>${entry.route}</td>
                <td>${entry.satStr}</td>
                <td>${entry.aatStr}</td>
                <td>${entry.pkgs}</td>
                <td contenteditable="true">${entry.cptStr || saved.cpt || ''}</td>
                <td contenteditable="true">${saved.case || ''}</td>
                <td contenteditable="true">${saved.rootcause || ''}</td>
                <td contenteditable="true">${saved.comments || ''}</td>
            `;
            const fields = ['cpt', 'case', 'rootcause', 'comments'];
            [...row.querySelectorAll('td[contenteditable]')].forEach((cell, i) => {
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
        button.textContent = 'Late Arrivals';
        button.onclick = async () => {
            const data = await processLateArrivals();
            showPopup(data);
        };
        document.body.appendChild(button);
    }

    const observer = new MutationObserver(() => {
        if (document.querySelector('#dashboard')) {
            createButton();
            processLateArrivals(); // Red outlines
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    createStyles();
})();
