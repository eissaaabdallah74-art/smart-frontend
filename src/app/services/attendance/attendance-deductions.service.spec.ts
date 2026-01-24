import { TestBed } from '@angular/core/testing';

import { AttendanceDeductionsService } from './attendance-deductions.service';

describe('AttendanceDeductionsService', () => {
  let service: AttendanceDeductionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AttendanceDeductionsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
