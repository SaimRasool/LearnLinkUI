import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UserVM } from '../models/usersVM';
import { BehaviorSubject, Observable, catchError, map, throwError } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private userSubject: BehaviorSubject<UserVM | null>;
  public user: Observable<UserVM | null>;
  private url: string = '/assets/user.json';
  constructor(private http: HttpClient, private router: Router) {
    this.userSubject = new BehaviorSubject<UserVM | null>(
      JSON.parse(localStorage.getItem('user')!)
    );
    this.user = this.userSubject.asObservable();
  }

  public get userValue(): UserVM|null {
    return this.userSubject.value!;
  }

  login(username: any, password: any): Observable<any> {
    return this.http.get<any[]>(this.url).pipe(
      map((response: any) => {
        const user = response.users.find(
          (u: UserVM) =>
            u.userName?.toLowerCase() == username.toLowerCase() &&
            u.password == password
        );
        if (user) {
          // Authentication successful
          this.userSubject.next(user);
          localStorage.setItem('user', JSON.stringify(user));
          return user;
        } else {
          // Authentication failed
          // Returning null or throwing an error might be more appropriate here
          throw new Error('Invalid credentials');
        }
      }),
      catchError((error) => {
        // Handle and rethrow the error
        console.error('Error occurred: ', error);
        return error;
      })
    );
  }

  logout() {
    // remove user from local storage and set current user to null
    localStorage.removeItem('user');
    this.userSubject.next(null);
  }
  getUser(userId: any): Observable<any> {
    return this.http.get<any[]>(this.url).pipe(
      map((response: any) => {
        const user = response.users.find((u: UserVM) => u.userId == userId);
        if (user) {
          return user;
        } else {
          throw new Error('No User Found');
        }
      }),
      catchError((error) => {
        return error;
      })
    );
  }
  getUsersByUserIds(userIds: number[]): Observable<any> {
    return this.http.get<any[]>(this.url).pipe(
      map((response: any) => {
        const users = response.users.filter((us: UserVM) =>
          userIds.includes(us.userId!)
        );
        if (users.length > 0) {
          return users;
        } else {
          throw new Error('No User Found');
        }
      }),
      catchError((error) => {
        return error;
      })
    );
  }

  getAllUser(): Observable<any> {
    return this.http.get<any[]>(this.url).pipe(
      map((response: any) => {
        return response;
      }),
      catchError((error) => {
        return error;
      })
    );
  }
}
