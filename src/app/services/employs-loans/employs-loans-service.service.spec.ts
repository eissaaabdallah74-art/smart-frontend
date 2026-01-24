import { TestBed } from '@angular/core/testing';

import { EmploysLoansServiceService } from './employs-loans-service.service';

describe('EmploysLoansServiceService', () => {
  let service: EmploysLoansServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EmploysLoansServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
