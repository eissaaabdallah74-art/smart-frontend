import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HrAttendanceEmployeeComponent } from './hr-attendance-employee.component';

describe('HrAttendanceEmployeeComponent', () => {
  let component: HrAttendanceEmployeeComponent;
  let fixture: ComponentFixture<HrAttendanceEmployeeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HrAttendanceEmployeeComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HrAttendanceEmployeeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
