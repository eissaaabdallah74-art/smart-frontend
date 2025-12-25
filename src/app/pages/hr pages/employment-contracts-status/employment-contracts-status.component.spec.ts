import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmploymentContractsStatusComponent } from './employment-contracts-status.component';

describe('EmploymentContractsStatusComponent', () => {
  let component: EmploymentContractsStatusComponent;
  let fixture: ComponentFixture<EmploymentContractsStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmploymentContractsStatusComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EmploymentContractsStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
