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
  cashOnDelivery?:  number;   // undefined = don't show; 0 = paid; >0 = amount due
  date?:            string;
}

function methodInfo(method: string): { title: string } {
  if (method === "personal_grecia")   return { title: "ENTREGA PERSONAL" };
  if (method.startsWith("mensajero")) return { title: "MENSAJERO" };
  if (method.startsWith("correos"))   return { title: "CORREOS CR" };
  return { title: method.toUpperCase() };
}

export function printLabel(data: LabelData): void {
  const { title } = methodInfo(data.shippingMethod);

  const productLines = data.products
    .map((p) => {
      const parts: string[] = [p.name];
      if (p.size) parts.push(`Talla ${p.size}`);
      if (p.qty && p.qty > 1) parts.push(`x${p.qty}`);
      return `<p class="product-line">• ${parts.join(" &nbsp;·&nbsp; ")}</p>`;
    })
    .join("");

  const hasAddress = data.province || data.canton || data.district;
  const addressBlock = hasAddress
    ? `
      <div class="section">
        <div class="label">Dirección</div>
        <div class="value-sm">${[data.province, data.canton, data.district].filter(Boolean).join(", ")}</div>
      </div>`
    : "";

  const detailBlock = data.detail
    ? `
      <div class="section">
        <div class="label">Detalles</div>
        <div class="detail-text">${data.detail}</div>
      </div>`
    : "";

  const trackingBlock = data.trackingNumber
    ? `
      <div class="section">
        <div class="label">N.° de guía (Correos CR)</div>
        <div class="tracking">${data.trackingNumber}</div>
      </div>`
    : "";

  const recipientBlock = (data.recipientName || data.recipientPhone)
    ? `
      <div class="section">
        <div class="label">Destinatario</div>
        ${data.recipientName  ? `<div class="value">${data.recipientName}</div>`  : ""}
        ${data.recipientPhone ? `<div class="value-sm">${data.recipientPhone}</div>` : ""}
      </div>`
    : "";

  const cashBlock = (data.cashOnDelivery ?? 0) > 0
    ? `<div class="cash-box due">
         <div class="cash-label">A CANCELAR CONTRA ENTREGA</div>
         <div class="cash-amount">&#8353;${data.cashOnDelivery!.toLocaleString("en-US")}</div>
       </div>`
    : `<div class="cash-box paid"><strong>&#10003; PAGO COMPLETADO</strong></div>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Etiqueta · Dropping CR</title>
  <style>
    @page {
      size: 4in 6in;
      margin: 0;
    }
    @media print {
      html, body { width: 4in; height: 6in; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 4in;
      height: 6in;
      font-family: Arial, Helvetica, sans-serif;
      padding: 0.22in;
      display: flex;
      flex-direction: column;
      background: white;
      overflow: hidden;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #111;
      padding-bottom: 9px;
      margin-bottom: 14px;
    }
    .brand {
      font-size: 22pt;
      font-weight: 900;
      font-style: italic;
      letter-spacing: -0.5px;
      color: #111;
      line-height: 1;
    }
    .brand-sub {
      font-size: 7pt;
      font-weight: 400;
      font-style: normal;
      text-transform: uppercase;
      letter-spacing: 2.5px;
      color: #555;
      display: block;
      margin-top: 4px;
    }
    .method-badge {
      font-size: 7.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #111;
      border: 2px solid #111;
      padding: 3px 8px;
      border-radius: 4px;
      margin-top: 4px;
      white-space: nowrap;
    }
    .section {
      margin-bottom: 10px;
    }
    .label {
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #777;
      margin-bottom: 3px;
    }
    .value {
      font-size: 15pt;
      font-weight: 800;
      color: #111;
      line-height: 1.2;
    }
    .value-sm {
      font-size: 11pt;
      font-weight: 600;
      color: #222;
      line-height: 1.3;
    }
    .product-line {
      font-size: 10pt;
      color: #222;
      margin-bottom: 3px;
      line-height: 1.4;
    }
    .detail-text {
      font-size: 9.5pt;
      color: #333;
      line-height: 1.4;
      white-space: pre-line;
    }
    .tracking {
      font-size: 14pt;
      font-weight: 900;
      letter-spacing: 2px;
      font-family: 'Courier New', monospace;
      color: #111;
      word-break: break-all;
    }
    .divider {
      border: none;
      border-top: 1px dashed #bbb;
      margin: 10px 0;
    }
    .cash-box {
      border: 2px solid #111;
      border-radius: 4px;
      padding: 8px 10px;
      margin-bottom: 10px;
      text-align: center;
    }
    .cash-box.paid {
      font-size: 10pt;
      font-weight: 800;
      letter-spacing: 1px;
      color: #111;
    }
    .cash-box.due {
      border-style: dashed;
    }
    .cash-label {
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #555;
      margin-bottom: 3px;
    }
    .cash-amount {
      font-size: 18pt;
      font-weight: 900;
      color: #111;
      line-height: 1;
    }
    .footer {
      margin-top: auto;
      border-top: 1px solid #ccc;
      padding-top: 6px;
      font-size: 6.5pt;
      color: #999;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">
        Dropping
        <span class="brand-sub">Costa Rica</span>
      </div>
    </div>
    <div class="method-badge">${title}</div>
  </div>

  ${recipientBlock}

  ${addressBlock}

  ${detailBlock}

  ${(hasAddress || detailBlock) ? "<hr class=\"divider\">" : ""}

  <div class="section">
    <div class="label">Producto${data.products.length > 1 ? "s" : ""}</div>
    ${productLines}
  </div>

  ${trackingBlock}

  ${cashBlock}

  <div class="footer">
    <span>droppingcr.com</span>
    <span>${data.date ?? new Date().toLocaleDateString("es-CR")}</span>
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=420,height=640,menubar=no,toolbar=no");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
