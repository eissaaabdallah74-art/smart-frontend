import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailsDriverMasterComponent } from './details-driver-master.component';

describe('DetailsDriverMasterComponent', () => {
  let component: DetailsDriverMasterComponent;
  let fixture: ComponentFixture<DetailsDriverMasterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailsDriverMasterComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DetailsDriverMasterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
