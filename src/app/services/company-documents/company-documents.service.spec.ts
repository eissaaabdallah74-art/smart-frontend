import { TestBed } from '@angular/core/testing';

import { CompanyDocumentsService } from './company-documents.service';

describe('CompanyDocumentsService', () => {
  let service: CompanyDocumentsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CompanyDocumentsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
