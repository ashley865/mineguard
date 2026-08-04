// Validates a South African 13-digit ID number: YYMMDD SSSS C A Z, where Z is a Luhn
// checksum over the first 12 digits. Non-13-digit values are treated as a foreign
// passport number and only checked for a plausible alphanumeric shape.
export function isValidSaIdNumber(idNumber: string): boolean {
  const id = idNumber.trim();
  if (!/^\d{13}$/.test(id)) return false;

  const month = parseInt(id.slice(2, 4), 10);
  const day = parseInt(id.slice(4, 6), 10);
  const year = parseInt(id.slice(0, 2), 10);
  if (month < 1 || month > 12) return false;
  const fullYear = year <= new Date().getFullYear() % 100 ? 2000 + year : 1900 + year;
  const daysInMonth = new Date(fullYear, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return false;

  const digits = id.split("").map(Number);
  let oddSum = 0;
  for (let i = 0; i < 12; i += 2) oddSum += digits[i];
  let evenConcat = "";
  for (let i = 1; i < 12; i += 2) evenConcat += digits[i];
  const evenDoubled = (parseInt(evenConcat, 10) * 2).toString();
  const evenSum = evenDoubled.split("").reduce((s, d) => s + Number(d), 0);
  const checkDigit = (10 - ((oddSum + evenSum) % 10)) % 10;
  return checkDigit === digits[12];
}

export function isValidIdOrPassport(value: string): boolean {
  const v = value.trim();
  if (/^\d{13}$/.test(v)) return isValidSaIdNumber(v);
  return /^[A-Za-z0-9]{5,20}$/.test(v);
}
