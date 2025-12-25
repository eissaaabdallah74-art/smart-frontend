import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SmvTasksComponent } from './smv-tasks.component';

describe('SmvTasksComponent', () => {
  let component: SmvTasksComponent;
  let fixture: ComponentFixture<SmvTasksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SmvTasksComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SmvTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
