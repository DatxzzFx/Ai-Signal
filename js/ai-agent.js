class AIAgent {
    constructor() {
        this.rsiPeriod = 14;
        this.macdFastPeriod = 12;
        this.macdSlowPeriod = 26;
        this.macdSignalPeriod = 9;
        this.bbPeriod = 20;
        this.bbStdDev = 2;
        this.priceHistory = [];
        this.maxHistorySize = 200;
    }

    // Add Price Data
    addPrice(price, timestamp) {
        this.priceHistory.push({
            price: parseFloat(price),
            time: timestamp
        });

        if (this.priceHistory.length > this.maxHistorySize) {
            this.priceHistory.shift();
        }
    }

    // Generate Signal
    generateSignal(currentPrice, risk = 2, rrRatio = 2) {
        if (this.priceHistory.length < 50) {
            return null;
        }

        const rsi = this.calculateRSI();
        const macd = this.calculateMACD();
        const bb = this.calculateBollingerBands();
        const trend = this.analyzeTrend();
        const atr = this.calculateATR();

        let signal = null;

        // BUY Signal Conditions
        if (
            rsi < 35 && 
            macd.histogram > 0 && 
            currentPrice < bb.lower && 
            trend === 'uptrend'
        ) {
            const sl = currentPrice - (atr * 1.5);
            const slDistance = currentPrice - sl;
            const tp = currentPrice + (slDistance * rrRatio);
            const riskAmount = (risk / 100) * 10000; // Assuming $10k account

            signal = {
                type: 'buy',
                entry: currentPrice,
                tp: tp,
                sl: sl,
                rr: rrRatio,
                riskAmount: riskAmount,
                note: '🟢 Oversold + MACD Bullish + Below BB Lower Band + Uptrend',
                indicators: {
                    rsi: rsi,
                    macd: macd.histogram,
                    trend: trend
                }
            };
        }

        // SELL Signal Conditions
        if (
            rsi > 65 && 
            macd.histogram < 0 && 
            currentPrice > bb.upper && 
            trend === 'downtrend'
        ) {
            const sl = currentPrice + (atr * 1.5);
            const slDistance = sl - currentPrice;
            const tp = currentPrice - (slDistance * rrRatio);
            const riskAmount = (risk / 100) * 10000;

            signal = {
                type: 'sell',
                entry: currentPrice,
                tp: tp,
                sl: sl,
                rr: rrRatio,
                riskAmount: riskAmount,
                note: '🔴 Overbought + MACD Bearish + Above BB Upper Band + Downtrend',
                indicators: {
                    rsi: rsi,
                    macd: macd.histogram,
                    trend: trend
                }
            };
        }

        return signal;
    }

    // Calculate RSI
    calculateRSI() {
        if (this.priceHistory.length < this.rsiPeriod + 1) return 50;

        const prices = this.priceHistory.map(p => p.price);
        const gains = [];
        const losses = [];

        for (let i = 1; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            gains.push(diff > 0 ? diff : 0);
            losses.push(diff < 0 ? Math.abs(diff) : 0);
        }

        const avgGain = gains.slice(-this.rsiPeriod).reduce((a, b) => a + b, 0) / this.rsiPeriod;
        const avgLoss = losses.slice(-this.rsiPeriod).reduce((a, b) => a + b, 0) / this.rsiPeriod;

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));

        return isNaN(rsi) ? 50 : rsi;
    }

    // Calculate MACD
    calculateMACD() {
        const prices = this.priceHistory.map(p => p.price);
        
        const ema12 = this.calculateEMA(prices, this.macdFastPeriod);
        const ema26 = this.calculateEMA(prices, this.macdSlowPeriod);
        const macdLine = ema12 - ema26;

        const macdHistory = [];
        for (let i = 0; i < prices.length; i++) {
            const e12 = this.calculateEMA(prices.slice(0, i + 1), this.macdFastPeriod);
            const e26 = this.calculateEMA(prices.slice(0, i + 1), this.macdSlowPeriod);
            macdHistory.push(e12 - e26);
        }

        const signalLine = this.calculateEMA(macdHistory, this.macdSignalPeriod);
        const histogram = macdLine - signalLine;

        return {
            macdLine: macdLine,
            signalLine: signalLine,
            histogram: histogram
        };
    }

    // Calculate EMA
    calculateEMA(data, period) {
        if (data.length === 0) return 0;

        const multiplier = 2 / (period + 1);
        let ema = data[0];

        for (let i = 1; i < data.length; i++) {
            ema = (data[i] * multiplier) + (ema * (1 - multiplier));
        }

        return ema;
    }

    // Calculate Bollinger Bands
    calculateBollingerBands() {
        const prices = this.priceHistory.slice(-this.bbPeriod).map(p => p.price);
        
        const sma = prices.reduce((a, b) => a + b, 0) / prices.length;
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / prices.length;
        const stdDev = Math.sqrt(variance);

        return {
            upper: sma + (stdDev * this.bbStdDev),
            middle: sma,
            lower: sma - (stdDev * this.bbStdDev)
        };
    }

    // Calculate ATR (Average True Range)
    calculateATR(period = 14) {
        if (this.priceHistory.length < period) return 0;

        let trueRanges = [];
        
        for (let i = 1; i < this.priceHistory.length; i++) {
            const current = this.priceHistory[i].price;
            const previous = this.priceHistory[i - 1].price;
            
            const tr = Math.max(
                current - previous,
                Math.abs(current - previous),
                Math.abs(previous - current)
            );
            
            trueRanges.push(tr);
        }

        const atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
        return atr;
    }

    // Analyze Trend
    analyzeTrend() {
        if (this.priceHistory.length < 20) return 'neutral';

        const recentPrices = this.priceHistory.slice(-20).map(p => p.price);
        const ema20 = this.calculateEMA(recentPrices, 20);
        const currentPrice = recentPrices[recentPrices.length - 1];

        if (currentPrice > ema20) {
            return 'uptrend';
        } else if (currentPrice < ema20) {
            return 'downtrend';
        }

        return 'neutral';
    }
}
