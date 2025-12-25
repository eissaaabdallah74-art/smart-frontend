import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SmvCallsComponent } from './smv-calls.component';

describe('SmvCallsComponent', () => {
  let component: SmvCallsComponent;
  let fixture: ComponentFixture<SmvCallsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SmvCallsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SmvCallsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
