import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HrAttendanceComponent } from './hr-attendance.component';

describe('HrAttendanceComponent', () => {
  let component: HrAttendanceComponent;
  let fixture: ComponentFixture<HrAttendanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HrAttendanceComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HrAttendanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
