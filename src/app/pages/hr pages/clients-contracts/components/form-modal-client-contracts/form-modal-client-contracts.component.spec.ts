import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormModalClientContractsComponent } from './form-modal-client-contracts.component';

describe('FormModalClientContractsComponent', () => {
  let component: FormModalClientContractsComponent;
  let fixture: ComponentFixture<FormModalClientContractsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormModalClientContractsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FormModalClientContractsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
