import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewFormModalComponent } from './interview-form-modal.component';

describe('InterviewFormModalComponent', () => {
  let component: InterviewFormModalComponent;
  let fixture: ComponentFixture<InterviewFormModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterviewFormModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InterviewFormModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
