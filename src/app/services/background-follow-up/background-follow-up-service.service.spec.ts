import { TestBed } from '@angular/core/testing';

import { BackgroundFollowUpServiceService } from './background-follow-up-service.service';

describe('BackgroundFollowUpServiceService', () => {
  let service: BackgroundFollowUpServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BackgroundFollowUpServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
