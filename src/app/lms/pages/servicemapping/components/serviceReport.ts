import { serviceMappingApi, buildMappingPageParams, type MappingPageFilters, type ServiceMapping } from '../api/serviceMappingService'
import { businessModelDisplayName, fmtCreatedDate } from '../../clientmanagement/features/lib'
import { csvCell } from '../../clientmanagement/features/clientExport'
import { BRAND_MARK_PNG, BRAND_NAME } from '../../reportsettings/api/brand'

export type ReportView = 'details' | 'year' | 'client' | 'model'
export type ReportSection = { title: string; subtitle: string; headers: string[]; rows: string[][] }
export type ReportTable = { headers: string[]; rows: string[][]; sections?: ReportSection[] }

export async function loadServiceReport(filters: MappingPageFilters, signal: AbortSignal): Promise<ServiceMapping[]> {
    const rows: ServiceMapping[] = []
    for (let page = 1; page <= 200; page++) {
        const result = await serviceMappingApi.getPage(buildMappingPageParams(filters, page, 1000, { export: true }), signal)
        rows.push(...result.data)
        if (rows.length >= result.total) return rows
        if (!result.data.length) break
    }
    throw new Error('The full report could not be loaded. Narrow your filters and try again.')
}

const clientName = (row: ServiceMapping) => typeof row.client === 'object' && row.client ? row.client.clientCompany || 'Unnamed client' : 'Unnamed client'
const clientId = (row: ServiceMapping) => typeof row.client === 'object' && row.client ? row.client._id : row.client

export function groupedClientReport(rows: ServiceMapping[]): ReportTable {
    const groups = new Map<string, ServiceMapping[]>()
    for (const row of rows) {
        const id = String(clientId(row) || 'unknown')
        const group = groups.get(id) || []
        group.push(row)
        groups.set(id, group)
    }
    const headers = ['S. No.', 'Service ID', 'Service Model', 'Providing Year']
    const sections = [...groups.values()].sort((a, b) => clientName(a[0]).localeCompare(clientName(b[0]))).map((mappings) => {
        const first = mappings[0]
        const business = typeof first.client === 'object' && first.client ? first.client.businessModel || first.service : first.service
        return { title: clientName(first), subtitle: `${businessModelDisplayName(business)} · ${mappings.length} ${mappings.length === 1 ? 'service' : 'services'}`, headers,
            rows: [...mappings].sort((a, b) => (a.year || '').localeCompare(b.year || '', undefined, { numeric: true })).map((row, index) => [
                String(index + 1), row.serviceCode || '—', (row.serviceModels || []).join(', ') || row.service || '—', row.year || '—',
            ]) }
    })
    return { headers, rows: sections.flatMap((section) => section.rows), sections }
}

export function reportTotals(rows: ServiceMapping[]) {
    return { services: rows.length, clients: new Set(rows.map(clientId).filter(Boolean)).size,
        active: rows.filter((row) => row.status === 'active').length,
        inactive: rows.filter((row) => row.status === 'inactive').length }
}

export function serviceReportTable(rows: ServiceMapping[], view: ReportView, selectedModels: string[] = []): ReportTable {
    if (view === 'details') return {
        headers: ['S. No.', 'Client', 'Business Model', 'Service Models', 'Year', 'Service Code', 'Status', 'Created Date'],
        rows: rows.map((row, index) => [String(index + 1), clientName(row),
            businessModelDisplayName(typeof row.client === 'object' && row.client ? row.client.businessModel || row.service : row.service),
            (row.serviceModels || []).join(', ') || '—', row.year || '—', row.serviceCode || '—',
            row.status === 'active' ? 'Active' : 'Inactive', fmtCreatedDate(row.createdAt)]),
    }
    const groups = new Map<string, { label: string; rows: ServiceMapping[] }>()
    for (const row of rows) {
        const keys = view === 'year' ? [row.year || 'Unspecified'] : view === 'client' ? [String(clientId(row) || 'unknown')] :
            [...new Set((row.serviceModels || []).filter((model) => !selectedModels.length || selectedModels.includes(model)))]
        if (!keys.length && !selectedModels.length) keys.push('Unspecified')
        for (const key of keys) {
            const group = groups.get(key) || { label: view === 'client' ? clientName(row) : key, rows: [] }
            group.rows.push(row); groups.set(key, group)
        }
    }
    return {
        headers: [view === 'year' ? 'Year' : view === 'client' ? 'Client' : 'Service Model', 'Services', 'Clients', 'Active', 'Inactive'],
        rows: [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })).map((group) => {
            const total = reportTotals(group.rows)
            return [group.label, String(total.services), String(total.clients), String(total.active), String(total.inactive)]
        }),
    }
}

/** The plain layout, used when no report design is configured. `title` names
 *  the report — it heads the page and names the file — so the same exporter
 *  serves Business Reports and the Course Setup report without either having
 *  to reimplement CSV. It defaults to what this file has always written, so
 *  existing callers are unaffected. */
export async function exportServiceReport(format: 'csv' | 'pdf' | 'print', table: ReportTable, criteria: string, generated: string, title = 'Services report') {
    const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${new Date().toISOString().slice(0, 10)}`
    if (format === 'csv') {
        const lines = [[title], [criteria], [`Generated: ${generated}`], [], ...(table.sections
            ? table.sections.flatMap((section) => [[section.title], [section.subtitle], section.headers, ...section.rows, []])
            : [table.headers, ...table.rows])]
        const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }))
        const link = document.createElement('a'); link.href = url; link.download = `${filename}.csv`
        document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } else if (format === 'pdf') {
        const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
        const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
        // SmartCliff masthead — a small mark on the left, the brand name
        // beside it and a hairline rule under both. jsPDF's addImage is a
        // no-op for a bad data URL, so the mark is best-effort and never
        // fails the export; the name and title still print if it can't.
        try { doc.addImage(BRAND_MARK_PNG, 'PNG', 36, 24, 26, 26) } catch { /* mark best-effort */ }
        doc.setFontSize(14); doc.setTextColor(16, 24, 40); doc.text(BRAND_NAME, 70, 42)
        doc.setDrawColor(226, 97, 63); doc.setLineWidth(0.8); doc.line(36, 56, doc.internal.pageSize.getWidth() - 36, 56)
        doc.setFontSize(17); doc.setTextColor(30); doc.text(title, 36, 78)
        doc.setFontSize(9); doc.setTextColor(90)
        const lines = doc.splitTextToSize(`${criteria}
Generated: ${generated}`, doc.internal.pageSize.getWidth() - 72)
        doc.text(lines, 36, 98)
        let y = 114 + lines.length * 11
        for (const section of table.sections || [{ title: '', subtitle: '', ...table }]) {
            if (y > doc.internal.pageSize.getHeight() - 115) { doc.addPage(); y = 36 }
            if (section.title) {
                doc.setFontSize(12); doc.setTextColor(30); doc.text(section.title, 36, y)
                doc.setFontSize(9); doc.setTextColor(90); doc.text(section.subtitle, 36, y + 15); y += 25
            }
            autoTable(doc, { startY: y, head: [section.headers], body: section.rows, margin: 36,
                styles: { fontSize: 8, cellPadding: 6, overflow: 'linebreak' }, headStyles: { fillColor: [154, 52, 18] }, alternateRowStyles: { fillColor: [250, 248, 246] } })
            y = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 28
        }
        doc.save(`${filename}.pdf`)
    } else {
        const win = window.open('', '_blank', 'width=1100,height=800')
        if (!win) throw new Error('Allow pop-ups to open the print preview.')
        win.opener = null
        const body = (table.sections || [{ title: '', subtitle: '', ...table }]).map((section) => `<section>${section.title ? `<h2>${escape(section.title)}</h2><p>${escape(section.subtitle)}</p>` : ''}<table><thead><tr>${section.headers.map((cell) => `<th>${escape(cell)}</th>`).join('')}</tr></thead><tbody>${section.rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`).join('')
        win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font:12px Arial;color:#1f2937;padding:24px}p{color:#64748b}h2{margin:24px 0 6px;break-after:avoid}section>p{break-after:avoid}table{width:100%;table-layout:fixed;border-collapse:collapse;margin-top:20px}th,td{text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;overflow-wrap:anywhere}th{background:#fff4e9}tr:nth-child(even){background:#fafafa}tr{break-inside:avoid}thead{display:table-header-group}.brand{display:flex;align-items:center;gap:12px;padding-bottom:10px;border-bottom:2px solid #E2613F;margin-bottom:16px}.brand img{width:36px;height:36px;object-fit:contain}.brand .name{font-size:16px;font-weight:700;color:#101828;letter-spacing:.2px}@page{size:A4 landscape;margin:12mm}@media print{body{padding:0}.brand{padding-bottom:6px;margin-bottom:10px}}</style></head><body><div class="brand"><img src="${BRAND_MARK_PNG}" alt=""><span class="name">${escape(BRAND_NAME)}</span></div><h1>${title}</h1><p>${escape(criteria)}</p><p>Generated: ${escape(generated)}</p>${body}</body></html>`)
        win.document.close(); setTimeout(() => { if (!win.closed) { win.focus(); win.print() } }, 150)
    }
}
