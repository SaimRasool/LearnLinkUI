import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MessengerComponent } from './component/messenger/messenger.component';
import { LoginComponent } from './component/login/login.component';
import { AuthGuard } from './services/auth.guard';
import { CallGridComponent } from './component/call-grid/call-grid.component';

const routes: Routes = [
  {
    path: 'messenger',
    component: MessengerComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'call/:id',
    component: CallGridComponent,
    canActivate: [AuthGuard],
  },
  // { path: 'users', loadChildren: usersModule, canActivate: [AuthGuard] },
  { path: 'login', component: LoginComponent },

  // otherwise redirect to home
  { path: '**', redirectTo: 'login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
