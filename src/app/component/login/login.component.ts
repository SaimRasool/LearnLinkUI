import { Component, NgModule, OnInit } from '@angular/core';
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
    loginForm: FormGroup= new FormGroup({});
    loading = false;
    submitted = false;
    returnUrl: string | undefined;

    constructor(
        private formBuilder: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private userService: UserService,
        private alertService: AlertService
    ) {
        // redirect to home if already logged in
        if (this.userService.userValue) {
            this.router.navigate(['/']);
        }
    }

    ngOnInit() {
        this.loginForm = this.formBuilder.group({
            username: ['', Validators.required],
            password: ['', Validators.required]
        });

        // get return url from route parameters or default to '/'
    this.returnUrl =
      this.route.snapshot.queryParams['returnUrl'] || '/messenger';
    }

    // convenience getter for easy access to form fields
    get f() { return this.loginForm?.controls; }

    onSubmit() {
        this.submitted = true;

        // reset alerts on submit
        this.alertService.clear();

        // stop here if form is invalid
        if (this.loginForm?.invalid) {
            return;
        }

        this.loading = true;
        this.userService.login(this.f?.["username"].value, this.f?.["password"].value).subscribe(data => {
                    this.router.navigate([this.returnUrl,]);
                },
                error => {
                    this.alertService.error(error);
                    this.loading = false;
                });
    }
}
