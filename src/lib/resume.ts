import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function parsePdfToText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = "";
    for (const item of content.items) {
      const it = item as { str?: string; transform?: number[] };
      const text = it.str ?? "";
      if (it.transform) {
        const y = Math.round(it.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 2) {
          pages.push(line.trim());
          line = "";
        }
        lastY = y;
      }
      line += text + " ";
    }
    if (line.trim()) pages.push(line.trim());
  }

  return pages.filter(Boolean).join("\n").replace(/[ \t]+\n/g, "\n");
}
