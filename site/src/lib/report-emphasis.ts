const month = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?";
const day = "\\d{1,2}(?:st|nd|rd|th)?";
const date = `(?:${day}(?:[–—-]${day})?\\s+${month}(?:\\s+\\d{4})?|${month}\\s+${day}(?:,?\\s+\\d{4})?|${month}\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{4})`;
const number = "[+−-]?(?:\\d{1,3}(?:[, \\u00a0\\u202f]\\d{3})+|\\d+)(?:\\.\\d+)?(?:\\s?[%‰])?";
const pattern = new RegExp(`https?://[^\\s]+|www\\.[^\\s]+|(?<![\\p{L}\\p{N}_./–—-])(?:(?<date>${date})|(?<number>${number}(?:[–—-]${number})?))(?![\\p{L}\\p{N}_/]|\\.\\d)`, "giu");

export function reportEmphasis(text: string) {
  return [...text.matchAll(pattern)].flatMap(match => {
    const kind = match.groups?.date ? "date" : match.groups?.number ? "number" : null;
    return kind ? [{ index: match.index, text: match[0], kind }] : [];
  });
}
