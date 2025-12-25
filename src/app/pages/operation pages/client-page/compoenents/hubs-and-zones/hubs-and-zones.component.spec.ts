import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HubsAndZonesComponent } from './hubs-and-zones.component';

describe('HubsAndZonesComponent', () => {
  let component: HubsAndZonesComponent;
  let fixture: ComponentFixture<HubsAndZonesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HubsAndZonesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HubsAndZonesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
