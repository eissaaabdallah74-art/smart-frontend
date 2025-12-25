import { TestBed } from '@angular/core/testing';

import { CallsReportServiceService } from './calls-report-service.service';

describe('CallsReportServiceService', () => {
  let service: CallsReportServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CallsReportServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
