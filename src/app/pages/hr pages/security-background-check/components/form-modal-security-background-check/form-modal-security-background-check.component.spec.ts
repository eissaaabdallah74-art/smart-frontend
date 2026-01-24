import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormModalSecurityBackgroundCheckComponent } from './form-modal-security-background-check.component';

describe('FormModalSecurityBackgroundCheckComponent', () => {
  let component: FormModalSecurityBackgroundCheckComponent;
  let fixture: ComponentFixture<FormModalSecurityBackgroundCheckComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormModalSecurityBackgroundCheckComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FormModalSecurityBackgroundCheckComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
