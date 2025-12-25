import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamReportsComponent } from './team-reports.component';

describe('TeamReportsComponent', () => {
  let component: TeamReportsComponent;
  let fixture: ComponentFixture<TeamReportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamReportsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TeamReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
