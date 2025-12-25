import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ClientsServiceService } from '../../../services/clients/clients-service.service';
import { HubsAndZonesComponent } from './compoenents/hubs-and-zones/hubs-and-zones.component';
import { MasterComponent } from './compoenents/master/master.component';
// 👇 أضف ده (عدّل المسار حسب فولدراتك الحقيقية)

@Component({
  selector: 'app-client-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    HubsAndZonesComponent,
    MasterComponent, // 👈 مهم
  ],
  templateUrl: './client-page.component.html',
  styleUrl: './client-page.component.scss',
})
export class ClientPageComponent implements OnInit {
  clientIdParam: string | null = null;
  clientNumericId: number | null = null;

  clientName: string = 'Loading...';
  activeTab: 'Master' | 'Loans' | 'Breakdown' | 'HubsAndZones' = 'Master';

  constructor(
    private route: ActivatedRoute,
    private clientsService: ClientsServiceService,
  ) {}

  ngOnInit(): void {
    this.clientIdParam = this.route.snapshot.paramMap.get('id');

    if (this.clientIdParam) {
      const num = Number(this.clientIdParam);
      this.clientNumericId = Number.isNaN(num) ? null : num;
    }

    if (this.clientNumericId !== null) {
      this.loadClientName(this.clientNumericId);
    } else {
      this.clientName = 'Unknown client';
    }
  }

  private loadClientName(id: number): void {
    this.clientsService.getClientById(id).subscribe({
      next: (client) => {
        this.clientName = client.name;
      },
      error: (err) => {
        console.error('Failed to load client by id', err);
        this.clientName = `Client (ID: ${id})`;
      },
    });
  }

  setTab(tab: 'Master' | 'Loans' | 'Breakdown' | 'HubsAndZones'): void {
    this.activeTab = tab;
  }
}
