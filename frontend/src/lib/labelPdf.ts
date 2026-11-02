import { jsPDF } from "jspdf";
import { AMOUNT_FONT_BASE64, AMOUNT_FONT_NAME } from "./labelAmountFont";
import { SINPE_MOVIL } from "../config/payments";
import type { LabelData } from "./printLabel";

// Builds the shipping label as a real PDF page of exactly 100×150 mm — the
// Flash Label Pro roll size. Printing HTML through the browser doesn't work on
// iOS: Safari ignores `@page { size }`, lays the label on a Letter sheet and
// adds its own URL/date header, so the label came out tiny and had to be
// rescaled by hand. Everything is pure black because grays dither on thermal
// paper.

const PAGE_W   = 100;
const PAGE_H   = 150;
const MARGIN   = 6;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_TOP = PAGE_H - MARGIN - 5;
const PT = 0.3528; // mm per point

// Long product lists or addresses shrink the whole label instead of spilling
// onto a second page.
const SCALES = [1, 0.92, 0.85, 0.78, 0.7, 0.62];

function methodTitle(method: string): string {
  if (method === "personal_grecia")   return "ENTREGA PERSONAL";
  if (method.startsWith("mensajero")) return "MENSAJERO";
  if (method.startsWith("correos"))   return "CORREOS CR";
  return method.toUpperCase();
}

/** jsPDF's built-in fonts only encode WinAnsi; anything else prints as garbage. */
function clean(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/₡/g, "C")
    .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, "")
    .trim();
}

/** "+50670351042" → "+506 7035-1042"; anything unexpected is left as typed. */
function formatLabelPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local  = digits.length === 11 && digits.startsWith("506") ? digits.slice(3) : digits;
  return local.length === 8 ? `+506 ${local.slice(0, 4)}-${local.slice(4)}` : raw;
}

function render(data: LabelData, s: number): { doc: jsPDF; endY: number } {
  const doc = new jsPDF({ unit: "mm", format: [PAGE_W, PAGE_H], orientation: "portrait" });
  doc.addFileToVFS(`${AMOUNT_FONT_NAME}.ttf`, AMOUNT_FONT_BASE64);
  doc.addFont(`${AMOUNT_FONT_NAME}.ttf`, AMOUNT_FONT_NAME, "bold");
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  let y = MARGIN;
  const right = PAGE_W - MARGIN;

  function font(size: number, style: "normal" | "bold" | "bolditalic" = "normal", family = "helvetica") {
    doc.setFont(family, style);
    doc.setFontSize(size * s);
  }

  /** Width of a string drawn with letter spacing, which getTextWidth ignores. */
  function spacedWidth(text: string, charSpace: number) {
    return doc.getTextWidth(text) + charSpace * Math.max(0, text.length - 1);
  }

  function sectionLabel(text: string, align: "left" | "center" = "left") {
    font(8, "bold");
    const charSpace = 0.55 * s;
    y += 8 * s * PT * 0.8;
    const x = align === "center" ? (PAGE_W - spacedWidth(text, charSpace)) / 2 : MARGIN;
    doc.text(text, x, y, { charSpace });
    y += 1.8 * s;
  }

  function paragraph(text: string, size: number, style: "normal" | "bold" = "normal") {
    font(size, style);
    const lines: string[] = doc.splitTextToSize(text, CONTENT_W);
    for (const line of lines) {
      y += size * s * PT * 0.82;
      doc.text(line, MARGIN, y);
      y += size * s * PT * 0.36;
    }
  }

  /** One centered line made of normal/bold runs, e.g. "a nombre de **Keylor**". */
  function mixedLine(runs: { text: string; size: number; bold?: boolean }[]) {
    const widths = runs.map((run) => { font(run.size, run.bold ? "bold" : "normal"); return doc.getTextWidth(run.text); });
    const tallest = Math.max(...runs.map((run) => run.size));
    let x = (PAGE_W - widths.reduce((total, width) => total + width, 0)) / 2;
    y += tallest * s * PT * 0.82;
    runs.forEach((run, index) => {
      font(run.size, run.bold ? "bold" : "normal");
      doc.text(run.text, x, y);
      x += widths[index];
    });
    y += tallest * s * PT * 0.36;
  }

  const gap = (mm: number) => { y += mm * s; };

  // ── Header ──
  font(26, "bolditalic");
  doc.text("Dropping", MARGIN, y + 26 * s * PT * 0.78);
  font(7.5);
  doc.text("COSTA RICA", MARGIN + 0.3, y + 26 * s * PT * 0.78 + 5.4 * s, { charSpace: 0.9 * s });

  const title = methodTitle(data.shippingMethod);
  font(10, "bold");
  const badgeW = spacedWidth(title, 0.3 * s) + 6 * s;
  const badgeH = 7 * s;
  doc.setLineWidth(0.5);
  doc.roundedRect(right - badgeW, y + 1, badgeW, badgeH, 1.2, 1.2, "S");
  doc.text(title, right - badgeW + 3 * s, y + 1 + badgeH / 2 + 10 * s * PT * 0.35, { charSpace: 0.3 * s });

  y += 17 * s;
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, right, y);
  gap(4);

  // ── Recipient ──
  const name  = data.recipientName  ? clean(data.recipientName) : "";
  const phone = data.recipientPhone ? formatLabelPhone(clean(data.recipientPhone)) : "";
  if (name || phone) {
    sectionLabel("DESTINATARIO");
    if (name)  paragraph(name, 20, "bold");
    if (phone) paragraph(phone, 15, "bold");
    gap(3.5);
  }

  // ── Address ──
  const address = [data.province, data.canton, data.district].filter(Boolean).map((part) => clean(part!)).join(", ");
  const detail  = data.detail ? clean(data.detail) : "";
  if (address || detail) {
    sectionLabel("DIRECCIÓN");
    if (address) paragraph(address, 14, "bold");
    if (detail) {
      gap(1);
      paragraph(detail, 12);
    }
    gap(3);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1.5, 1.2], 0);
    doc.line(MARGIN, y, right, y);
    doc.setLineDashPattern([], 0);
    gap(3.5);
  }

  // ── Products ──
  sectionLabel(data.products.length > 1 ? "PRODUCTOS" : "PRODUCTO");
  for (const product of data.products) {
    const parts = [clean(product.name)];
    if (product.size) parts.push(`Talla ${clean(product.size)}`);
    if (product.qty && product.qty > 1) parts.push(`x${product.qty}`);
    paragraph(`• ${parts.join("  ·  ")}`, 12);
  }
  gap(3.5);

  // ── Tracking ──
  if (data.trackingNumber) {
    sectionLabel("N.º DE GUÍA (CORREOS CR)");
    font(17, "bold", "courier");
    y += 17 * s * PT * 0.82;
    doc.text(clean(data.trackingNumber), MARGIN, y);
    y += 17 * s * PT * 0.36;
    gap(3.5);
  }

  // ── Payment ──
  const amountDue = data.cashOnDelivery ?? 0;
  if (amountDue > 0) {
    const boxTop = y;
    const boxH   = 20 * s;
    doc.setLineWidth(0.6);
    doc.setLineDashPattern([2.2, 1.4], 0);
    doc.roundedRect(MARGIN, boxTop, CONTENT_W, boxH, 1.5, 1.5, "S");
    doc.setLineDashPattern([], 0);

    y = boxTop + 2.6 * s;
    sectionLabel("A CANCELAR CONTRA ENTREGA", "center");
    doc.setFont(AMOUNT_FONT_NAME, "bold");
    doc.setFontSize(30 * s);
    doc.text(`₡${amountDue.toLocaleString("en-US")}`, PAGE_W / 2, boxTop + boxH - 3.6 * s, { align: "center" });
    y = boxTop + boxH;

    gap(4);
    sectionLabel("O POR SINPE MÓVIL", "center");
    mixedLine([{ text: SINPE_MOVIL.phone, size: 22, bold: true }]);
    gap(0.6);
    mixedLine([
      { text: "a nombre de ", size: 11.5 },
      { text: SINPE_MOVIL.holder, size: 11.5, bold: true },
    ]);
  } else {
    const boxH = 10 * s;
    doc.setLineWidth(0.6);
    doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 1.5, 1.5, "S");
    font(13, "bold");
    const text  = "PAGO COMPLETADO";
    const textW = doc.getTextWidth(text);
    const checkW = 4.2 * s;
    const startX = (PAGE_W - (checkW + 2 * s + textW)) / 2;
    const midY   = y + boxH / 2;
    // Check mark drawn as lines: "✓" isn't in the built-in font.
    doc.setLineWidth(0.8 * s);
    doc.lines([[1.4 * s, 1.5 * s], [2.8 * s, -3.2 * s]], startX, midY - 0.1 * s);
    doc.text(text, startX + checkW + 2 * s, midY + 13 * s * PT * 0.35);
    y += boxH;
  }

  // ── Footer ──
  doc.setLineWidth(0.3);
  doc.line(MARGIN, FOOTER_TOP, right, FOOTER_TOP);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("droppingcr.com", MARGIN, FOOTER_TOP + 3.8);
  doc.text(clean(data.date ?? new Date().toLocaleDateString("es-CR")), right, FOOTER_TOP + 3.8, { align: "right" });

  return { doc, endY: y };
}

export function buildLabelPdf(data: LabelData): Blob {
  for (const scale of SCALES) {
    const { doc, endY } = render(data, scale);
    if (endY <= FOOTER_TOP - 2 || scale === SCALES[SCALES.length - 1]) {
      doc.setProperties({ title: "Etiqueta · Dropping CR" });
      return doc.output("blob");
    }
  }
  throw new Error("unreachable");
}
