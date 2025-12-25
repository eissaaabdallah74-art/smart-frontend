import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BreakdownComponent } from './breakdown.component';

describe('BreakdownComponent', () => {
  let component: BreakdownComponent;
  let fixture: ComponentFixture<BreakdownComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BreakdownComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BreakdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
