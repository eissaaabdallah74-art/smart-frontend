import { TestBed } from '@angular/core/testing';

import { EmploysServiceService } from './employs-service.service';

describe('EmploysServiceService', () => {
  let service: EmploysServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EmploysServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
