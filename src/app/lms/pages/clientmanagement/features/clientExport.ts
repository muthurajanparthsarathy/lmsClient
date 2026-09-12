import type { Client } from '../api/clientManagementService'
import { businessModelFullName, fmtCreatedDate, fmtDate, orderedContacts } from './lib'
import { BRAND_MARK_PNG, BRAND_NAME } from '../../reportsettings/api/brand'

export const EXPORT_FIELDS = [
    { key: 'serial', label: 'S. No.' },
    { key: 'name', label: 'Client Name' },
    { key: 'model', label: 'Business Model' },
    { key: 'contact', label: 'Contact Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Contact Number' },
    { key: 'created', label: 'Created Date' },
] as const
export type ExportField = typeof EXPORT_FIELDS[number]['key']
export type ExportFormat = 'csv' | 'pdf' | 'print'

export function exportCell(client: Client, field: ExportField, index: number): string {
    const contact = orderedContacts(client.contactPersons)[0]
    const cells = {
        serial: String(index + 1), name: client.clientCompany || '—',
        model: businessModelFullName(client.businessModel) || '—',
        contact: contact?.name || '—', email: contact?.email || '—',
        phone: contact?.phoneNumber || '—', created: fmtCreatedDate(client.createdAt),
    }
    return cells[field]
}

export function csvCell(value: string): string {
    // Keep user-entered names and phone numbers from becoming spreadsheet formulas.
    const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value
    return `"${safe.replace(/"/g, '""')}"`
}

const htmlEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function outputClients(format: ExportFormat, rows: Client[], fields: ExportField[]) {
    const columns = EXPORT_FIELDS.filter((field) => fields.includes(field.key))
    const head = columns.map((field) => field.label)
    const body = rows.map((row, index) => columns.map((field) => exportCell(row, field.key, index)))
    const generated = fmtDate(new Date().toISOString())
    const filename = `clients-${new Date().toISOString().slice(0, 10)}`
    if (format === 'csv') {
        const content = [head, ...body].map((row) => row.map(csvCell).join(',')).join('\r\n')
        const url = URL.createObjectURL(new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' }))
        const link = document.createElement('a')
        link.href = url; link.download = `${filename}.csv`
        document.body.appendChild(link); link.click(); link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
    } else if (format === 'pdf') {
        const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
        const doc = new JsPDF({ orientation: columns.length > 4 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' })
        // SmartCliff masthead — mark and brand name on every printed sheet.
        try { doc.addImage(BRAND_MARK_PNG, 'PNG', 36, 24, 26, 26) } catch { /* mark best-effort */ }
        doc.setFontSize(14); doc.setTextColor(16, 24, 40); doc.text(BRAND_NAME, 70, 42)
        doc.setDrawColor(226, 97, 63); doc.setLineWidth(0.8); doc.line(36, 56, doc.internal.pageSize.getWidth() - 36, 56)
        doc.setFontSize(16); doc.setTextColor(30); doc.text('Clients', 36, 78)
        doc.setFontSize(9); doc.setTextColor(90); doc.text(`${rows.length} clients · Generated ${generated}`, 36, 96)
        autoTable(doc, { startY: 112, head: [head], body, margin: 36,
            styles: { fontSize: 8, cellPadding: 6, overflow: 'linebreak' },
            headStyles: { fillColor: [154, 52, 18] }, alternateRowStyles: { fillColor: [250, 248, 246] } })
        doc.save(`${filename}.pdf`)
    } else {
        // Open synchronously from the click, before any asynchronous work.
        const win = window.open('', '_blank', 'width=1100,height=800')
        if (!win) throw new Error('Allow pop-ups to open the print preview.')
        win.opener = null
        win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Clients</title><style>.brand{display:flex;align-items:center;gap:12px;padding-bottom:10px;border-bottom:2px solid #E2613F;margin-bottom:16px}.brand img{width:36px;height:36px;object-fit:contain}.brand .name{font-size:16px;font-weight:700;color:#101828;letter-spacing:.2px}@media print{.brand{padding-bottom:6px;margin-bottom:10px}}
            body{font:12px Arial,sans-serif;color:#1f2937;padding:24px}h1{font-size:22px;margin-bottom:6px}p{color:#64748b;margin-bottom:20px}
            table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{padding:9px;border-bottom:1px solid #e5e7eb;text-align:left;overflow-wrap:anywhere}th{background:#fff3e8}tr:nth-child(even){background:#fafafa}tr{break-inside:avoid}thead{display:table-header-group}
            @page{size:A4 ${columns.length > 4 ? 'landscape' : 'portrait'};margin:12mm}@media print{body{padding:0}}
            </style></head><body><div class="brand"><img src="${BRAND_MARK_PNG}" alt=""><span class="name">${htmlEscape(BRAND_NAME)}</span></div><h1>Clients</h1><p>${rows.length} clients · Generated ${htmlEscape(generated)}</p>
            <table><thead><tr>${head.map((cell) => `<th>${htmlEscape(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${htmlEscape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`)
        win.document.close()
        setTimeout(() => { if (!win.closed) { win.focus(); win.print() } }, 150)
    }
}
