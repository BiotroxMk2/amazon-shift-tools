// ==UserScript==
// @name         Dock Page - Shift Selector
// @namespace    amazon-shift-filter
// @version      1.6.2
// @description  Adds collapsible shift selector to IB and OB dock pages with date override, clear button, and auto-refresh
// @match        https://trans-logistics-eu.amazon.com/ssp/dock/hrz/ib*
// @match        https://trans-logistics-eu.amazon.com/ssp/dock/hrz/ob*
// @updateURL    https://raw.githubusercontent.com/chatzidk/amazon-shift-tools/main/shift-selector.user.js
// @downloadURL  https://raw.githubusercontent.com/chatzidk/amazon-shift-tools/main/shift-selector.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const style = document.createElement("style");
    style.textContent = `
    #shiftSelectorContainer {
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 9999;
        font-family: Arial, sans-serif;
    }
    #shiftSelectorToggle {
        background-color: #0073b7;
        color: white;
        padding: 6px 12px;
        font-size: 14px;
        font-weight: bold;
        border-radius: 8px 8px 0 0;
        cursor: pointer;
        user-select: none;
    }
    #shiftSelectorBox {
        background: #fff;
        border: 1px solid #ccc;
        border-top: none;
        border-radius: 0 0 12px 12px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.15);
        padding: 10px 14px;
        display: none;
        width: 200px;
    }
    #shiftSelectorBox h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        color: #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .shiftBtn {
        margin: 3px 4px;
        padding: 6px 10px;
        border: none;
        border-radius: 6px;
        background-color: #0073b7;
        color: white;
        cursor: pointer;
        font-size: 12px;
        transition: background-color 0.2s;
    }
    .shiftBtn:hover {
        background-color: #005a93;
    }
    .dateRow {
        margin: 6px 0;
        font-size: 12px;
        color: #333;
    }
    .dateRow input {
        width: 100%;
        padding: 2px;
        font-size: 12px;
    }
    #clearDatesBtn {
        background-color: #ccc;
        color: #000;
        border: none;
        border-radius: 6px;
        padding: 2px 6px;
        font-size: 10px;
        cursor: pointer;
        margin-left: 8px;
    }
    `;
    document.head.appendChild(style);

    const container = document.createElement("div");
    container.id = "shiftSelectorContainer";
    container.innerHTML = `
        <div id="shiftSelectorToggle">Shift Selection</div>
        <div id="shiftSelectorBox">
            <h4>
                Select Shift
                <button id="clearDatesBtn">Clear</button>
            </h4>
            <div class="dateRow">Start Date:<br><input type="date" id="startDateInput"></div>
            <div class="dateRow">End Date:<br><input type="date" id="endDateInput"></div>
            <button class="shiftBtn" data-shift="ES">Early</button>
            <button class="shiftBtn" data-shift="TW">Twilight</button>
            <button class="shiftBtn" data-shift="NS">Night</button>
        </div>
    `;
    document.body.appendChild(container);

    const toggle = document.getElementById("shiftSelectorToggle");
    const box = document.getElementById("shiftSelectorBox");

    toggle.addEventListener("click", () => {
        box.style.display = box.style.display === "none" ? "block" : "none";
    });

    const startInput = document.querySelector('#startDateInput');
    const endInput = document.querySelector('#endDateInput');

    function todayDateStr() {
        const now = new Date();
        return now.toISOString().split('T')[0];
    }

    startInput.value = todayDateStr();
    endInput.value = todayDateStr();

    document.getElementById("clearDatesBtn").addEventListener("click", () => {
        startInput.value = todayDateStr();
        endInput.value = todayDateStr();
    });

    function formatDateForInput(dateObj) {
        return `${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getDate().toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
    }

    function setDropdownSafe(select, value) {
        const optionExists = Array.from(select.options).some(opt => opt.value === value);
        if (optionExists) {
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function triggerFilter() {
        const searchBtn = document.querySelector('#submitSearch');
        if (searchBtn) searchBtn.click();
    }

    function setShift(shift) {
        const fromDateInput = document.querySelector('input[dataname="FromDate"]');
        const toDateInput = document.querySelector('input[dataname="ToDate"]');
        const fromTimeSelect = document.querySelector('select[dataname="fromTime"]');
        const toTimeSelect = document.querySelector('select[dataname="toTime"]');

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 86400000);

        let fromDate, toDate;

        if (shift === "NS") {
            fromDate = now.getHours() < 6 ? yesterday : today;
            toDate = new Date(fromDate.getTime() + 86400000);

            startInput.value = fromDate.toISOString().split('T')[0];
            // Reflect actual FromDate/ToDate into visible date pickers
            startInput.value = fromDate.toISOString().split('T')[0];
            endInput.value = toDate.toISOString().split('T')[0];

        } else {
            const startOverride = startInput.value;
            const endOverride = endInput.value;
            fromDate = startOverride ? new Date(startOverride) : today;
            toDate = endOverride ? new Date(endOverride) : fromDate;
        }

        let fromTime, toTime;
        switch (shift) {
            case "ES": fromTime = "06-00"; toTime = "15-00"; break;
            case "TW": fromTime = "11-30"; toTime = "20-30"; break;
            case "NS": fromTime = "20-30"; toTime = "06-00"; break;
        }

        if (fromDateInput && toDateInput && fromTimeSelect && toTimeSelect) {
            fromDateInput.value = formatDateForInput(fromDate);
            toDateInput.value = formatDateForInput(toDate);
            setDropdownSafe(fromTimeSelect, fromTime);
            setDropdownSafe(toTimeSelect, toTime);
            setTimeout(triggerFilter, 300);
        }
    }

    function setRowsTo100() {
        const selector = document.querySelector('select[name="dashboard_length"]');
        if (selector && selector.value !== '100') {
            selector.value = '100';
            selector.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    document.querySelectorAll('.shiftBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            setShift(btn.dataset.shift);
            setRowsTo100();
        });
    });

    window.addEventListener('load', () => setTimeout(setRowsTo100, 500));
})();
