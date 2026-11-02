export interface LabelProduct {
  name: string;
  size?: string;
  qty?:  number;
}

export interface LabelData {
  recipientName?:   string;
  recipientPhone?:  string;
  shippingMethod:   string;
  products:         LabelProduct[];
  trackingNumber?:  string;
  province?:        string;
  canton?:          string;
  district?:        string;
  detail?:          string;
  cashOnDelivery?:  number;   // >0 = amount due (+ SINPE info); 0 or undefined = paid
  date?:            string;
}

// jsPDF only loads when a label is generated, so it stays out of the main bundle.
let pdfModule: Promise<typeof import("./labelPdf")> | null = null;

/**
 * Starts loading the PDF generator ahead of time. Call it when a screen that
 * prints labels opens: iOS only allows the share sheet right after a tap, and
 * a cold download in between can use up that window.
 */
export function preloadLabelPdf() {
  pdfModule ??= import("./labelPdf");
  return pdfModule;
}

/** Phones/tablets that can hand a file to another app (e.g. Flash Label). */
function canShareToApp(): boolean {
  if (!window.matchMedia("(pointer: coarse)").matches || !navigator.canShare) return false;
  return navigator.canShare({ files: [new File([""], "etiqueta.pdf", { type: "application/pdf" })] });
}

function methodSuffix(method: string): string {
  if (method === "personal_grecia")   return "EntregaPersonal";
  if (method.startsWith("mensajero")) return "Mensajero";
  if (method.startsWith("correos"))   return "Correos";
  return "Etiqueta";
}

/** "Camila Murillo" + mensajero → "CamilaMurillo-Mensajero.pdf" (accents stripped). */
function fileNameFor(data: LabelData): string {
  const name = (data.recipientName ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("");
  return `${name || "Dropping"}-${methodSuffix(data.shippingMethod)}.pdf`;
}

function download(file: File) {
  const url  = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href     = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Generates the label as a 100×150 mm PDF.
 * - Phone: opens the share sheet so it goes straight to the printer app at 1:1.
 * - Computer: opens the PDF in a new tab, ready to print.
 */
export async function printLabel(data: LabelData): Promise<void> {
  const share = canShareToApp();
  // The tab must be opened synchronously inside the click, before any await,
  // or the browser treats it as a popup and blocks it.
  const tab = share ? null : window.open("", "_blank");

  const { buildLabelPdf } = await preloadLabelPdf();
  const file = new File([buildLabelPdf(data)], fileNameFor(data), { type: "application/pdf" });

  if (share) {
    try {
      await navigator.share({ files: [file], title: file.name });
    } catch (error) {
      // AbortError = the user closed the sheet; anything else, fall back to a download.
      if ((error as Error).name !== "AbortError") download(file);
    }
    return;
  }

  if (tab) tab.location.href = URL.createObjectURL(file);
  else     download(file);
}
