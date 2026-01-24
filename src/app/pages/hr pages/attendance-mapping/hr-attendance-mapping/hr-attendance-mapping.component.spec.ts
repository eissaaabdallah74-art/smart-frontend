import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HrAttendanceMappingComponent } from './hr-attendance-mapping.component';

describe('HrAttendanceMappingComponent', () => {
  let component: HrAttendanceMappingComponent;
  let fixture: ComponentFixture<HrAttendanceMappingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HrAttendanceMappingComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HrAttendanceMappingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
