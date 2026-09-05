import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './component/app.component';
import { MyMessengerComponent } from './component/my-messenger/my-messenger.component';
import { MessengerListComponent } from './component/messenger-list/messenger-list.component';
import { LoginComponent } from './component/login/login.component';
import { AlertComponent } from './component/alert/alert.component';
import { MessengerComponent } from './component/messenger/messenger.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CallGridComponent } from './component/call-grid/call-grid.component';
import { CallRoomComponent } from './component/call-room/call-room.component';
import { SettingsComponent } from './component/settings/settings.component';

@NgModule({
  declarations: [
    AppComponent,
    MyMessengerComponent,
    MessengerListComponent,
    LoginComponent,
    AlertComponent,
    CallGridComponent,
    CallRoomComponent,
    MessengerComponent,
    SettingsComponent,
  ],
  imports: [
    CommonModule,
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    HttpClientModule,
    FormsModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
