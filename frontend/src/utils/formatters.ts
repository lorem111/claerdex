// Number formatting utilities for professional display

export const formatUSD = (value: number): string => {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatPrice = (value: number): string => {
  // For very small numbers (< 1), show more decimals
  if (value < 1) {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 6 })}`;
  }
  return formatUSD(value);
};

export const formatPnL = (value: number): string => {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${formatUSD(value)}`;
};

export const formatPercentage = (value: number): string => {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
};

export const formatAE = (value: number): string => {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AE`;
};

export const formatLeverage = (value: number): string => {
  return `${value}x`;
};
