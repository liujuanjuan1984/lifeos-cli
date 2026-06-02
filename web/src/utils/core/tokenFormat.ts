const tokenNumberFormatter = new Intl.NumberFormat();

export const formatTokens = (value: number): string => {
  return tokenNumberFormatter.format(Math.max(0, Math.floor(value)));
};
