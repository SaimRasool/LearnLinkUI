import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CallRoomComponent } from './call-room.component';

describe('CallGridComponent', () => {
  let component: CallRoomComponent;
  let fixture: ComponentFixture<CallRoomComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CallRoomComponent],
    });
    fixture = TestBed.createComponent(CallRoomComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
