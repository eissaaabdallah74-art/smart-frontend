import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyAttendanceRequestsComponent } from './my-attendance-requests.component';

describe('MyAttendanceRequestsComponent', () => {
  let component: MyAttendanceRequestsComponent;
  let fixture: ComponentFixture<MyAttendanceRequestsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyAttendanceRequestsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MyAttendanceRequestsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
