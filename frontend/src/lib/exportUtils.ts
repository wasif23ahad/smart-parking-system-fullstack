import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface ExportData {
    headers: string[];
    rows: (string | number)[][];
    title: string;
}

export const exportToCSV = (data: ExportData, filename: string) => {
    const csvContent = [
        data.headers.join(','),
        ...data.rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${filename}.csv`);
};

export const exportToExcel = (data: ExportData, filename: string) => {
    const worksheet = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${filename}.xlsx`);
};

export const exportToPDF = (data: ExportData, filename: string) => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(data.title, 14, 22);

    doc.setFontSize(11);
    doc.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 30);

    // Use autoTable directly with the doc instance
    autoTable(doc, {
        startY: 40,
        head: [data.headers],
        body: data.rows,
    });

    doc.save(`${filename}.pdf`);
};
