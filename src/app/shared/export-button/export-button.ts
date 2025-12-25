import { Component, Input } from '@angular/core';

@Component({
  selector: 'export-button',
  standalone: true,
  templateUrl: './export-button.html',
  styleUrls: ['./export-button.scss'],
})
export class ExportButtonComponent {
  @Input() data: any[] = [];
  @Input() filename = 'export.csv';

  export(): void {
    if (!this.data || !this.data.length) {
      alert('No data available to export.');
      return;
    }

    // 1) Try SheetJS from window
    const XLSX: any = (window as any)?.XLSX;
    if (XLSX?.utils) {
      try {
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(this.data);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        const xlsxName = this.filename.replace(/\.csv$/i, '.xlsx');
        XLSX.writeFile(workbook, xlsxName);
        return;
      } catch (e) {
        console.warn('XLSX export failed, falling back to CSV.', e);
      }
    }

    // 2) Fallback CSV
    const headers = Array.from(new Set(this.data.flatMap(r => Object.keys(r))));
    const csv = [headers.join(','), ...this.data.map(r => headers.map(h => this.escape(r[h])).join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const name = this.filename.toLowerCase().endsWith('.csv')
      ? this.filename
      : this.filename.replace(/\.(xlsx|xls)$/i, '.csv');

    link.setAttribute('href', url);
    link.setAttribute('download', name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private escape(val: any): string {
    if (val === null || val === undefined) return '';
    const s = String(val).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  }
}
