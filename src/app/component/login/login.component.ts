import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup = new FormGroup({});
  loading = false;
  submitted = false;
  returnUrl = '/messenger';
  demoUsers = ['Ali', 'Haris', 'Aisha', 'Amir'];

  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private alertService: AlertService
  ) {
    if (this.userService.userValue) {
      this.router.navigate(['/messenger']);
    }
  }

  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      username: ['', Validators.required],
      password: ['', Validators.required],
    });
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/messenger';
  }

  get f() {
    return this.loginForm.controls;
  }

  fillDemo(name: string): void {
    this.loginForm.patchValue({ username: name, password: '123456' });
  }

  onSubmit(): void {
    this.submitted = true;
    this.alertService.clear();
    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    this.userService.login(this.f['username'].value, this.f['password'].value).subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl),
      error: (error) => {
        this.alertService.error(typeof error === 'string' ? error : 'Login failed');
        this.loading = false;
      },
    });
  }
}
