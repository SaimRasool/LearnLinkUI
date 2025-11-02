import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CallGridComponent } from './call-grid.component';

describe('CallGridComponent', () => {
  let component: CallGridComponent;
  let fixture: ComponentFixture<CallGridComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CallGridComponent],
    });
    fixture = TestBed.createComponent(CallGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
