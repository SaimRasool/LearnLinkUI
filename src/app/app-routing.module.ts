import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MessengerComponent } from './component/messenger/messenger.component';
import { LoginComponent } from './component/login/login.component';
import { AuthGuard } from './services/auth.guard';
import { CallGridComponent } from './component/call-grid/call-grid.component';
import { SettingsComponent } from './component/settings/settings.component';

const routes: Routes = [
  {
    path: 'messenger',
    component: MessengerComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'settings',
    component: SettingsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'call/:id',
    component: CallGridComponent,
    canActivate: [AuthGuard],
  },
  { path: 'login', component: LoginComponent },
  { path: '', pathMatch: 'full', redirectTo: 'messenger' },
  { path: '**', redirectTo: 'login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
