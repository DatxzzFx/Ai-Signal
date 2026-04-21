// api/signal.js
import axios from 'axios';

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'FAJYYN44RH92TFCS';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { risk = 2, rrRatio = 2 } = req.query;

        // Fetch price data
        const priceResponse = await axios.get(
            `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=XAU&to_symbol=USD&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`
        );

        if (!priceResponse.data['Time Series FX (Daily)']) {
            return res.status(200).json({
                signal: null,
                message: 'Insufficient data',
                simulated: true
            });
        }

        const timeSeries = priceResponse.data['Time Series FX (Daily)'];
        const prices = Object.values(timeSeries).slice(0, 100).map(d => parseFloat(d['4. close'])).reverse();

        // Calculate indicators
        const rsi = calculateRSI(prices);
        const macd = calculateMACD(prices);
        const bb = calculateBollingerBands(prices);
        const trend = analyzeTrend(prices);
        const currentPrice = prices[prices.length - 1];

        let signal = null;

        // BUY Signal
        if (rsi < 35 && macd.histogram > 0 && currentPrice < bb.lower && trend === 'uptrend') {
            const atr = calculateATR(prices);
            const sl = currentPrice - (atr * 1.5);
            const tp = currentPrice + ((currentPrice - sl) * rrRatio);
            const riskAmount = (risk / 100) * 10000;

            signal = {
                type: 'buy',
                entry: currentPrice,
                tp: tp,
                sl: sl,
                rr: rrRatio,
                riskAmount: riskAmount,
                note: '🟢 Oversold + MACD Bullish + Below BB Lower Band + Uptrend'
            };
        }

        // SELL Signal
        if (rsi > 65 && macd.histogram < 0 && currentPrice > bb.upper && trend === 'downtrend') {
            const atr = calculateATR(prices);
            const sl = currentPrice + (atr * 1.5);
            const tp = currentPrice - ((sl - currentPrice) * rrRatio);
            const riskAmount = (risk / 100) * 10000;

            signal = {
                type: 'sell',
                entry: currentPrice,
                tp: tp,
                sl: sl,
                rr: rrRatio,
                riskAmount: riskAmount,
                note: '🔴 Overbought + MACD Bearish + Above BB Upper Band + Downtrend'
            };
        }

        return res.status(200).json({
            signal: signal,
            indicators: { rsi, macd, bb, trend },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error generating signal:', error);
        return res.status(500).json({ error: error.message });
    }
}

// Helper functions
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;

    const gains = [];
    const losses = [];

    for (let i = 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? Math.abs(diff) : 0);
    }

    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function calculateMACD(prices) {
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macdLine = ema12 - ema26;

    const macdHistory = [];
    for (let i = 0; i < prices.length; i++) {
        const e12 = calculateEMA(prices.slice(0, i + 1), 12);
        const e26 = calculateEMA(prices.slice(0, i + 1), 26);
        macdHistory.push(e12 - e26);
    }

    const signalLine = calculateEMA(macdHistory, 9);
    return {
        macdLine,
        signalLine,
        histogram: macdLine - signalLine
    };
}

function calculateEMA(data, period) {
    if (data.length === 0) return 0;
    const multiplier = 2 / (period + 1);
    let ema = data[0];

    for (let i = 1; i < data.length; i++) {
        ema = (data[i] * multiplier) + (ema * (1 - multiplier));
    }
    return ema;
}

function calculateBollingerBands(prices, period = 20) {
    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((a, b) => a + b, 0) / period;
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    return {
        upper: sma + (stdDev * 2),
        middle: sma,
        lower: sma - (stdDev * 2)
    };
}

function calculateATR(prices, period = 14) {
    if (prices.length < period) return 0;

    let trueRanges = [];
    for (let i = 1; i < prices.length; i++) {
        const tr = Math.abs(prices[i] - prices[i - 1]);
        trueRanges.push(tr);
    }

    const atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
    return atr;
}

function analyzeTrend(prices) {
    if (prices.length < 20) return 'neutral';

    const recentPrices = prices.slice(-20);
    const ema20 = calculateEMA(recentPrices, 20);
    const currentPrice = prices[prices.length - 1];

    if (currentPrice > ema20) {
        return 'uptrend';
    } else if (currentPrice < ema20) {
        return 'downtrend';
    }

    return 'neutral';
}
