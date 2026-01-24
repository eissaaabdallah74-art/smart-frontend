import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HrAttendanceExcusesComponent } from './hr-attendance-excuses.component';

describe('HrAttendanceExcusesComponent', () => {
  let component: HrAttendanceExcusesComponent;
  let fixture: ComponentFixture<HrAttendanceExcusesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HrAttendanceExcusesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HrAttendanceExcusesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
