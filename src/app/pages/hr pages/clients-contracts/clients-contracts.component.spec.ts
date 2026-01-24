import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientsContractsComponent } from './clients-contracts.component';

describe('ClientsContractsComponent', () => {
  let component: ClientsContractsComponent;
  let fixture: ComponentFixture<ClientsContractsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientsContractsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ClientsContractsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
