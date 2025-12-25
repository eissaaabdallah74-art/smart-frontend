import { TestBed } from '@angular/core/testing';

import { PendingRequestServiceService } from './pending-request-service.service';

describe('PendingRequestServiceService', () => {
  let service: PendingRequestServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PendingRequestServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
