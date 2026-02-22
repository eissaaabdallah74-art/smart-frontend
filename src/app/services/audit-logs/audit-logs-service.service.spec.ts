import { TestBed } from '@angular/core/testing';

import { AuditLogsServiceService } from './audit-logs-service.service';

describe('AuditLogsServiceService', () => {
  let service: AuditLogsServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuditLogsServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
