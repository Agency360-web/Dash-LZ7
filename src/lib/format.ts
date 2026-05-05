export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

export const safeDivide = (a: number, b: number): number | null => {
  if (!b || !Number.isFinite(b)) return null;
  return a / b;
};

export const formatBRLOrNA = (value: number | null) =>
  value === null ? "N/A" : formatBRL(value);

export const formatInt = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(Math.round(value || 0));