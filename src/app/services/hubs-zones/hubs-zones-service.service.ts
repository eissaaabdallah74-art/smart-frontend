import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiZone {
  id: number;
  name: string;
  hubId: number;
}

export interface ApiHub {
  id: number;
  name: string;
  clientId: number;

  // optional (when backend includes zones)
  zones?: ApiZone[];
}

@Injectable({
  providedIn: 'root',
})
export class HubsZonesService {
  private readonly hubsUrl = `${environment.apiUrl}/hubs`;
  private readonly zonesUrl = `${environment.apiUrl}/zones`;

  constructor(private http: HttpClient) {}

  // ===== Hubs =====

  getHubsByClient(clientId: number, includeZones = true): Observable<ApiHub[]> {
    let params = new HttpParams().set('clientId', String(clientId));
    if (includeZones) params = params.set('includeZones', '1');
    return this.http.get<ApiHub[]>(this.hubsUrl, { params });
  }

  createHub(body: { name: string; clientId: number }): Observable<ApiHub> {
    return this.http.post<ApiHub>(this.hubsUrl, body);
  }

  // ===== Zones =====

  getZonesByHub(hubId: number): Observable<ApiZone[]> {
    const params = new HttpParams().set('hubId', String(hubId));
    return this.http.get<ApiZone[]>(this.zonesUrl, { params });
  }

  createZone(body: { name: string; hubId: number }): Observable<ApiZone> {
    return this.http.post<ApiZone>(this.zonesUrl, body);
  }
}
