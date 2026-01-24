import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HrAttendanceImportComponent } from './hr-attendance-import.component';

describe('HrAttendanceImportComponent', () => {
  let component: HrAttendanceImportComponent;
  let fixture: ComponentFixture<HrAttendanceImportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HrAttendanceImportComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HrAttendanceImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
