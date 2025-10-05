import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, LineStyle, Time } from 'lightweight-charts';
import { formatPrice } from '@/utils/formatters';
import { getCachedChart, cacheChart } from '@/utils/priceCache';

type Position = {
  id: number;
  asset: { id: string; name: string; icon: string; price: number; change: number };
  side: 'LONG' | 'SHORT';
  size: number;
  collateral: number;
  entryPrice: number;
  liqPrice: number;
  pnl: number;
};

interface TradingChartProps {
  asset: {
    id: string;
    name: string;
    icon: string;
    price: number;
    change: number;
  };
  currentPrice: number;
  positions: Position[];
}

const TradingChart: React.FC<TradingChartProps> = ({ asset, currentPrice, positions }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const priceLineRefsRef = useRef<any[]>([]);
  const [historicalData, setHistoricalData] = useState<Array<{ time: Time; value: number }>>([]);
  const [timeframe, setTimeframe] = useState<'1m' | '15m' | '30m'>('1m');

  // Timeframe configurations
  const timeframeConfigs = {
    '1m': { interval: '1m', limit: 180, label: '1min' },
    '15m': { interval: '15m', limit: 96, label: '15min' },  // 96 * 15min = 24 hours
    '30m': { interval: '30m', limit: 48, label: '30min' },  // 48 * 30min = 24 hours
  };

  // Fetch real historical data from backend with INSTANT cache-first loading
  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        const config = timeframeConfigs[timeframe];

        // INSTANT LOAD: Try cache first for instant chart display
        const cached = getCachedChart(asset.id, timeframe);
        if (cached && cached.data) {
          // Filter, convert, sort, and deduplicate cached data
          const chartData = cached.data
            .filter((point: any) => {
              return point &&
                     typeof point.timestamp === 'number' &&
                     point.timestamp > 0 &&
                     typeof point.close === 'number' &&
                     !isNaN(point.close) &&
                     point.close > 0;
            })
            .map((point: any) => ({
              time: Math.floor(point.timestamp / 1000) as Time,
              value: point.close,
            }))
            .sort((a: { time: Time; value: number }, b: { time: Time; value: number }) => (a.time as number) - (b.time as number)) // Sort by time ascending
            .filter((point: { time: Time; value: number }, index: number, arr: { time: Time; value: number }[]) => {
              // Remove duplicates
              if (index === 0) return true;
              return point.time !== arr[index - 1].time;
            });

          if (chartData.length > 0) {
            setHistoricalData(chartData);
          } else {
            setHistoricalData([]);
          }
        } else {
          // Clear old data if no cache
          setHistoricalData([]);
        }

        // BACKGROUND REFRESH: Fetch fresh data
        const response = await fetch(
          `https://claerdex-backend.vercel.app/prices/history?asset=${asset.id}&interval=${config.interval}&limit=${config.limit}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.data || result.data.length === 0) {
          throw new Error('No data received from backend');
        }

        // Cache the fresh data for next instant load
        cacheChart(asset.id, timeframe, result.data);

        // Convert backend format to chart format and filter out invalid data
        const chartData = result.data
          .filter((point: any) => {
            // Filter out points with invalid values
            return point &&
                   typeof point.timestamp === 'number' &&
                   point.timestamp > 0 &&
                   typeof point.close === 'number' &&
                   !isNaN(point.close) &&
                   point.close > 0;
          })
          .map((point: any) => ({
            time: Math.floor(point.timestamp / 1000) as Time,
            value: point.close,
          }))
          .sort((a: { time: Time; value: number }, b: { time: Time; value: number }) => (a.time as number) - (b.time as number)) // CRITICAL: Sort by time ascending
          .filter((point: { time: Time; value: number }, index: number, arr: { time: Time; value: number }[]) => {
            // Remove duplicates - keep only first occurrence of each timestamp
            if (index === 0) return true;
            return point.time !== arr[index - 1].time;
          });

        if (chartData.length === 0) {
          console.error('[CHART] ✗ No valid data points after filtering!');
          return;
        }

        setHistoricalData(chartData);
      } catch (error) {
        console.error(`[CHART] ✗ Failed to fetch historical data:`, error);
        // Keep cached data if fetch fails, or show empty
      }
    };

    fetchHistoricalData();
  }, [asset, timeframe]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Set precision based on asset price - AE needs more decimals due to low price
    const precision = asset.id === 'AE' ? 4 : 2;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.1)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.1)' },
      },
      rightPriceScale: {
        borderColor: '#334155',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: '#64748b',
          style: LineStyle.Dashed,
        },
        horzLine: {
          width: 1,
          color: '#64748b',
          style: LineStyle.Dashed,
        },
      },
    });

    const series = chart.addAreaSeries({
      topColor: asset.change >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
      bottomColor: asset.change >= 0 ? 'rgba(16, 185, 129, 0.0)' : 'rgba(244, 63, 94, 0.0)',
      lineColor: asset.change >= 0 ? '#10b981' : '#f43f5e',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: precision,
        minMove: asset.id === 'AE' ? 0.0001 : 0.01, // Smaller price movements for AE
      },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [asset]);

  // Update series data
  useEffect(() => {
    if (!seriesRef.current || !historicalData || historicalData.length === 0) {
      return;
    }

    try {
      // Validate, sort, and deduplicate all data points before setting
      const validData = historicalData
        .filter(point => {
          return point &&
                 typeof point.time === 'number' &&
                 typeof point.value === 'number' &&
                 !isNaN(point.value) &&
                 point.value !== null &&
                 point.value !== undefined &&
                 point.value > 0 &&
                 point.time > 0;
        })
        .sort((a: { time: Time; value: number }, b: { time: Time; value: number }) => (a.time as number) - (b.time as number)) // Ensure ascending order
        .filter((point: { time: Time; value: number }, index: number, arr: { time: Time; value: number }[]) => {
          // Remove duplicates - lightweight-charts doesn't allow duplicate times
          if (index === 0) return true;
          return point.time !== arr[index - 1].time;
        });

      if (validData.length === 0) {
        console.error('[CHART] ✗ No valid data points to set after filtering!');
        return;
      }

      // Defensive: Clear series completely before setting new data
      try {
        seriesRef.current.setData([]);
      } catch (clearError) {
        // Ignore clear errors
      }

      // Small delay to ensure clear completed
      setTimeout(() => {
        if (!seriesRef.current) return;

        try {
          // Set new data
          seriesRef.current.setData(validData);

          // Fit chart to content after data is set
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }
        } catch (setError) {
          console.error('[CHART] ✗ CRITICAL ERROR setting chart data:', setError);
          console.error('[CHART] ✗ Data that caused error:', validData.slice(0, 5), '...', validData.slice(-5));
        }
      }, 10);

    } catch (error) {
      console.error('[CHART] ✗ Error in setData useEffect:', error);
      console.error('[CHART] ✗ Original data:', historicalData.slice(0, 5));
    }
  }, [historicalData]);

  // Update with live price
  useEffect(() => {
    if (!seriesRef.current || historicalData.length === 0) return;

    // Validate current price before updating
    if (typeof currentPrice !== 'number' || isNaN(currentPrice) || currentPrice <= 0) {
      return;
    }

    const now = Math.floor(Date.now() / 1000) as Time;

    // Check if this timestamp already exists in our data (would cause duplicate error)
    const lastPoint = historicalData[historicalData.length - 1];
    if (lastPoint && lastPoint.time === now) {
      // Skip update - same timestamp as last point
      return;
    }

    const newDataPoint = { time: now, value: currentPrice };

    try {
      seriesRef.current.update(newDataPoint);
    } catch (error) {
      console.error('[CHART] ✗ Error updating live price:', error, newDataPoint);
      console.error('[CHART] ✗ Last historical point:', lastPoint);
    }
  }, [currentPrice, historicalData]);

  // Draw position lines
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;

    // Remove all existing price lines
    priceLineRefsRef.current.forEach(line => {
      try {
        seriesRef.current?.removePriceLine(line);
      } catch (e) {
        // Line might already be removed
      }
    });
    priceLineRefsRef.current = [];

    // Filter positions for the current asset only
    const assetPositions = positions.filter(p => p.asset.id === asset.id);

    assetPositions.forEach((position) => {
      // Entry price line
      const entryLine = seriesRef.current!.createPriceLine({
        price: position.entryPrice,
        color: position.side === 'LONG' ? '#10b981' : '#f43f5e',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `${position.side} Entry`,
      });

      // Liquidation price line
      const liqLine = seriesRef.current!.createPriceLine({
        price: position.liqPrice,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Liq',
      });

      // Store refs for cleanup
      priceLineRefsRef.current.push(entryLine, liqLine);
    });
  }, [positions, asset.id]);

  return (
    <div className="relative">
      {/* Timeframe Selector */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        {Object.entries(timeframeConfigs).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setTimeframe(key as '1m' | '15m' | '30m')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              timeframe === key
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-300 border border-slate-700'
            }`}
          >
            {config.label}
          </button>
        ))}
      </div>

      {/* Position Legend - Only show positions for current asset */}
      {positions.filter(p => p.asset.id === asset.id).length > 0 && (
        <div className="absolute top-4 right-4 z-10 bg-slate-900/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700 max-w-xs">
          <p className="text-xs text-slate-400 mb-1">Active Positions</p>
          {positions.filter(p => p.asset.id === asset.id).map((pos) => (
            <div key={pos.id} className="flex items-center gap-2 text-xs mb-1">
              <div className={`w-2 h-2 rounded-full ${pos.side === 'LONG' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className="text-slate-300">
                {pos.side} {pos.asset.id} @ {formatPrice(pos.entryPrice)}
              </span>
              <span className={pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full h-full" style={{ minHeight: '500px' }} />
    </div>
  );
};

export default TradingChart;
