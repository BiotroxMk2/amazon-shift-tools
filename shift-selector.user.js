// ==UserScript==
// @name         Dock Page - Shift Selector
// @namespace    amazon-shift-filter
// @version      1.6.9
// @description  Adds shift selector to IB/OB dock pages with calendar date, smart NS logic, persistent UI
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
            <button class="shiftBtn" data-shift="ES">Early</button>
            <button class="shiftBtn" data-shift="TW">Twilight</button>
            <button class="shiftBtn" data-shift="NS">Night</button>
        </div>
    `;
    document.body.appendChild(container);

    const toggle = document.getElementById("shiftSelectorToggle");
    const box = document.getElementById("shiftSelectorBox");
    const startInput = document.querySelector('#startDateInput');

    toggle.addEventListener("click", () => {
        box.style.display = box.style.display === "none" ? "block" : "none";
    });

    function getSystemDate() {
        const now = new Date();
        return now.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    function formatDateForSSP(dateObj) {
        return `${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getDate().toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
    }

    function setDropdownSafe(select, value) {
        if (!select) return;
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

    function getManualOrSystemDate() {
        return startInput.value ? new Date(startInput.value) : new Date();
    }

    function setShift(shift) {
        const fromDateInput = document.querySelector('input[dataname="FromDate"]');
        const toDateInput = document.querySelector('input[dataname="ToDate"]');
        const fromTimeSelect = document.querySelector('select[dataname="fromTime"]');
        const toTimeSelect = document.querySelector('select[dataname="toTime"]');

        let fromDate = getManualOrSystemDate();
        const now = new Date();

        if (!startInput.value) {
            if (shift === "NS" && now.getHours() < 6) {
                fromDate.setDate(fromDate.getDate() - 1);
            }
        }

        const toDate = new Date(fromDate);
        if (shift === "NS") toDate.setDate(fromDate.getDate() + 1);

        let fromTime, toTime;
        switch (shift) {
            case "ES": fromTime = "06-00"; toTime = "15-00"; break;
            case "TW": fromTime = "11-30"; toTime = "20-30"; break;
            case "NS": fromTime = "20-30"; toTime = "06-00"; break;
        }

        if (fromDateInput && toDateInput) {
            fromDateInput.value = formatDateForSSP(fromDate);
            toDateInput.value = formatDateForSSP(toDate);
        }

        setDropdownSafe(fromTimeSelect, fromTime);
        setDropdownSafe(toTimeSelect, toTime);
        setTimeout(triggerFilter, 300);

        startInput.value = fromDate.toISOString().split('T')[0];
    }

    function setRowsTo100() {
        const selector = document.querySelector('select[name="dashboard_length"]');
        if (selector && selector.value !== '100') {
            selector.value = '100';
            selector.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    document.getElementById("clearDatesBtn").addEventListener("click", () => {
        const today = getSystemDate();
        startInput.value = today;
    });

    document.querySelectorAll('.shiftBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            setShift(btn.dataset.shift);
            setRowsTo100();
        });
    });

    window.addEventListener('load', () => {
        setTimeout(() => {
            startInput.value = getSystemDate();
            setRowsTo100();
        }, 400);
    });
})();
