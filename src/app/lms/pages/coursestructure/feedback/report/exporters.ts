// Excel & PDF exporters for the feedback report page.
// - Excel uses ExcelJS so we can set worksheet.autoFilter on the header row
//   (the .xlsx opens with default filter dropdowns already enabled).
// - PDF is built programmatically with jsPDF (no html2canvas dependency).

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { Feedback } from '../types/feedback';

type ReportStats = {
  ratingScale: number;
  perQuestionAvg: {
    question: string;
    category: string | null;
    max: number;
    avg: number;
    n: number;
  }[];
  parameterAverages: { category: string; avg: number }[];
  overallAvg: number;
  distribution: { star: number; count: number }[];
  positivePct: number;
  distinctStudents: number;
  suggestionsCount: number;
  comments: { name: string; email: string; date: string; text: string; isAnonymous: boolean }[];
  topSuggestions: { text: string; count: number }[];
  totalResponses: number;
  textQuestionCount: number;
};

const stripHtml = (s: string) => {
  if (!s) return '';
  if (typeof window === 'undefined') return s.replace(/<[^>]*>/g, '').trim();
  const tmp = document.createElement('div');
  tmp.innerHTML = s;
  return (tmp.textContent || tmp.innerText || '').trim();
};

const safeFileBase = (s: string) =>
  (s || 'feedback-report').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);

// ─────────────────────────────────────────────────────────────────────────────
// Excel
// ─────────────────────────────────────────────────────────────────────────────
export async function exportFeedbackReportExcel(feedback: Feedback, stats: ReportStats) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EduLMS';
  wb.created = new Date();

  const titleStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 12, color: { argb: 'FF111827' } },
    alignment: { vertical: 'middle' },
  };
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } },
    alignment: { vertical: 'middle', horizontal: 'left' },
    border: {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    },
  };
  const cellBorder: Partial<ExcelJS.Style> = {
    border: {
      top: { style: 'thin', color: { argb: 'FFF3F4F6' } },
      bottom: { style: 'thin', color: { argb: 'FFF3F4F6' } },
      left: { style: 'thin', color: { argb: 'FFF3F4F6' } },
      right: { style: 'thin', color: { argb: 'FFF3F4F6' } },
    },
  };

  // ── 1. Summary sheet ──────────────────────────────────────────────────────
  const summary = wb.addWorksheet('Summary', {
    properties: { defaultColWidth: 22 },
  });
  summary.columns = [{ width: 28 }, { width: 40 }];

  summary.addRow([feedback.feedbackTitle || 'Feedback Report']).getCell(1).style = titleStyle;
  summary.addRow([
    'Generated',
    format(new Date(), 'd MMM yyyy, h:mm a'),
  ]);
  if ((feedback as any).trainerName) {
    summary.addRow(['Trainer', (feedback as any).trainerName]);
  }
  if ((feedback as any).trainerEmail) {
    summary.addRow(['Trainer Email', (feedback as any).trainerEmail]);
  }
  summary.addRow([]);

  const sumHeader = summary.addRow(['Metric', 'Value']);
  sumHeader.eachCell((c) => (c.style = headerStyle));

  const sumRows: Array<[string, string | number]> = [
    ['Total Feedback', stats.totalResponses],
    [
      'Average Rating',
      stats.overallAvg ? `${stats.overallAvg.toFixed(2)} / ${stats.ratingScale}` : 'N/A',
    ],
    ['Positive Feedback', `${stats.positivePct}%`],
    ['Suggestions', stats.suggestionsCount],
    ['Students Responded', stats.distinctStudents],
    ['Questions', (feedback.questions || []).length],
  ];
  sumRows.forEach((r) => {
    const row = summary.addRow(r);
    row.eachCell((c) => (c.style = { ...cellBorder, font: { size: 11 } }));
  });

  summary.addRow([]);
  const paramHeader = summary.addRow(['Parameter', 'Average Rating']);
  paramHeader.eachCell((c) => (c.style = headerStyle));
  stats.parameterAverages.forEach((p) => {
    const row = summary.addRow([p.category, Number(p.avg.toFixed(2))]);
    row.eachCell((c) => (c.style = { ...cellBorder, font: { size: 11 } }));
  });

  summary.addRow([]);
  const distHeader = summary.addRow(['Star Rating', 'Responses']);
  distHeader.eachCell((c) => (c.style = headerStyle));
  stats.distribution.forEach((d) => {
    const row = summary.addRow([`${d.star} Star${d.star !== 1 ? 's' : ''}`, d.count]);
    row.eachCell((c) => (c.style = { ...cellBorder, font: { size: 11 } }));
  });

  // ── 2. Responses sheet ─ ── with auto-filter enabled on header ────────────
  const resp = wb.addWorksheet('Responses');

  const questions = feedback.questions || [];
  const respCols: Partial<ExcelJS.Column>[] = [
    { header: '#', key: 'n', width: 6 },
    { header: 'Student Name', key: 'name', width: 24 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Anonymous', key: 'anon', width: 12 },
    { header: 'Submitted', key: 'date', width: 16 },
    { header: 'Overall Rating', key: 'overall', width: 16 },
  ];
  questions.forEach((q, i) => {
    respCols.push({
      header: `${i + 1}. ${q.questionText}${(q as any).category ? ` [${(q as any).category}]` : ''}`,
      key: `q_${i}`,
      width: 28,
    });
  });
  respCols.push({ header: 'Overall Reason', key: 'reason', width: 36 });

  resp.columns = respCols as ExcelJS.Column[];

  // Header row styling
  const headerRow = resp.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((c) => (c.style = { ...headerStyle, alignment: { vertical: 'middle', wrapText: true } }));

  (feedback.studentResponses || []).forEach((r: any, idx: number) => {
    const row: any = {
      n: idx + 1,
      name: r.isAnonymous ? 'Anonymous' : r.studentName || '',
      email: r.isAnonymous ? '' : r.studentEmail || '',
      anon: r.isAnonymous ? 'Yes' : 'No',
      date: r.submittedAt ? format(new Date(r.submittedAt), 'd MMM yyyy') : '',
      overall: r.overallRating || '',
      reason: stripHtml(r.overallReason || ''),
    };
    questions.forEach((q, i) => {
      const a = r.answers?.find((x: any) => x.questionText === q.questionText);
      if (!a) {
        row[`q_${i}`] = '';
      } else if (q.questionType === 'rating') {
        row[`q_${i}`] = Number(a.answer) || '';
      } else {
        row[`q_${i}`] = stripHtml(a.answer?.toString() || '');
      }
    });
    const added = resp.addRow(row);
    added.eachCell((c) => {
      c.style = { ...cellBorder, alignment: { vertical: 'top', wrapText: true } };
    });
  });

  // Auto-filter on the entire header row — gives the user filter dropdowns
  // on every column as soon as the file opens.
  resp.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: respCols.length },
  };
  // Freeze the header so it stays visible while scrolling/filtering.
  resp.views = [{ state: 'frozen', ySplit: 1 }];

  // ── 3. Comments sheet ─────────────────────────────────────────────────────
  const comments = wb.addWorksheet('Comments');
  comments.columns = [
    { header: 'Student', key: 'name', width: 24 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Date', key: 'date', width: 16 },
    { header: 'Comment', key: 'text', width: 80 },
  ] as ExcelJS.Column[];
  comments.getRow(1).eachCell((c) => (c.style = headerStyle));
  stats.comments.forEach((c) => {
    const r = comments.addRow({
      name: c.name,
      email: c.email,
      date: c.date ? format(new Date(c.date), 'd MMM yyyy') : '',
      text: c.text,
    });
    r.eachCell((cell) => {
      cell.style = { ...cellBorder, alignment: { vertical: 'top', wrapText: true } };
    });
  });
  comments.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 4 },
  };
  comments.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${safeFileBase(feedback.feedbackTitle)}_report.xlsx`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF
// ─────────────────────────────────────────────────────────────────────────────
export async function exportFeedbackReportPdf(feedback: Feedback, stats: ReportStats) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const line = (color: [number, number, number] = [229, 231, 235]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
  };

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(17, 24, 39);
  doc.text(feedback.feedbackTitle || 'Feedback Report', margin, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  const sub: string[] = [];
  if ((feedback as any).trainerName) sub.push(`Trainer: ${(feedback as any).trainerName}`);
  sub.push(`Generated ${format(new Date(), 'd MMM yyyy, h:mm a')}`);
  doc.text(sub.join('   ·   '), margin, y);
  y += 14;
  line();

  // Summary stats grid
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text('Summary', margin, y);
  y += 14;

  const summaryRows: [string, string][] = [
    ['Total Feedback', String(stats.totalResponses)],
    [
      'Average Rating',
      stats.overallAvg ? `${stats.overallAvg.toFixed(2)} / ${stats.ratingScale}` : 'N/A',
    ],
    ['Positive Feedback', `${stats.positivePct}%`],
    ['Suggestions', String(stats.suggestionsCount)],
    ['Students Responded', String(stats.distinctStudents)],
  ];

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  summaryRows.forEach(([label, value]) => {
    ensureSpace(16);
    doc.setTextColor(107, 114, 128);
    doc.text(label, margin, y);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(value, margin + 160, y);
    doc.setFont('helvetica', 'normal');
    y += 14;
  });
  y += 6;
  line();

  // Parameter averages
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text('Parameter Averages', margin, y);
  y += 14;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(107, 114, 128);
  doc.text('Parameter', margin, y);
  doc.text('Avg', pageW - margin - 40, y, { align: 'right' });
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(17, 24, 39);
  if (stats.parameterAverages.length === 0) {
    doc.setTextColor(156, 163, 175);
    doc.text('No rating data', margin, y);
    y += 14;
  } else {
    stats.parameterAverages.forEach((p) => {
      ensureSpace(14);
      doc.text(p.category, margin, y);
      doc.text(p.avg.toFixed(2), pageW - margin - 40, y, { align: 'right' });
      y += 12;
    });
  }
  y += 6;
  line();

  // Rating distribution
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text('Rating Distribution', margin, y);
  y += 14;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  stats.distribution.forEach((d) => {
    ensureSpace(14);
    const pct = stats.totalResponses
      ? Math.round((d.count / stats.totalResponses) * 100)
      : 0;
    doc.setTextColor(107, 114, 128);
    doc.text(`${d.star} Star${d.star !== 1 ? 's' : ''}`, margin, y);
    doc.setTextColor(17, 24, 39);
    doc.text(`${pct}% (${d.count})`, pageW - margin - 40, y, { align: 'right' });
    y += 12;
  });
  y += 6;
  line();

  // Recent comments
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text('Recent Comments', margin, y);
  y += 14;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (stats.comments.length === 0) {
    doc.setTextColor(156, 163, 175);
    doc.text('No comments yet', margin, y);
    y += 14;
  } else {
    stats.comments.slice(0, 8).forEach((c) => {
      ensureSpace(36);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text(c.name, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      const dateStr = c.date ? format(new Date(c.date), 'd MMM yyyy') : '';
      doc.text(dateStr, pageW - margin, y, { align: 'right' });
      y += 12;
      doc.setTextColor(55, 65, 81);
      const wrapped = doc.splitTextToSize(c.text, pageW - margin * 2);
      wrapped.forEach((ln: string) => {
        ensureSpace(12);
        doc.text(ln, margin, y);
        y += 11;
      });
      y += 4;
    });
  }
  y += 4;
  line();

  // Top suggestions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text('Top Suggestions', margin, y);
  y += 14;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (stats.topSuggestions.length === 0) {
    doc.setTextColor(156, 163, 175);
    doc.text('No suggestions yet', margin, y);
    y += 14;
  } else {
    stats.topSuggestions.forEach((s) => {
      ensureSpace(14);
      doc.setTextColor(17, 24, 39);
      const wrapped = doc.splitTextToSize(s.text, pageW - margin * 2 - 40);
      wrapped.forEach((ln: string, idx: number) => {
        ensureSpace(12);
        doc.text(ln, margin, y);
        if (idx === 0) {
          doc.setFont('helvetica', 'bold');
          doc.text(`×${s.count}`, pageW - margin, y, { align: 'right' });
          doc.setFont('helvetica', 'normal');
        }
        y += 11;
      });
      y += 3;
    });
  }

  // Footer page numbers
  const pageCount = (doc as any).internal.pages.length - 1;
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Page ${p} / ${pageCount}`, pageW - margin, pageH - 16, { align: 'right' });
  }

  doc.save(`${safeFileBase(feedback.feedbackTitle)}_report.pdf`);
}
