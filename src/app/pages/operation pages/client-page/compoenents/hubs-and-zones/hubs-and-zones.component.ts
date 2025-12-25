import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ApiHub, ApiZone, HubsZonesService } from '../../../../../services/hubs-zones/hubs-zones-service.service';
import { ExportButtonComponent } from '../../../../../shared/export-button/export-button';
import { ImportButtonComponent } from '../../../../../shared/import-button/import-button.component';


type ImportRow = { hubName: string; zoneName: string };

@Component({
  selector: 'app-hubs-and-zones',
  standalone: true,
  imports: [CommonModule, FormsModule, ImportButtonComponent, ExportButtonComponent],
  templateUrl: './hubs-and-zones.component.html',
  styleUrls: ['./hubs-and-zones.component.scss'],
})
export class HubsAndZonesComponent implements OnInit, OnChanges {
  @Input() clientId!: number;

  hubs: ApiHub[] = [];
  zones: ApiZone[] = [];

  selectedHubId: number | null = null;

  newHubName = '';
  newZoneName = '';

  loadingHubs = false;
  loadingZones = false;

  errorMsg: string | null = null;
  successMsg: string | null = null;

  importing = false;
  importSummary: { createdHubs: number; createdZones: number; skippedZones: number } | null = null;

  constructor(private hubsZonesService: HubsZonesService) {}

  ngOnInit(): void {
    if (this.clientId) this.loadHubs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['clientId'] && !changes['clientId'].firstChange) {
      this.loadHubs();
    }
  }

  /* =========================
   * Export (computed data)
   * ========================= */
  get exportRows(): Array<{ 'Hub Name': string; Zone: string }> {
    const rows: Array<{ 'Hub Name': string; Zone: string }> = [];
    for (const hub of this.hubs) {
      const z = hub.zones ?? [];
      if (!z.length) {
        rows.push({ 'Hub Name': hub.name, Zone: '' });
      } else {
        for (const zone of z) rows.push({ 'Hub Name': hub.name, Zone: zone.name });
      }
    }
    return rows;
  }

  get exportFilename(): string {
    return `hubs-zones-client-${this.clientId}.xlsx`;
  }

  /* =========================
   * Loading
   * ========================= */
  loadHubs(): void {
    if (!this.clientId) return;

    this.loadingHubs = true;
    this.errorMsg = null;
    this.successMsg = null;

    this.hubsZonesService.getHubsByClient(this.clientId, true).subscribe({
      next: (list) => {
        // ensure zones array exists for safety
        this.hubs = (list || []).map(h => ({ ...h, zones: h.zones ?? [] }));
        this.loadingHubs = false;

        if (this.hubs.length > 0) {
          const exists = this.hubs.some(h => h.id === this.selectedHubId);
          if (!exists) this.selectedHubId = this.hubs[0].id;

          this.syncZonesFromSelectedHub();
        } else {
          this.selectedHubId = null;
          this.zones = [];
        }
      },
      error: (err) => {
        console.error('Failed to load hubs', err);
        this.loadingHubs = false;
        this.errorMsg = 'Failed to load hubs.';
      },
    });
  }

  private syncZonesFromSelectedHub(): void {
    if (!this.selectedHubId) {
      this.zones = [];
      return;
    }

    const hub = this.hubs.find(h => h.id === this.selectedHubId);
    if (hub?.zones) {
      this.zones = [...hub.zones].sort((a, b) => a.name.localeCompare(b.name));
      this.loadingZones = false;
      return;
    }

    // fallback (if backend did not include zones)
    this.loadZonesForSelected();
  }

  private loadZonesForSelected(): void {
    if (!this.selectedHubId) {
      this.zones = [];
      return;
    }

    this.loadingZones = true;
    this.errorMsg = null;

    this.hubsZonesService.getZonesByHub(this.selectedHubId).subscribe({
      next: (list) => {
        const zones = (list || []).slice().sort((a, b) => a.name.localeCompare(b.name));
        this.zones = zones;
        this.loadingZones = false;

        // sync back into hubs array
        const idx = this.hubs.findIndex(h => h.id === this.selectedHubId);
        if (idx >= 0) this.hubs[idx] = { ...this.hubs[idx], zones };
      },
      error: (err) => {
        console.error('Failed to load zones', err);
        this.loadingZones = false;
        this.errorMsg = 'Failed to load zones.';
      },
    });
  }

  /* =========================
   * Actions: Add Hub / Zone
   * ========================= */
  addHub(): void {
    const name = this.newHubName.trim();
    if (!name || !this.clientId) return;

    this.errorMsg = null;
    this.successMsg = null;

    this.hubsZonesService.createHub({ name, clientId: this.clientId }).subscribe({
      next: (hub) => {
        const hubWithZones: ApiHub = { ...hub, zones: [] };
        this.hubs = [...this.hubs, hubWithZones].sort((a, b) => a.name.localeCompare(b.name));
        this.newHubName = '';
        this.selectedHubId = hub.id;
        this.syncZonesFromSelectedHub();
        this.successMsg = 'Hub created.';
      },
      error: (err) => {
        console.error('Failed to create hub', err);
        this.errorMsg = 'Failed to create hub.';
      },
    });
  }

  addZone(): void {
    const name = this.newZoneName.trim();
    if (!name || !this.selectedHubId) return;

    this.errorMsg = null;
    this.successMsg = null;

    this.hubsZonesService.createZone({ name, hubId: this.selectedHubId }).subscribe({
      next: (zone) => {
        // update right list
        this.zones = [...this.zones, zone].sort((a, b) => a.name.localeCompare(b.name));
        this.newZoneName = '';

        // sync into selected hub zones
        const idx = this.hubs.findIndex(h => h.id === this.selectedHubId);
        if (idx >= 0) {
          const existing = this.hubs[idx].zones ?? [];
          this.hubs[idx] = { ...this.hubs[idx], zones: [...existing, zone].sort((a, b) => a.name.localeCompare(b.name)) };
        }

        this.successMsg = 'Zone created.';
      },
      error: (err) => {
        console.error('Failed to create zone', err);
        this.errorMsg = 'Failed to create zone.';
      },
    });
  }

  onHubChange(idStr: string): void {
    const id = Number(idStr);
    this.selectedHubId = Number.isNaN(id) ? null : id;
    this.syncZonesFromSelectedHub();
  }

  /* =========================
   * Import
   * ========================= */
  async onImportFile(file: File): Promise<void> {
    if (!this.clientId) return;

    this.importing = true;
    this.importSummary = null;
    this.errorMsg = null;
    this.successMsg = null;

    try {
      const rows = await this.parseImportFile(file);

      if (!rows.length) {
        this.errorMsg = 'No valid rows found in the file.';
        return;
      }

      // guardrail
      if (rows.length > 5000) {
        this.errorMsg = 'File is too large (max 5000 rows).';
        return;
      }

      // group by hub
      const grouped = this.groupRows(rows); // Map<hubName, Set<zoneName>>
      const existingHubs = await firstValueFrom(this.hubsZonesService.getHubsByClient(this.clientId, true));
      const hubs = (existingHubs || []).map(h => ({ ...h, zones: h.zones ?? [] }));

      const hubByNorm = new Map<string, ApiHub>();
      const zoneSetByHubId = new Map<number, Set<string>>();

      for (const h of hubs) {
        hubByNorm.set(this.norm(h.name), h);
        zoneSetByHubId.set(h.id, new Set((h.zones ?? []).map(z => this.norm(z.name))));
      }

      let createdHubs = 0;
      let createdZones = 0;
      let skippedZones = 0;

      for (const [hubName, zonesSet] of grouped.entries()) {
        const hubNorm = this.norm(hubName);
        let hub = hubByNorm.get(hubNorm);

        if (!hub) {
          hub = await firstValueFrom(this.hubsZonesService.createHub({ name: hubName, clientId: this.clientId }));
          hub = { ...hub, zones: [] };
          hubByNorm.set(hubNorm, hub);
          zoneSetByHubId.set(hub.id, new Set());
          createdHubs++;
        }

        const existingZonesNorm = zoneSetByHubId.get(hub.id)!;

        for (const zoneName of zonesSet) {
          const zNorm = this.norm(zoneName);
          if (!zNorm) continue;

          if (existingZonesNorm.has(zNorm)) {
            skippedZones++;
            continue;
          }

          const zone = await firstValueFrom(this.hubsZonesService.createZone({ name: zoneName, hubId: hub.id }));
          existingZonesNorm.add(zNorm);
          createdZones++;

          // optional: update local hub zones (in case you want immediate reflect)
          hub.zones = [...(hub.zones ?? []), zone];
        }
      }

      this.importSummary = { createdHubs, createdZones, skippedZones };
      this.successMsg = `Import done: ${createdHubs} hub(s), ${createdZones} zone(s) created, ${skippedZones} duplicate zone(s) skipped.`;

      // refresh from server (source of truth)
      this.loadHubs();
    } catch (e) {
      console.error('Import failed', e);
      this.errorMsg = 'Import failed. Please verify file format (Hub Name / Zone) and try again.';
    } finally {
      this.importing = false;
    }
  }

  private groupRows(rows: ImportRow[]): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();

    for (const r of rows) {
      const hubName = (r.hubName || '').trim();
      const zoneName = (r.zoneName || '').trim();

      if (!hubName) continue;

      if (!map.has(hubName)) map.set(hubName, new Set<string>());
      if (zoneName) map.get(hubName)!.add(zoneName);
    }

    return map;
  }

  private norm(s: string): string {
    return (s || '').trim().toLowerCase();
  }

  /* =========================
   * File Parsing (XLSX/CSV)
   * ========================= */
  private async parseImportFile(file: File): Promise<ImportRow[]> {
    const name = (file.name || '').toLowerCase();

    if (name.endsWith('.csv')) {
      const text = await file.text();
      return this.parseCsv(text);
    }

    // XLSX / XLS
    const arrayBuffer = await file.arrayBuffer();
    const XLSX = await this.loadXlsx();
    if (!XLSX?.read) {
      throw new Error('XLSX library not found. Please install/import SheetJS or use CSV.');
    }

    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = wb.SheetNames?.[0];
    if (!sheetName) return [];

    const sheet = wb.Sheets[sheetName];
    const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    return this.mapToRows(json);
  }

  private async loadXlsx(): Promise<any> {
    // 1) try window.XLSX (if you load it via script tag)
    const winXlsx = (window as any)?.XLSX;
    if (winXlsx?.read && winXlsx?.utils) return winXlsx;

    // 2) try dynamic import (if you installed "xlsx" package)
    try {
      const mod: any = await import('xlsx');
      return mod;
    } catch {
      return null;
    }
  }

  private mapToRows(objects: any[]): ImportRow[] {
    const rows: ImportRow[] = [];

    for (const obj of objects || []) {
      const keys = Object.keys(obj || {});
      const pick = (candidates: string[]) => {
        for (const k of keys) {
          const nk = this.normHeader(k);
          if (candidates.includes(nk)) return String(obj[k] ?? '').trim();
        }
        return '';
      };

      const hubName = pick(['hubname', 'hub', 'hub_name', 'hub-name', 'hub name']);
      const zoneName = pick(['zone', 'zonename', 'zone_name', 'zone-name', 'zone name']);

      if (hubName) rows.push({ hubName, zoneName });
    }

    return rows;
  }

  private parseCsv(text: string): ImportRow[] {
    const lines = (text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(l => l.trim() !== '');

    if (lines.length < 2) return [];

    const headers = this.parseCsvLine(lines[0]).map(h => h.trim());
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = this.parseCsvLine(lines[i]);
      const obj: any = {};
      headers.forEach((h, idx) => (obj[h] = cells[idx] ?? ''));
      rows.push(obj);
    }

    return this.mapToRows(rows);
  }

  private parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else {
        if (ch === ',') {
          out.push(cur);
          cur = '';
        } else if (ch === '"') {
          inQuotes = true;
        } else {
          cur += ch;
        }
      }
    }

    out.push(cur);
    return out.map(s => s.trim());
  }

  private normHeader(h: string): string {
    return (h || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[\s_-]/g, '');
  }

  async downloadTemplate(): Promise<void> {
  try {
    const headers = ['Hub Name', 'Zone'];

    // حاول XLSX (SheetJS)
    const XLSX = await this.loadXlsxForTemplate();
    if (XLSX?.utils?.book_new) {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Template (header only)
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      // عرض الأعمدة (اختياري)
      ws['!cols'] = [{ wch: 28 }, { wch: 28 }];

      XLSX.utils.book_append_sheet(wb, ws, 'Template');

      // Sheet 2: Notes (اختياري - تعليمات سريعة)
      const notes = XLSX.utils.aoa_to_sheet([
        ['Notes'],
        ['1) Each row = one Zone under a Hub.'],
        ['2) Hub Name can repeat in multiple rows; it will merge zones.'],
        ['3) Duplicate (same Hub Name + same Zone) will be skipped.'],
        ['4) Zone can be empty to create Hub only.'],
      ]);
      notes['!cols'] = [{ wch: 60 }];
      XLSX.utils.book_append_sheet(wb, notes, 'Notes');

      XLSX.writeFile(wb, `hubs-zones-template-client-${this.clientId || 'x'}.xlsx`);
      return;
    }

    // Fallback CSV (header only)
    const csv = `${headers.join(',')}\n`;
    this.downloadBlob(csv, `hubs-zones-template-client-${this.clientId || 'x'}.csv`, 'text/csv;charset=utf-8;');
  } catch (e) {
    console.error('downloadTemplate failed', e);
    // fallback سريع لو أي حاجة وقعت
    const csv = `Hub Name,Zone\n`;
    this.downloadBlob(csv, `hubs-zones-template.csv`, 'text/csv;charset=utf-8;');
  }
}

private async loadXlsxForTemplate(): Promise<any> {
  // 1) لو محمّل XLSX عالميًا window.XLSX
  const winXlsx = (window as any)?.XLSX;
  if (winXlsx?.utils?.book_new) return winXlsx;

  // 2) لو مركّب باكدج xlsx
  try {
    const mod: any = await import('xlsx');
    return mod;
  } catch {
    return null;
  }
}

private downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

}
