import jsPDF from "jspdf";

const PAGE_WIDTH = 210; // A4, mm
const MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// A small text-flow PDF builder, purpose-built for the AI report/case-risk output shape
// (title, sections of narrative + lists, a closing disclaimer) rather than tabular data —
// exportCsv.ts already covers the tabular case. Pure client-side, same "no backend
// dependency" philosophy as the CSV export.
export class PdfBuilder {
  private doc: jsPDF;
  private y: number;

  constructor() {
    this.doc = new jsPDF({ unit: "mm", format: "a4" });
    this.y = MARGIN;
  }

  private ensureSpace(height: number) {
    const pageHeight = this.doc.internal.pageSize.getHeight();
    if (this.y + height > pageHeight - MARGIN) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  title(text: string) {
    this.ensureSpace(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(16);
    this.doc.setTextColor(20, 20, 20);
    this.doc.text(text, MARGIN, this.y);
    this.y += 8;
  }

  subtitle(text: string) {
    this.ensureSpace(6);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(110, 110, 110);
    this.doc.text(text, MARGIN, this.y);
    this.doc.setTextColor(0, 0, 0);
    this.y += 7;
  }

  heading(text: string) {
    this.ensureSpace(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.setTextColor(20, 20, 20);
    this.doc.text(text, MARGIN, this.y);
    this.y += 6;
  }

  paragraph(text: string, opts?: { italic?: boolean; size?: number; muted?: boolean }) {
    const size = opts?.size ?? 10;
    this.doc.setFont("helvetica", opts?.italic ? "italic" : "normal");
    this.doc.setFontSize(size);
    const color: [number, number, number] = opts?.muted ? [110, 110, 110] : [30, 30, 30];
    this.doc.setTextColor(color[0], color[1], color[2]);
    const lines: string[] = this.doc.splitTextToSize(text, CONTENT_WIDTH);
    const lineHeight = size * 0.42;
    for (const line of lines) {
      this.ensureSpace(lineHeight + 1);
      this.doc.text(line, MARGIN, this.y);
      this.y += lineHeight;
    }
    this.doc.setTextColor(0, 0, 0);
    this.y += 2;
  }

  list(items: string[], ordered = false) {
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    this.doc.setTextColor(30, 30, 30);
    items.forEach((item, i) => {
      const prefix = ordered ? `${i + 1}. ` : "-  ";
      const lines: string[] = this.doc.splitTextToSize(prefix + item, CONTENT_WIDTH - 2);
      lines.forEach((line, li) => {
        this.ensureSpace(5);
        this.doc.text(li === 0 ? line : "    " + line, MARGIN, this.y);
        this.y += 4.6;
      });
    });
    this.doc.setTextColor(0, 0, 0);
    this.y += 2;
  }

  divider() {
    this.ensureSpace(4);
    this.doc.setDrawColor(210, 210, 210);
    this.doc.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y);
    this.y += 5;
  }

  spacer(height = 3) {
    this.y += height;
  }

  save(filename: string) {
    this.doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  }
}
