// Restore source formatting when a model flattens paragraph breaks. Words,
// punctuation, order, and case must still match one contiguous source excerpt.
export function sourceQuote(source: string, quote: string): string | null {
  if (!quote.trim()) return null;
  if (source.includes(quote)) return quote;
  const pattern = quote.trim().split(/\s+/u)
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return source.match(new RegExp(pattern, "u"))?.[0] ?? null;
}
