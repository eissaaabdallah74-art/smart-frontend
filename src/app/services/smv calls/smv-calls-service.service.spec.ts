import { TestBed } from '@angular/core/testing';

import { SmvCallsServiceService } from './smv-calls-service.service';

describe('SmvCallsServiceService', () => {
  let service: SmvCallsServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SmvCallsServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
