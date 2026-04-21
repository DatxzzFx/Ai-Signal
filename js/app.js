// Global Variables
let socket;
let currentSignal = null;
let signalHistory = [];
let priceChart = null;
let settings = {
    risk: 2,
    rrRatio: 2,
    interval: 5,
    autoTrade: true
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initWebSocket();
    startAutoUpdate();
    initChart();
});

// WebSocket Connection
function initWebSocket() {
    socket = io('http://localhost:3000', {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
    });

    socket.on('connect', () => {
        console.log('Connected to server');
        updateStatus(true);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateStatus(false);
    });

    socket.on('signal', (data) => {
        handleNewSignal(data);
    });

    socket.on('price_update', (data) => {
        updatePriceChart(data);
    });

    socket.on('error', (error) => {
        showNotification('Error: ' + error, 'error');
    });
}

// Update Status
function updateStatus(connected) {
    const indicator = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');
    
    if (connected) {
        indicator.classList.add('connected');
        text.textContent = 'Connected';
    } else {
        indicator.classList.remove('connected');
        text.textContent = 'Disconnected';
    }
}

// Handle New Signal
function handleNewSignal(signal) {
    currentSignal = signal;
    
    // Update Signal Display
    const signalType = document.getElementById('signal-type');
    signalType.textContent = signal.type.toUpperCase();
    signalType.className = 'signal-type ' + signal.type.toLowerCase();
    
    document.getElementById('signal-price').textContent = signal.entry.toFixed(2);
    document.getElementById('tp-value').textContent = signal.tp.toFixed(2);
    document.getElementById('sl-value').textContent = signal.sl.toFixed(2);
    document.getElementById('rr-value').textContent = signal.rr.toFixed(2) + ':1';
    document.getElementById('signal-note').textContent = signal.note;
    
    // Add to History
    addToHistory(signal);
    
    // Update Stats
    updateStats();
    
    // Show Notification
    showNotification(`${signal.type.toUpperCase()} Signal: ${signal.entry.toFixed(2)} | TP: ${signal.tp.toFixed(2)} | SL: ${signal.sl.toFixed(2)}`);
    
    // Auto Trade
    if (settings.autoTrade) {
        executeTrade(signal);
    }
}

// Add to History
function addToHistory(signal) {
    signalHistory.unshift({
        time: new Date().toLocaleTimeString(),
        signal: signal.type,
        entry: signal.entry,
        tp: signal.tp,
        sl: signal.sl,
        rr: signal.rr,
        status: 'pending',
        note: signal.note
    });

    // Keep only last 50 signals
    if (signalHistory.length > 50) {
        signalHistory.pop();
    }

    updateHistoryTable();
}

// Update History Table
function updateHistoryTable() {
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = '';

    signalHistory.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.time}</td>
            <td><strong>${item.signal}</strong></td>
            <td>${item.entry.toFixed(2)}</td>
            <td>${item.tp.toFixed(2)}</td>
            <td>${item.sl.toFixed(2)}</td>
            <td>${item.rr.toFixed(2)}:1</td>
            <td><span class="status-${item.status}">${item.status.toUpperCase()}</span></td>
            <td>${item.note}</td>
        `;
        tbody.appendChild(row);
    });
}

// Update Stats
function updateStats() {
    const today = signalHistory.filter(s => {
        const date = new Date(s.time);
        const today = new Date();
        return date.toDateString() === today.toDateString();
    });

    document.getElementById('today-signals').textContent = today.length;

    const wins = signalHistory.filter(s => s.status === 'win').length;
    const winRate = signalHistory.length > 0 ? ((wins / signalHistory.length) * 100).toFixed(1) : 0;
    document.getElementById('win-rate').textContent = winRate + '%';

    const totalProfit = signalHistory.reduce((sum, s) => {
        if (s.status === 'win') return sum + (s.rr * settings.risk);
        if (s.status === 'loss') return sum - settings.risk;
        return sum;
    }, 0);
    document.getElementById('total-profit').textContent = '$' + totalProfit.toFixed(2);

    const active = signalHistory.filter(s => s.status === 'pending').length;
    document.getElementById('active-trades').textContent = active;
}

// Execute Trade
function executeTrade(signal) {
    console.log('Executing trade:', signal);
    // Integrate with your broker API here
    // Example: Send to MT4/MT5 via API
}

// Update Price Chart
function updatePriceChart(data) {
    if (!priceChart) return;

    priceChart.data.labels.push(data.time);
    priceChart.data.datasets[0].data.push(data.price);

    // Keep only last 50 data points
    if (priceChart.data.labels.length > 50) {
        priceChart.data.labels.shift();
        priceChart.data.datasets[0].data.shift();
    }

    priceChart.update('none');
}

// Initialize Chart
function initChart() {
    const ctx = document.getElementById('priceChart').getContext('2d');
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'XAUUSD Price',
                data: [],
                borderColor: '#00d4ff',
                backgroundColor: 'rgba(0, 212, 255, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#eaeaea' }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#aaa' }
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#aaa' }
                }
            }
        }
    });
}

// Auto Update
function startAutoUpdate() {
    setInterval(() => {
        if (socket && socket.connected) {
            socket.emit('request_signal');
        }
    }, settings.interval * 1000);
}

// Settings
function saveSettings() {
    settings.risk = parseFloat(document.getElementById('risk-input').value);
    settings.rrRatio = parseFloat(document.getElementById('rr-input').value);
    settings.interval = parseFloat(document.getElementById('interval-input').value);
    settings.autoTrade = document.getElementById('auto-trade').checked;

    localStorage.setItem('settings', JSON.stringify(settings));
    showNotification('Settings saved!');
}

function loadSettings() {
    const saved = localStorage.getItem('settings');
    if (saved) {
        settings = JSON.parse(saved);
        document.getElementById('risk-input').value = settings.risk;
        document.getElementById('rr-input').value = settings.rrRatio;
        document.getElementById('interval-input').value = settings.interval;
        document.getElementById('auto-trade').checked = settings.autoTrade;
    }
}

// Notification
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification show ' + type;

    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Update Signal Time
setInterval(() => {
    document.getElementById('signal-time').textContent = new Date().toLocaleTimeString();
}, 1000);
