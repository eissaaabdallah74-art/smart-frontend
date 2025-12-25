import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BackgroundFollowUpComponent } from './background-follow-up.component';

describe('BackgroundFollowUpComponent', () => {
  let component: BackgroundFollowUpComponent;
  let fixture: ComponentFixture<BackgroundFollowUpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackgroundFollowUpComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BackgroundFollowUpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
