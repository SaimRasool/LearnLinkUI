import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyMessengerComponent } from './my-messenger.component';

describe('MyMessengerComponent', () => {
  let component: MyMessengerComponent;
  let fixture: ComponentFixture<MyMessengerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MyMessengerComponent]
    });
    fixture = TestBed.createComponent(MyMessengerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
