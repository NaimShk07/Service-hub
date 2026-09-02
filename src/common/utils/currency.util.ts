export function toSmallestCurrencyUnit(
  amount: number | string | { toString(): string },
  currency = "INR",
) {
  const numAmount =
    typeof amount === "number"
      ? amount
      : typeof amount === "string"
        ? parseFloat(amount)
        : parseFloat(amount.toString());

  if (isNaN(numAmount)) {
    throw new Error(`Invalid amount: ${amount.toString()}`);
  }

  switch (currency) {
    case "INR":
    case "USD":
    case "EUR":
    case "GBP":
      return Math.round(numAmount * 100);
    case "JPY":
      return Math.round(numAmount); // Zero-decimal currency
    default:
      return Math.round(numAmount * 100);
  }
}

export function fromSmallestCurrencyUnit(
  amountInSmallestUnit: number,
  currency = "INR",
) {
  switch (currency.toUpperCase()) {
    case "INR":
    case "USD":
    case "EUR":
    case "GBP":
      return amountInSmallestUnit / 100;
    case "JPY":
      return amountInSmallestUnit;
    default:
      return amountInSmallestUnit / 100;
  }
}
