import { TestBed } from '@angular/core/testing';

import { ClientsContractsServiceService } from './clients-contracts-service.service';

describe('ClientsContractsServiceService', () => {
  let service: ClientsContractsServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ClientsContractsServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
