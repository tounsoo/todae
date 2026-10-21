/** Text folded for comparison, shared by the date and number readers. */

/** The digit a decimal digit of any script stands for. Each script's digits run 0 to 9 in a row. */
function digitValue(char: string) {
  let first = char.codePointAt(0)!;
  while (/\p{Nd}/u.test(String.fromCodePoint(first - 1))) first--;
  return (char.codePointAt(0)! - first) % 10;
}

/** Text as `normalize` folds it, with its punctuation, symbols and spaces as they are. */
export function fold(text: string) {
  return (
    text
      .normalize('NFKC')
      // Upper then lower case, so ı and İ, or ß and SS, fold the same.
      .toUpperCase()
      .toLowerCase()
      .normalize('NFD')
      .replace(/i\u0307/g, 'i')
      .replace(/(\p{Script=Greek})\p{M}+/gu, '$1')
      .normalize('NFC')
      .replace(/\p{Nd}/gu, (char) => String(digitValue(char)))
      .replace(/\p{Cf}/gu, '')
  );
}
