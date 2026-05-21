const START_HOUR = 20; // 20:00
const HOURS_COUNT = 14;
const BLOCKS_PER_HOUR = 12; // 5-min blocks
const TOTAL_BLOCKS = HOURS_COUNT * BLOCKS_PER_HOUR;

let diaryData = {};
let isDragging = false;
let dragMode = false; // true to set sleep, false to clear
let currentContextMenuCell = null;
let activeDateStr = null;

const headerRow = document.getElementById('gridHeaderRow');
const gridBody = document.getElementById('gridBody');
const contextMenu = document.getElementById('contextMenu');
const setBedTimeBtn = document.getElementById('setBedTimeBtn');
const setWakeTimeBtn = document.getElementById('setWakeTimeBtn');
const clearMarkerBtn = document.getElementById('clearMarkerBtn');

// Initialize Application
function init() {
    activeDateStr = formatDate(new Date());
    
    timeTooltip = document.createElement('div');
    timeTooltip.id = 'timeTooltip';
    timeTooltip.className = 'time-tooltip';
    timeTooltip.style.display = 'none';
    document.body.appendChild(timeTooltip);

    loadData();
    renderGridHeader();
    renderGridBody();
}

// Generate Date string YYYY-MM-DD
function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Generate Display Date string DD/MM/YYYY
function formatDisplayDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

// Load data from LocalStorage
function loadData() {
    const stored = localStorage.getItem('diariSonData');
    if (stored) {
        try {
            diaryData = JSON.parse(stored);
        } catch (e) {
            console.error("Error parsing localStorage data", e);
            diaryData = {};
        }
    }
}

// Save data to LocalStorage
function saveData() {
    localStorage.setItem('diariSonData', JSON.stringify(diaryData));
}

// Render Header Hours
function renderGridHeader() {
    // Insert after "Data" column
    const dataCol = headerRow.children[0];
    for (let i = 0; i < HOURS_COUNT; i++) {
        let h = (START_HOUR + i) % 24;
        const cell = document.createElement('div');
        cell.className = 'hour-header-cell';
        cell.textContent = `${String(h).padStart(2, '0')}:00`;
        headerRow.insertBefore(cell, headerRow.children[i + 1]);
    }
}

// Render the last 30 days
function renderGridBody() {
    gridBody.innerHTML = '';
    const today = new Date();
    
    // Render from oldest to newest or newest to oldest?
    // Let's do newest to oldest (top to bottom)
    for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = formatDate(d);
        
        if (!diaryData[dateStr]) {
            diaryData[dateStr] = {
                sleepBlocks: new Array(TOTAL_BLOCKS).fill(false),
                bedTimeIndex: -1,
                wakeTimeIndex: -1,
                meds: ""
            };
        }
        
        const row = createDayRow(dateStr);
        gridBody.appendChild(row);
        updateSummary(dateStr, row);
    }
}

function createDayRow(dateStr) {
    const row = document.createElement('div');
    row.className = 'grid-row';
    if (dateStr === activeDateStr) {
        row.classList.add('active-day');
    }
    row.dataset.date = dateStr;

    row.addEventListener('mousedown', () => {
        if (activeDateStr !== dateStr) {
            document.querySelectorAll('.grid-row').forEach(r => r.classList.remove('active-day'));
            row.classList.add('active-day');
            activeDateStr = dateStr;
        }
    });

    // Date Cell
    const dateCell = document.createElement('div');
    dateCell.className = 'grid-cell cell-date sticky-col';
    dateCell.textContent = formatDisplayDate(dateStr);
    row.appendChild(dateCell);

    // Time blocks
    const dayData = diaryData[dateStr];
    for (let i = 0; i < TOTAL_BLOCKS; i++) {
        const block = document.createElement('div');
        block.className = 'grid-cell cell-timeblock';
        block.dataset.date = dateStr;
        block.dataset.index = i;
        
        if (dayData.sleepBlocks[i]) {
            block.classList.add('is-sleeping');
        }

        renderMarkers(block, dayData, i);

        // Drag events
        block.addEventListener('mousedown', handleMouseDown);
        block.addEventListener('mouseenter', handleMouseEnter);
        
        // Context menu
        block.addEventListener('contextmenu', handleContextMenu);
        
        // Tooltip events
        block.addEventListener('mouseover', handleMouseOver);
        block.addEventListener('mousemove', handleMouseMove);
        block.addEventListener('mouseleave', handleMouseLeave);

        row.appendChild(block);
    }

    // Summaries
    const nightCell = document.createElement('div');
    nightCell.className = 'grid-cell cell-summary night-summary';
    row.appendChild(nightCell);

    // Medication
    const medCell = document.createElement('div');
    medCell.className = 'grid-cell cell-meds';
    const medInput = document.createElement('input');
    medInput.type = 'text';
    medInput.className = 'meds-input';
    medInput.value = dayData.meds || "";
    medInput.placeholder = "Escriu aquí...";
    medInput.addEventListener('change', (e) => {
        diaryData[dateStr].meds = e.target.value;
        saveData();
    });
    medCell.appendChild(medInput);
    row.appendChild(medCell);

    return row;
}

function renderMarkers(block, dayData, index) {
    block.innerHTML = '';
    if (dayData.bedTimeIndex === index) {
        const m = document.createElement('div');
        m.className = 'marker';
        m.textContent = '↓';
        block.appendChild(m);
    }
    if (dayData.wakeTimeIndex === index) {
        const m = document.createElement('div');
        m.className = 'marker';
        m.textContent = '↑';
        block.appendChild(m);
    }
}

// Drag logic
function handleMouseDown(e) {
    if (e.button !== 0) return; // Only left click
    isDragging = true;
    const cell = e.currentTarget;
    dragMode = !cell.classList.contains('is-sleeping');
    toggleCell(cell);
}

function handleMouseEnter(e) {
    if (!isDragging) return;
    toggleCell(e.currentTarget);
}

function toggleCell(cell) {
    const dateStr = cell.dataset.date;
    const idx = parseInt(cell.dataset.index);
    
    if (dragMode) {
        cell.classList.add('is-sleeping');
        diaryData[dateStr].sleepBlocks[idx] = true;
    } else {
        cell.classList.remove('is-sleeping');
        diaryData[dateStr].sleepBlocks[idx] = false;
    }
    
    updateSummary(dateStr, cell.parentElement);
}

// Tooltip logic
let timeTooltip;

function handleMouseOver(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    let h = Math.floor(idx / 12) + START_HOUR;
    h = h % 24;
    let m = String((idx % 12) * 5).padStart(2, '0');
    
    timeTooltip.textContent = `${String(h).padStart(2,'0')}:${m}`;
    timeTooltip.style.display = 'block';
}

function handleMouseMove(e) {
    timeTooltip.style.left = `${e.pageX}px`;
    timeTooltip.style.top = `${e.pageY - 15}px`;
}

function handleMouseLeave(e) {
    timeTooltip.style.display = 'none';
}


// Global mouse up
document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        saveData();
    }
});

// Summary calculation
function updateSummary(dateStr, row) {
    const dayData = diaryData[dateStr];
    let nightBlocks = 0;

    for (let i = 0; i < TOTAL_BLOCKS; i++) {
        if (dayData.sleepBlocks[i]) {
            nightBlocks++;
        }
    }

    const nightSummary = row.querySelector('.night-summary');
    
    nightSummary.textContent = (nightBlocks / 12).toFixed(2) + 'h';
}

// Context Menu
function handleContextMenu(e) {
    e.preventDefault();
    currentContextMenuCell = e.currentTarget;
    
    contextMenu.style.display = 'block';
    
    // Position menu
    let x = e.pageX;
    let y = e.pageY;
    
    if (x + contextMenu.offsetWidth > window.innerWidth) {
        x -= contextMenu.offsetWidth;
    }
    if (y + contextMenu.offsetHeight > window.innerHeight) {
        y -= contextMenu.offsetHeight;
    }
    
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
}

document.addEventListener('click', (e) => {
    if (e.target.closest('.context-menu')) return;
    contextMenu.style.display = 'none';
    currentContextMenuCell = null;
});

function setMarker(type) {
    if (!currentContextMenuCell) return;
    const dateStr = currentContextMenuCell.dataset.date;
    const idx = parseInt(currentContextMenuCell.dataset.index);
    const dayData = diaryData[dateStr];

    if (type === 'bed') {
        dayData.bedTimeIndex = idx;
        if (dayData.wakeTimeIndex === idx) dayData.wakeTimeIndex = -1;
    } else if (type === 'wake') {
        dayData.wakeTimeIndex = idx;
        if (dayData.bedTimeIndex === idx) dayData.bedTimeIndex = -1;
    } else if (type === 'clear') {
        if (dayData.bedTimeIndex === idx) dayData.bedTimeIndex = -1;
        if (dayData.wakeTimeIndex === idx) dayData.wakeTimeIndex = -1;
    }

    saveData();
    // Re-render the row to update markers
    const row = currentContextMenuCell.parentElement;
    for (let i = 0; i < TOTAL_BLOCKS; i++) {
        const block = row.querySelectorAll('.cell-timeblock')[i];
        renderMarkers(block, dayData, i);
    }
    contextMenu.style.display = 'none';
}

setBedTimeBtn.addEventListener('click', () => setMarker('bed'));
setWakeTimeBtn.addEventListener('click', () => setMarker('wake'));
clearMarkerBtn.addEventListener('click', () => setMarker('clear'));

// Buttons Logic
document.getElementById('btnSave').addEventListener('click', () => {
    saveData();
    alert("Dades desades correctament!");
});

document.getElementById('btnExportJSON').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(diaryData));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "diari_son_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

document.getElementById('inputImportJSON').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const imported = JSON.parse(evt.target.result);
            diaryData = imported;
            saveData();
            renderGridBody();
            alert("Còpia de seguretat carregada correctament.");
        } catch (err) {
            alert("Error al carregar el fitxer JSON.");
        }
    };
    reader.readAsText(file);
});

document.getElementById('btnExportPDF').addEventListener('click', () => {
    const element = document.getElementById('diaryGrid');
    
    const opt = {
      margin:       [0.5, 0.5, 0.5, 0.5],
      filename:     'diari_son.pdf',
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'in', format: 'a3', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(element).save();
});

document.getElementById('btnExportCSV').addEventListener('click', () => {
    let csvContent = "Data,Llit (↓),Aixecar (↑),Hores Nit,Medicació\n";
    
    Object.keys(diaryData).sort((a,b) => b.localeCompare(a)).forEach(dateStr => {
        const dayData = diaryData[dateStr];
        
        let bedTimeStr = "";
        if (dayData.bedTimeIndex >= 0) {
            let h = Math.floor(dayData.bedTimeIndex / 12) + START_HOUR;
            h = h % 24;
            let mIndex = dayData.bedTimeIndex % 12;
            let m = String(mIndex * 5).padStart(2, '0');
            bedTimeStr = `${String(h).padStart(2,'0')}:${m}`;
        }
        
        let wakeTimeStr = "";
        if (dayData.wakeTimeIndex >= 0) {
            let h = Math.floor(dayData.wakeTimeIndex / 12) + START_HOUR;
            h = h % 24;
            let mIndex = dayData.wakeTimeIndex % 12;
            let m = String(mIndex * 5).padStart(2, '0');
            wakeTimeStr = `${String(h).padStart(2,'0')}:${m}`;
        }

        let nightBlocks = 0;
        for (let i = 0; i < TOTAL_BLOCKS; i++) {
            if (dayData.sleepBlocks[i]) {
                nightBlocks++;
            }
        }
        
        let medsStr = `"${(dayData.meds || "").replace(/"/g, '""')}"`;
        
        csvContent += `${formatDisplayDate(dateStr)},${bedTimeStr},${wakeTimeStr},${(nightBlocks / 12).toFixed(2)},${medsStr}\n`;
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], {type: "text/csv;charset=utf-8"}); // BOM for excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "diari_son.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

document.getElementById('btnQuickFill').addEventListener('click', () => {
    if (!activeDateStr || !diaryData[activeDateStr]) return;
    
    const dayData = diaryData[activeDateStr];
    
    // Bed Time: 23:00 -> index 36 (3 hours * 12)
    dayData.bedTimeIndex = 36;
    // Wake Time: 06:00 -> index 120 (10 hours * 12)
    dayData.wakeTimeIndex = 120;
    
    // Sleep blocks: from index 36 to 119
    dayData.sleepBlocks.fill(false);
    for (let i = 36; i < 120; i++) {
        dayData.sleepBlocks[i] = true;
    }
    
    // Medication
    dayData.meds = "Deprax (22:00), Quviviq (22:30)";
    
    saveData();
    renderGridBody(); // re-render to show changes
});

// Start
init();
