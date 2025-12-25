import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewDriverDetailsComponent } from './interview-driver-details.component';

describe('InterviewDriverDetailsComponent', () => {
  let component: InterviewDriverDetailsComponent;
  let fixture: ComponentFixture<InterviewDriverDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterviewDriverDetailsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InterviewDriverDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
