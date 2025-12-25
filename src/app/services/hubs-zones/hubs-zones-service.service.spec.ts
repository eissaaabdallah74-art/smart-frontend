import { TestBed } from '@angular/core/testing';

import { HubsZonesServiceService } from './hubs-zones-service.service';

describe('HubsZonesServiceService', () => {
  let service: HubsZonesServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HubsZonesServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
