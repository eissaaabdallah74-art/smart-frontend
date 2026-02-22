import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdateDriverMasterComponent } from './update-driver-master.component';

describe('UpdateDriverMasterComponent', () => {
  let component: UpdateDriverMasterComponent;
  let fixture: ComponentFixture<UpdateDriverMasterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateDriverMasterComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(UpdateDriverMasterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
