import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

type TabMode = 'list' | 'summary';

@Component({
  selector: 'app-pr-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pr-header.component.html',
  styleUrls: ['./pr-header.component.scss'],
})
export class PrHeaderComponent {
  // ===== Inputs =====
  @Input() loading = false;

  @Input() activeTab: TabMode = 'list';

  @Input() totalRows = 0;
  @Input() summaryLastUpdatedAt: string | null = null;

  // نخلي التنسيق من الأب لتفادي اختلاف الـ locale/format
  @Input() lastUpdateLabel = '—';

  @Input() clientTabs: Array<{ id: number | null; label: string; count?: number }> = [];
  @Input() selectedClientId: number | null = null;

  // ===== Outputs =====
  @Output() downloadTemplate = new EventEmitter<void>();
  @Output() exportExcel = new EventEmitter<void>();
  @Output() importExcel = new EventEmitter<File>();

  @Output() createNew = new EventEmitter<void>();

  @Output() tabChange = new EventEmitter<TabMode>();
  @Output() clientTabChange = new EventEmitter<number | null>();

  // ===== File handling inside header =====
  onPickFile(input: HTMLInputElement): void {
    if (this.loading) return;
    input.value = '';
    input.click();
  }

  onFileChanged(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importExcel.emit(file);
  }

  setTab(tab: TabMode): void {
    if (this.loading) return;
    this.tabChange.emit(tab);
  }

  setClientTab(id: number | null): void {
    if (this.loading) return;
    this.clientTabChange.emit(id);
  }
}