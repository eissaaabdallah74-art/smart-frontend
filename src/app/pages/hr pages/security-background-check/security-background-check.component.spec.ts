import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SecurityBackgroundCheckComponent } from './security-background-check.component';

describe('SecurityBackgroundCheckComponent', () => {
  let component: SecurityBackgroundCheckComponent;
  let fixture: ComponentFixture<SecurityBackgroundCheckComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SecurityBackgroundCheckComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SecurityBackgroundCheckComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
