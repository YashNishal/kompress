/**
 * Copies text that may still be computing. Safari only allows clipboard writes inside the click
 * that asked for them, so pending text goes in as a ClipboardItem promise rather than after an await.
 */
export async function copyText(text: string | Promise<string>) {
  if (typeof text === "string") return navigator.clipboard.writeText(text);
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
    const blob = text.then((t) => new Blob([t], { type: "text/plain" }));
    return navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
  }
  return navigator.clipboard.writeText(await text);
}
