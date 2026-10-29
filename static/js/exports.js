/**
 * Multi-format exports module for EventEase.
 * Implements CSV formula injection defense and RFC 5545 iCalendar compliance.
 */

export function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  const trimmed = str.trimStart();
  const formulaTriggers = ['=', '+', '-', '@', '\t', '\r', '|', '%'];

  if (trimmed.length > 0 && formulaTriggers.includes(trimmed[0])) {
    const isPureNumber = !isNaN(Number(trimmed)) && !['=', '@', '\t', '\r', '|'].some((c) => trimmed.includes(c));
    if (!isPureNumber || ['+', '@', '=', '\t', '\r', '|'].includes(trimmed[0])) {
      return `'${str}`;
    }
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function escapeIcsText(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function getByteLength(str) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  return unescape(encodeURIComponent(str)).length;
}

export function foldIcsLine(line, maxOctets = 75) {
  if (getByteLength(line) <= maxOctets) {
    return line;
  }

  const chars = Array.from(line);
  const foldedLines = [];
  let currentSegment = '';

  for (let i = 0; i < chars.length; i++) {
    const nextChar = chars[i];
    const candidate = currentSegment + nextChar;
    const limit = foldedLines.length === 0 ? maxOctets : maxOctets - 1;

    if (getByteLength(candidate) <= limit) {
      currentSegment = candidate;
    } else {
      if (currentSegment.length > 0) {
        foldedLines.push(currentSegment);
      }
      currentSegment = nextChar;
    }
  }

  if (currentSegment.length > 0) {
    foldedLines.push(currentSegment);
  }

  return foldedLines.join('\r\n ');
}

export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getNextDayIcs(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  dateObj.setUTCDate(dateObj.getUTCDate() + 1);
  return dateObj.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Generate Copy Summary string calculating actual contingency.
 */
export function generateCopySummary(currentPlan) {
  if (!currentPlan) return '';
  const p = currentPlan;
  const items = p.budget?.items || [];
  const contingencyItem = items.find((it) => it.is_contingency) || null;
  const contingencyAmount = contingencyItem ? contingencyItem.amount : 0;
  const contingencyPct = contingencyItem ? contingencyItem.percentage : 8.0;

  const currency = p.intake.currency || 'USD';
  const totalBudget = Number(p.intake.total_budget || 0);

  let text = `======================================================\n`;
  text += `EVENT SUMMARY: ${p.intake.event_type.toUpperCase()} CELEBRATION\n`;
  text += `======================================================\n\n`;
  text += `Date: ${p.intake.date}\n`;
  text += `City: ${p.intake.city || 'TBD'}\n`;
  text += `Headcount: ${p.intake.guest_count} guests\n`;
  text += `Total Budget: ${currency} ${totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
  text += `Emergency Contingency: ${currency} ${contingencyAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${contingencyPct.toFixed(1)}% safety buffer)\n`;
  text += `Theme: ${p.intake.theme || 'Curated Aesthetic'}\n\n`;

  text += `--- BUDGET ALLOCATION ---\n`;
  items.forEach((item) => {
    const isBuffer = item.is_contingency ? ' [SAFETY BUFFER]' : '';
    text += `- ${item.category}: ${currency} ${Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} (${Number(item.percentage).toFixed(1)}%)${isBuffer}\n`;
  });

  text += `\n--- KEY MILESTONES ---\n`;
  (p.timeline?.milestones || []).forEach((m) => {
    text += `* ${m.target_date} [${m.days_before_event}d before]: ${m.title}\n`;
  });

  text += `\n--- VENDOR CHECKLIST ---\n`;
  (p.checklist?.tasks || []).forEach((t) => {
    text += `[${(t.status || 'to-do').toUpperCase()}] ${t.vendor_type} (${t.category})\n`;
  });

  return text;
}
