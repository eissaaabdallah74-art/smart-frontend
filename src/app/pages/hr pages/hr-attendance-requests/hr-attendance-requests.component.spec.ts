import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HrAttendanceRequestsComponent } from './hr-attendance-requests.component';

describe('HrAttendanceRequestsComponent', () => {
  let component: HrAttendanceRequestsComponent;
  let fixture: ComponentFixture<HrAttendanceRequestsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HrAttendanceRequestsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HrAttendanceRequestsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
