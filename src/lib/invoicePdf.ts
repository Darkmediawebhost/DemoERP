type InvoicePdfInput = {
  number?: string;
  date?: string;
  dueDate?: string;
  totalPaise?: number;
  clientName?: string;
  phone?: string;
  email?: string;
  website?: string;
  items: Array<{ description?: string; amountPaise?: number }>;
};

function pdfText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function rgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255].map((part) => part.toFixed(3)).join(' ');
}

function billDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function amount(paise?: number) {
  const absolute = Math.abs(Number(paise || 0));
  return `${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

export function invoicePdfBlob(input: InvoicePdfInput) {
  const slots = Math.max(6, input.items.length);
  const pageWidth = 430;
  const pageHeight = 520 + slots * 18;
  const commands: string[] = [];
  const top = (y: number) => pageHeight - y;

  function fill(hex: string) {
    commands.push(`${rgb(hex)} rg`);
  }
  function box(x: number, y: number, width: number, height: number, hex: string) {
    fill(hex);
    commands.push(`${x} ${top(y + height)} ${width} ${height} re f`);
  }
  function roundBox(x: number, y: number, width: number, height: number, radius: number, hex: string) {
    const r = Math.min(radius, width / 2, height / 2);
    const curve = r * 0.5522847498;
    const bottom = top(y + height);
    fill(hex);
    commands.push(
      [
        `${x + r} ${bottom} m`,
        `${x + width - r} ${bottom} l`,
        `${x + width - r + curve} ${bottom} ${x + width} ${bottom + r - curve} ${x + width} ${bottom + r} c`,
        `${x + width} ${bottom + height - r} l`,
        `${x + width} ${bottom + height - r + curve} ${x + width - r + curve} ${bottom + height} ${x + width - r} ${bottom + height} c`,
        `${x + r} ${bottom + height} l`,
        `${x + r - curve} ${bottom + height} ${x} ${bottom + height - r + curve} ${x} ${bottom + height - r} c`,
        `${x} ${bottom + r} l`,
        `${x} ${bottom + r - curve} ${x + r - curve} ${bottom} ${x + r} ${bottom} c`,
        'f',
      ].join(' '),
    );
  }
  function label(text: string, x: number, y: number, size: number, font: 'F1' | 'F2', hex: string) {
    fill(hex);
    commands.push(`BT /${font} ${size} Tf 1 0 0 1 ${x} ${top(y)} Tm (${pdfText(text)}) Tj ET`);
  }
  function rightLabel(text: string, right: number, y: number, size: number, font: 'F1' | 'F2', hex: string) {
    label(text, right - text.length * size * 0.52, y, size, font, hex);
  }

  box(0, 0, pageWidth, pageHeight, '#e7ebf2');
  for (let band = 0; band < 32; band += 1) {
    const mix = band / 31;
    const channel = (from: number, to: number) => Math.round(from + (to - from) * mix).toString(16).padStart(2, '0');
    box(0, band * 8, pageWidth, 10, `#${channel(5, 26)}${channel(5, 77)}${channel(8, 134)}`);
  }
  const markY = top(46);
  const curve = 16 * 0.5522847498;
  fill('#111111');
  commands.push(`36 ${markY} m 36 ${markY + 16} l ${36 - curve} ${markY + 16} 20 ${markY + curve} 20 ${markY} c 20 ${markY - curve} ${36 - curve} ${markY - 16} 36 ${markY - 16} c h f`);
  fill('#ffffff');
  commands.push(`36 ${markY} m 36 ${markY - 16} l ${36 + curve} ${markY - 16} 52 ${markY - curve} 52 ${markY} c 52 ${markY + curve} ${36 + curve} ${markY + 16} 36 ${markY + 16} c h f`);
  commands.push('0.07 0.07 0.07 RG 1.1 w');
  commands.push(`36 ${markY + 16} m ${36 + curve} ${markY + 16} 52 ${markY + curve} 52 ${markY} c 52 ${markY - curve} ${36 + curve} ${markY - 16} 36 ${markY - 16} c ${36 - curve} ${markY - 16} 20 ${markY - curve} 20 ${markY} c 20 ${markY + curve} ${36 - curve} ${markY + 16} 36 ${markY + 16} c S`);

  label('Dark', 60, 40, 12, 'F2', '#ffffff');
  label('Media', 60, 54, 12, 'F2', '#ffffff');
  rightLabel('www.darkmedia.tech', 400, 42, 9, 'F1', '#ffffff');
  label('INVOICE', 28, 118, 32, 'F2', '#ffffff');
  label(`No. ${input.number || 'Draft'}`, 30, 138, 9, 'F1', '#e5e5e5');
  rightLabel('Date:', 400, 108, 9, 'F1', '#ffffff');
  rightLabel(billDate(input.date), 400, 124, 10, 'F1', '#ffffff');

  roundBox(22, 168, 186, 124, 16, '#ffffff');
  roundBox(222, 168, 186, 124, 16, '#ffffff');
  label('Invoice To:', 36, 190, 9, 'F1', '#222222');
  label(input.clientName || '', 36, 208, 13, 'F2', '#16345c');
  label(`Phone: ${input.phone || ''}`, 36, 236, 8, 'F1', '#6b7280');
  label(`Email: ${input.email || ''}`, 36, 250, 8, 'F1', '#6b7280');
  label(`Website: ${input.website || ''}`, 36, 264, 8, 'F1', '#6b7280');
  label('Payment Method:', 236, 190, 9, 'F1', '#222222');
  label('GPay', 236, 210, 9, 'F2', '#4285F4');
  label('Paytm', 272, 210, 9, 'F2', '#00BAF2');
  label('PhonePe', 316, 210, 9, 'F2', '#5f259f');
  label('9480889252', 236, 228, 9, 'F1', '#222222');
  label('Due Date:', 236, 252, 8, 'F1', '#222222');
  roundBox(236, 260, 150, 16, 4, '#d5dae2');
  label(billDate(input.dueDate), 244, 272, 8, 'F1', '#222222');

  roundBox(28, 314, 250, 22, 11, '#5BA4D6');
  roundBox(292, 314, 110, 22, 11, '#111111');
  label('No.', 44, 329, 8, 'F2', '#ffffff');
  label('DESCRIPTION', 92, 329, 8, 'F2', '#ffffff');
  label('TOTAL', 326, 329, 8, 'F2', '#ffffff');

  for (let index = 0; index < slots; index += 1) {
    const item = input.items[index];
    const y = 358 + index * 18;
    label(String(index + 1).padStart(2, '0'), 44, y, 9, 'F1', '#222222');
    label(item?.description || '', 92, y, 9, 'F1', '#222222');
    if (item) rightLabel(amount(item.amountPaise), 392, y, 9, 'F1', '#222222');
  }

  const totalY = 358 + slots * 18 + 8;
  roundBox(250, totalY, 152, 24, 12, '#5BA4D6');
  label('TOTAL', 268, totalY + 16, 9, 'F2', '#ffffff');
  rightLabel(amount(input.totalPaise), 392, totalY + 16, 9, 'F2', '#ffffff');

  const termsY = totalY + 40;
  roundBox(22, termsY, 386, 78, 16, '#ffffff');
  label('Payment Terms', 36, termsY + 16, 8, 'F2', '#222222');
  label('Payment must be made as per the agreed terms.', 36, termsY + 32, 6.5, 'F1', '#6b7280');
  label('Advance payments are non-refundable once work begins.', 36, termsY + 44, 6.5, 'F1', '#6b7280');
  label('Extra work or revisions will be charged separately.', 36, termsY + 56, 6.5, 'F1', '#6b7280');
  label('GST and third-party charges are additional, where applicable.', 220, termsY + 32, 6.5, 'F1', '#6b7280');
  label('Final files are provided after full payment.', 220, termsY + 44, 6.5, 'F1', '#6b7280');
  label('Any invoice dispute must be raised within 7 days.', 220, termsY + 56, 6.5, 'F1', '#6b7280');
  label('THANK YOU FOR YOUR BUSINESS', 118, termsY + 104, 8, 'F2', '#9aa0a8');

  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function downloadInvoicePdf(input: InvoicePdfInput) {
  const blob = invoicePdfBlob(input);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${input.number || 'invoice'}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
