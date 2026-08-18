import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
interface PrintComponentProps {
    logo?: string;
    logoPosition?: 'left' | 'right' | 'both';
    leftLogo?: string;
    rightLogo?: string;
    heading?: string;
    tableComponent?: React.ReactNode;
    signature?: string;
    landscape?: boolean;
    isDialog?: boolean;
    preparedBy?: string;
    watermarkText?: string;
    watermarkImage?: string;
    watermarkOpacity?: number;
    watermarkSize?: number;
    watermarkRepeat?: boolean;
    watermarkMaxWidth?: number;
    watermarkMaxHeight?: number;
    // New props for summary
    showSummary?: boolean;
    summaryData?: {
        selectedPedagogyTypes: string[];
        activityTypes: {
            iDo: string[];
            weDo: string[];
            youDo: string[];
        };
        exportSelections: {
            pedagogy: {
                iDo: string[];
                weDo: string[];
                youDo: string[];
            };
        };
        calculateTotalHours: (type: "iDo" | "weDo" | "youDo", activity: string) => number;
    };
    courseDetails?: {
        courseName: string;
        courseCode: string;
        clientName: string;
        serviceType: string;
        serviceModal: string;
        category: string;
        courseLevel: string;
    };
}

export interface PrintComponentRef {
    handlePrint: () => void;
}

const PrintComponent = forwardRef<PrintComponentRef, PrintComponentProps>(({
    logo = '',
    logoPosition = '',
    heading = '',
    tableComponent,
    landscape = false,
    isDialog = false,
    watermarkText = '',
    watermarkImage = '',
    watermarkOpacity = 0.1,
    watermarkSize = 200,
    watermarkRepeat = true,
    showSummary = false,
    summaryData,
    courseDetails,
}, ref) => {
    const printRef = useRef<HTMLDivElement>(null);


    const processTableForPrint = () => {
        if (!printRef.current) return;
        const tables = printRef.current.querySelectorAll('table');
        tables.forEach(table => {
            const cells = table.querySelectorAll('td, th');
            cells.forEach(cell => {
                const cellContent = cell.textContent?.trim();
                cell.classList.remove('cursor-not-allowed', 'opacity-50');

                if (!cellContent || cellContent === '' || cellContent === '0') {
                    const isHeaderCell = cell.tagName === 'TH';
                    const isHierarchyCell = cell.classList.contains('bg-blue-50') ||
                        cell.classList.contains('bg-blue-100');
                    const isTotalRow = cell.closest('tr')?.classList.contains('bg-gray-200');

                    if (!isHeaderCell && !isTotalRow && cellContent !== '0') {
                        if (isHierarchyCell && (
                            cellContent === 'Default Module' ||
                            cellContent === 'Default Submodule' ||
                            cellContent === 'Default Topic' ||
                            cellContent === 'Default Subtopic' ||
                            cellContent === ''
                        )) {
                            cell.textContent = '-';
                        }
                        else if (!isHierarchyCell && cellContent === '') {
                            cell.textContent = '-';
                        }
                    }
                    else if (isTotalRow && cellContent === '') {
                        cell.textContent = '0';
                    }
                }

                // Remove the activity name matching logic and replace with type-based coloring
                if (!cell.classList.contains('bg-blue-50') &&
                    !cell.classList.contains('bg-blue-100') &&
                    !cell.classList.contains('bg-gray-200')
                ) {
                    // Find which column this cell belongs to and determine its type
                    const columnIndex = Array.from(cell.parentNode?.children || []).indexOf(cell);
                    const headerRow = table.querySelector('thead tr:first-child'); // Get the main header row

                    if (headerRow) {
                        // Find the header cell that spans this column
                        let currentCol = 0;
                        let cellType = '';

                        for (let i = 0; i < headerRow.children.length; i++) {
                            const headerCell = headerRow.children[i];
                            const colSpan = parseInt(headerCell.getAttribute('colspan') || '1');

                            if (columnIndex >= currentCol && columnIndex < currentCol + colSpan) {
                                const headerText = headerCell.textContent?.trim().toLowerCase();

                                // Determine type based on header text (similar to renderActivityCell)
                                if (headerText?.includes('i do') || headerText?.includes('ido')) {
                                    cellType = 'iDo';
                                } else if (headerText?.includes('we do') || headerText?.includes('wedo')) {
                                    cellType = 'weDo';
                                } else if (headerText?.includes('you do') || headerText?.includes('youdo')) {
                                    cellType = 'youDo';
                                }
                                break;
                            }
                            currentCol += colSpan;
                        }

                        // Apply background color based on type (like renderActivityCell)
                        if (cellType === 'iDo') {
                            if (!cell.classList.contains('bg-yellow-50') && !cell.classList.contains('bg-yellow-100')) {
                                cell.classList.add('bg-yellow-50');
                            }
                        } else if (cellType === 'weDo') {
                            if (!cell.classList.contains('bg-orange-50') && !cell.classList.contains('bg-orange-100')) {
                                cell.classList.add('bg-orange-50');
                            }
                        } else if (cellType === 'youDo') {
                            if (!cell.classList.contains('bg-green-50') && !cell.classList.contains('bg-green-100')) {
                                cell.classList.add('bg-green-50');
                            }
                        }
                    }
                }
            });
        });
    };

    const generateSummaryHTML = () => {
        if (!showSummary || !summaryData) return '';

        const { selectedPedagogyTypes, activityTypes, exportSelections, calculateTotalHours } = summaryData;

        // Filter activities based on selections
        const filteredActivities = {
            iDo: Array.isArray(exportSelections.pedagogy.iDo) ? exportSelections.pedagogy.iDo : [],
            weDo: Array.isArray(exportSelections.pedagogy.weDo) ? exportSelections.pedagogy.weDo : [],
            youDo: Array.isArray(exportSelections.pedagogy.youDo) ? exportSelections.pedagogy.youDo : [],
        };

        const totalSelectedActivities = filteredActivities.iDo.length + filteredActivities.weDo.length + filteredActivities.youDo.length;

        if (totalSelectedActivities === 0) return '';

        // Calculate grand total
        const grandTotal = Object.entries(filteredActivities).reduce((sum, [type, activities]) => {
            return sum + (activities || []).reduce((typeSum, activity) => {
                return typeSum + calculateTotalHours(type as "iDo" | "weDo" | "youDo", activity);
            }, 0);
        }, 0);

        let summaryHTML = `
            <div class="summary-container">
                <br>
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th colspan="3" class="summary-header">Teaching Elements Summary</th>
                        </tr>
                        <tr class="summary-column-headers">
                            <th class="summary-col-header">Activity Type</th>
                            <th class="summary-col-header">Elements</th>
                            <th class="summary-col-header">Hours</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Add I Do activities
        if (filteredActivities.iDo.length > 0) {
            filteredActivities.iDo.forEach((activity, index) => {
                const total = calculateTotalHours("iDo", activity);
                summaryHTML += `
                    <tr class="ido-row">
                        ${index === 0 ? `<td class="activity-type-cell ido-bg" rowspan="${filteredActivities.iDo.length}">I Do Activities</td>` : ''}
                        <td class="activity-name ido-bg">${activity}</td>
                        <td class="activity-hours ido-bg">${total}</td>
                    </tr>
                `;
            });
        }

        // Add We Do activities
        if (filteredActivities.weDo.length > 0) {
            filteredActivities.weDo.forEach((activity, index) => {
                const total = calculateTotalHours("weDo", activity);
                summaryHTML += `
                    <tr class="wedo-row">
                        ${index === 0 ? `<td class="activity-type-cell wedo-bg" rowspan="${filteredActivities.weDo.length}">We Do Activities</td>` : ''}
                        <td class="activity-name wedo-bg">${activity}</td>
                        <td class="activity-hours wedo-bg">${total}</td>
                    </tr>
                `;
            });
        }

        // Add You Do activities
        if (filteredActivities.youDo.length > 0) {
            filteredActivities.youDo.forEach((activity, index) => {
                const total = calculateTotalHours("youDo", activity);
                summaryHTML += `
                    <tr class="youdo-row">
                        ${index === 0 ? `<td class="activity-type-cell youdo-bg" rowspan="${filteredActivities.youDo.length}">You Do Activities</td>` : ''}
                        <td class="activity-name youdo-bg">${activity}</td>
                        <td class="activity-hours youdo-bg">${total}</td>
                    </tr>
                `;
            });
        }

        // Add grand total row
        summaryHTML += `
                        <tr class="grand-total-row">
                            <td colspan="2" class="grand-total-label">Total Hours</td>
                            <td class="grand-total-hours">${grandTotal}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        return summaryHTML;
    };


    const handlePrint = () => {
        if (!printRef.current) return;
        const componentHTML = printRef.current.innerHTML;
        const summaryHTML = generateSummaryHTML();

        const watermarkContent = watermarkImage
            ? `<img src="${watermarkImage}" alt="Watermark" style="max-width: ${watermarkSize}px; max-height: ${watermarkSize}px; width: auto; height: auto;" />`
            : watermarkText || '';

        const generateCourseDetailsHTML = () => {
            if (!courseDetails) return '';

            return `
    <div class="course-details">
        <table class="course-details-table">
            <tr>
                <th>Client Name</th>
                <td>${courseDetails.clientName || 'N/A'}</td>
                 <th>Course Code</th>
                <td>${courseDetails.courseCode || 'N/A'}</td>
            </tr>
            <tr>
                <th>Service Type</th>
                <td>${courseDetails.serviceType || 'N/A'}</td>
                <th>Service Modal</th>
                <td>${courseDetails.serviceModal || 'N/A'}</td>
            </tr>
            <tr>
                <th>Category</th>
                <td>${courseDetails.category || 'N/A'}</td>
                <th>Level</th>
                <td>${courseDetails.courseLevel || 'N/A'}</td>
            </tr>
        </table>
    </div>
    `;
        };

        const printHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
       
        .print-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 8mm;
            border-bottom: 2px solid #333;
            margin-bottom: 15px;
        }
        .content-container {
            position: relative;
            z-index: 2;
        }
        body::before {
            content: "";
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: ${watermarkRepeat ?
                `repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent ${landscape ? '180mm' : '250mm'},
                    rgba(0,0,0,0) ${landscape ? '180mm' : '250mm'},
                    rgba(0,0,0,0) ${landscape ? '210mm' : '297mm'}
                )` : 'none'};
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: -1;
            pointer-events: none;
        }
        .watermark-page {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) ${watermarkImage ? 'rotate(0deg)' : 'rotate(-45deg)'};
            opacity: ${watermarkOpacity};
            z-index: 9999;
            pointer-events: none;
            user-select: none;
            font-family: Arial, sans-serif;
            text-transform: uppercase;
            letter-spacing: 8px;
            white-space: nowrap;
            ${watermarkImage ? '' : `
                font-size: 60px;
                font-weight: bold;
                color: rgba(0, 0, 0, 1);
            `}
        }
        .watermark-page img {
            z-index: 9999;
            opacity: 1;
            filter: alpha(opacity=100);
        }
        .logo-container {
            width: 80px;
            height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .logo {
            max-width: 100%;
            max-height: 100%;
        }
       
        .heading {
            margin: 0;
            font-size: 22px;
            color: #333;
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            page-break-inside: auto;
            background: rgba(255, 255, 255, 0.95);
            position: relative;
            z-index: 2;
        }
        tr {
            page-break-inside: avoid;
            page-break-after: auto;
        }
        th, td {
        
            border: 1px solid #94a3b8;
            padding: 3px;
            font-size: 8px;
             white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
            background: inherit;
        }
        th {
        
            background-color: #dbeafe !important;
            font-weight: bold;
             white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
        }
        .table-container td.bg-blue-50,
        .table-container td.bg-blue-100 {
            text-align: left !important;
            padding-left: 4px !important;
        }
        .table-container .sticky {
            position: static !important;
            left: auto !important;
        }
        .table-container .bg-yellow-50,
        .table-container .bg-yellow-100,
        .table-container .bg-yellow-200 {
         text-align: center !important;
            background-color: #fef9c3 !important;
        }
        .table-container .bg-orange-50,
        .table-container .bg-orange-100,
        .table-container .bg-orange-200 {
         text-align: center !important;
            background-color: #ffedd5 !important;
        }
        .table-container .bg-green-50,
        .table-container .bg-green-100,
        .table-container .bg-green-200 {
         text-align: center !important;
            background-color: #dcfce7 !important;
        }
        .table-container .bg-blue-50,
        .table-container .bg-blue-100 {
        
            background-color: #dbeafe !important;
        }
        .table-container .bg-gray-50,
        .table-container .bg-gray-100,
        .table-container .bg-gray-200 {
         text-align: center !important;
            background-color: #f3f4f6 !important;
        }
        .table-container button,
        .table-container input,
        .table-container .opacity-50 {
            display: none !important;
        }
        .table-container .cursor-not-allowed,
        .table-container .cursor-pointer,
        .table-container td,
        .table-container th {
            cursor: default !important;
            opacity: 1 !important;
        }
        .table-container td {
            background-color: inherit !important;
        }
        .table-container td:empty::after {
            content: "-";
            color: #333;
            font-weight: normal;
        }
        .table-container td:not(.bg-blue-50):not(.bg-blue-100):not(.bg-gray-200) {
            min-height: 20px;
        }
        .table-container td:not(.bg-blue-50):not(.bg-blue-100):not(.bg-gray-200):empty {
            background-color: #f9fafb !important;
        }

        /* Summary Styles */
        .summary-container {
            margin-top: 30px;
            display: flex;
            justify-content: center;
            width: 100%;
            page-break-inside: avoid;
        }
        
        .summary-table {
            width: 60% !important;
            max-width: 500px;
            border-collapse: collapse;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            position: relative;
            z-index: 2;
        }
        
        .summary-header {
            background-color: #3b82f6 !important;
            color: white !important;
            font-weight: bold;
            font-size: 12px !important;
            text-align: center;
            padding: 8px !important;
        }
        
        .summary-column-headers th {
            background-color: #10b981 !important;
            color: white !important;
            font-weight: bold;
            font-size: 10px !important;
            text-align: center;
            padding: 6px !important;
        }
        
        .summary-col-header:first-child {
            width: 30%;
        }
        .summary-col-header:nth-child(2) {
            width: 50%;
        }
        .summary-col-header:last-child {
            width: 20%;
        }
        
        .activity-type-cell {
            font-weight: bold !important;
            vertical-align: middle !important;
            text-align: left !important;
            padding-left: 8px !important;
            font-size: 9px !important;
        }
        
        .activity-name {
            text-align: left !important;
            padding-left: 8px !important;
            font-size: 9px !important;
        }
        
        .activity-hours {
            text-align: center !important;
            font-size: 9px !important;
        }
        
        .ido-bg {
        
            background-color: #fef9c3 !important;
        }
        
        .wedo-bg {
            background-color: #ffedd5 !important;
        }
        
        .youdo-bg {
            background-color: #dcfce7 !important;
        }
        
        .grand-total-row td {
            background-color: #fbbf24 !important;
            font-weight: bold !important;
            font-size: 10px !important;
            padding: 8px !important;
        }
        
        .grand-total-label {
            text-align: left !important;
            padding-left: 8px !important;
        }
        
        .grand-total-hours {
            text-align: center !important;
        }

       /* Compact Course Details Styles */
.course-details {
    margin: 15px 8mm;
    padding: 12px 15px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #f9fafb;
    font-family: Arial, sans-serif;
    page-break-inside: avoid;
}

.course-details-title {
    margin: 0 0 10px 0;
    font-size: 16px;
    font-weight: bold;
    color: #1e293b;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 6px;
}

.course-details-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}

.course-details-table th {
    text-align: left;
    padding: 6px 8px;
    color: #475569;
    font-weight: 600;
    width: 20%;
    background: #f1f5f9;
    border: 1px solid #e5e7eb;
}

.course-details-table td {
    padding: 6px 8px;
    color: #111827;
    border: 1px solid #e5e7eb;
    background: #ffffff;
}


        @page {
           
            
            @bottom-left {
                content: "Generated on ${new Date().toLocaleDateString()}";
                font-size: 10px;
                color: #333;
            }
            @bottom-center {
                content: "Page " counter(page);
                font-size: 10px;
                color: #333;
            }
            @bottom-right {
                content: "Signature:";
                font-size: 10px;
                color: #333;
            }
                  .content-container {
            margin: 40mm 8mm;

              
            }
        }

         .table-container {
            margin-top: 0;
        }
        @media print {
            .regular-header {
                display: none !important;
            }
            .print-header {
                display: flex !important;
            }
            @page :not(:first) {
                .print-header {
                    display: none !important;
                }
                      
                .content-container {
                    margin: 40mm 8mm;
                }
            }
            body {
                margin: 0;
                padding: 0;
                background: white;
            }
            .content-container {
            
               
            }
            body::before {
                position: fixed;
                content: "";
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: -1;
                ${watermarkRepeat ? `
                    background-image: repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent ${landscape ? '180mm' : '250mm'},
                        rgba(0,0,0,0) ${landscape ? '180mm' : '250mm'},
                        rgba(0,0,0,0) ${landscape ? '210mm' : '297mm'}
                    );
                ` : ''}
            }
            .watermark-page {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) ${watermarkImage ? 'rotate(0deg)' : 'rotate(-45deg)'};
                z-index: 9999;
                ${watermarkImage ? '' : `
                    font-size: 80px;
                `}
            }
            .table-container {
             
                position: relative;
                z-index: 1;
            }
            .table-container table {
                page-break-inside: auto;
                width: 100% !important;
            }
            .table-container tr {
                page-break-inside: avoid;
                page-break-after: auto;
            }
            .table-container thead {
                display: table-header-group;
            }
            .table-container tbody {
                display: table-row-group;
            }
            .table-container td, 
            .table-container th {
              
                white-space: normal !important;
                page-break-inside: avoid;
            }
            .table-container * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .summary-container * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .page-break {
                page-break-before: always;
            }
            .avoid-break {
                page-break-inside: avoid;
            }
    </style>
</head>
<body>
    ${(watermarkImage || watermarkText) ? `
        <div class="watermark-page">${watermarkContent}</div>
    ` : ''}
    <!-- Print Header (only on first page) -->
    <div class="print-header">
        ${(logoPosition === 'left' || logoPosition === 'both') && logo ? `
            <div class="logo-container">
                <img src="${logo}" alt="Logo" class="logo" />
            </div>
        ` : ''}
        ${logoPosition === 'right' ? `<div style="width:80px;"></div>` : ''}
        <div class="heading-container">
            <h1 class="heading" style="font-size:${isDialog ? '18px' : '20px'};">
                ${heading}
            </h1>
        </div>
        ${(logoPosition === 'right' || logoPosition === 'both') && logo ? `
            <div class="logo-container">
                <img src="${logo}" alt="Logo" class="logo" />
            </div>
        ` : ''}
        ${logoPosition === 'left' ? `<div style="width:80px;"></div>` : ''}
    </div>

      <!-- Course Details -->
    ${generateCourseDetailsHTML()}
    
    <!-- Main Content -->
    <div class="content-container">
        ${componentHTML}
        ${summaryHTML}
    </div>
</body>
</html>
`;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const iframeWindow = iframe.contentWindow;
        if (!iframeWindow) {
            console.error("Unable to access iframe contentWindow.");
            return;
        }

        iframeWindow.document.open();
        iframeWindow.document.write(printHTML);
        iframeWindow.document.close();

        iframe.onload = () => {
            const win = iframe.contentWindow;
            if (win) {
                win.focus();
                win.print();
            }
            document.body.removeChild(iframe);
        };
    };

    useImperativeHandle(ref, () => ({
        handlePrint
    }));

    useEffect(() => {
        if (printRef.current && tableComponent) {
            setTimeout(() => {
                processTableForPrint();
            }, 100);
        }
    }, [tableComponent]);

    return (
        <div
            ref={printRef}
            className={`print-component-wrapper ${isDialog ? 'dialog-mode' : 'standalone-mode'}`}
            style={isDialog ? {
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: '100%',
                position: 'relative'
            } : {}}>
            <div
                className="table-container"
            >
                {tableComponent}
            </div>
        </div>
    );
});

export default PrintComponent;