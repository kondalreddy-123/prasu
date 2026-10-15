export type PersonalHealthReportEntry = {
  title: string;
  category: string;
  date?: string;
  provider?: string;
  source?: string;
  verificationStatus?: string;
  detail?: string;
};

const pdfText = (value: unknown) => String(value ?? 'Unknown')
  .normalize('NFKD')
  .replace(/[^\x20-\x7E]/g, '?')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

function wrap(line: string, maxLength = 92) {
  const words = line.split(/\s+/);
  const output: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && `${current} ${word}`.length > maxLength) {
      output.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) output.push(current);
  return output.length ? output : [''];
}

export function createPersonalHealthReportPdf(input: {
  entries: PersonalHealthReportEntry[];
  categories: string[];
  fromDate?: string;
  toDate?: string;
}): Blob {
  if (!input.entries.length) throw new Error('There are no records in this selection to download.');
  const lines: string[] = [
    'HealthPass - Personal Health Report',
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    `Categories: ${input.categories.join(', ') || 'None'}`,
    `Date range: ${input.fromDate || 'Any'} to ${input.toDate || 'Any'}`,
    `Records included: ${input.entries.length}`,
    'This is a summary of authorized records. Original reports remain separate documents.',
    'Missing values are shown as Unknown. Unverified information is labeled as such.',
    '',
  ];
  for (const [index, entry] of input.entries.entries()) {
    lines.push(`${index + 1}. ${entry.title}`);
    lines.push(`Category: ${entry.category}`);
    lines.push(`Record date: ${entry.date || 'Unknown'}`);
    lines.push(`Provider: ${entry.provider || 'Unknown'}`);
    lines.push(`Source: ${entry.source || 'Unknown'}`);
    lines.push(`Verification: ${entry.verificationStatus || 'Unverified'}`);
    if (entry.detail) lines.push(`Details: ${entry.detail}`);
    lines.push('');
  }
  if (!input.entries.length) lines.push('No records matched the selected categories and date range.');

  const pageLines: string[][] = [[]];
  for (const line of lines.flatMap((value) => wrap(value))) {
    if (pageLines[pageLines.length - 1].length >= 47) pageLines.push([]);
    pageLines[pageLines.length - 1].push(line);
  }
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const pageObjectIds = pageLines.map((_, index) => 4 + index * 2);
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageLines.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pageLines.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    const content = page.map((line, lineIndex) => {
      const y = 756 - lineIndex * 15;
      const size = index === 0 && lineIndex === 0 ? 16 : 10;
      return `BT /F1 ${size} Tf 50 ${y} Td (${pdfText(line)}) Tj ET`;
    }).join('\n');
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let document = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = document.length;
    document += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = document.length;
  document += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) document += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  document += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([document], { type: 'application/pdf' });
}
