'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatCurrency, formatDate } from './utils';

export function csvExport(data: Record<string, any>[], filename: string) {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
            const val = row[header];
            return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(','))
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export interface ColumnDef {
  header: string;
  key: string;
  format?: 'currency' | 'date' | 'number';
}

export function exportToExcel(data: any[], columns: ColumnDef[], filename: string) {
  const formattedData = data.map(row => {
    const newRow: any = {};
    columns.forEach(col => {
      let val = row[col.key];
      if (col.format === 'currency') val = formatCurrency(val);
      if (col.format === 'date') val = formatDate(val);
      newRow[col.header] = val;
    });
    return newRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportToPDF(data: any[], columns: ColumnDef[], filename: string, title: string) {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

  const head = [columns.map(c => c.header)];
  const body = data.map(row => 
    columns.map(col => {
      let val = row[col.key];
      if (col.format === 'currency') val = formatCurrency(val);
      if (col.format === 'date') val = formatDate(val);
      return val?.toString() || '';
    })
  );

  autoTable(doc, {
    startY: 36,
    head: head,
    body: body,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [63, 63, 70] },
  });

  doc.save(`${filename}.pdf`);
}
