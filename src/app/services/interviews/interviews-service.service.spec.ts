import { TestBed } from '@angular/core/testing';

import { InterviewsServiceService } from './interviews-service.service';

describe('InterviewsServiceService', () => {
  let service: InterviewsServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InterviewsServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
