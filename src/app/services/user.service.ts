import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UserVM } from '../models/usersVM';
import { BehaviorSubject, Observable, catchError, map, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private userSubject: BehaviorSubject<UserVM | null>;
  public user: Observable<UserVM | null>;
  private url: string = '/assets/user.json';

  constructor(private http: HttpClient) {
    this.userSubject = new BehaviorSubject<UserVM | null>(this.readStoredUser());
    this.user = this.userSubject.asObservable();
  }

  public get userValue(): UserVM | null {
    return this.userSubject.value;
  }

  login(username: string, password: string): Observable<UserVM> {
    return this.http.get<{ users: UserVM[] }>(this.url).pipe(
      map((response) => {
        const user = response.users.find(
          (u) =>
            u.userName?.toLowerCase() === username.toLowerCase() &&
            u.password === password
        );
        if (!user) {
          throw new Error('Invalid username or password');
        }
        this.userSubject.next(user);
        sessionStorage.setItem('user', JSON.stringify(user));
        localStorage.removeItem('user');
        return user;
      }),
      catchError((error) =>
        throwError(() =>
          error instanceof Error ? error.message : 'Unable to login'
        )
      )
    );
  }

  logout(): void {
    sessionStorage.removeItem('user');
    localStorage.removeItem('user');
    this.userSubject.next(null);
  }

  getUser(userId: string | number): Observable<UserVM> {
    return this.http.get<{ users: UserVM[] }>(this.url).pipe(
      map((response) => {
        const user = response.users.find((u) => String(u.userId) === String(userId));
        if (!user) {
          throw new Error('No user found');
        }
        return user;
      }),
      catchError((error) =>
        throwError(() => (error instanceof Error ? error.message : error))
      )
    );
  }

  getUsersByUserIds(userIds: number[]): Observable<UserVM[]> {
    return this.http.get<{ users: UserVM[] }>(this.url).pipe(
      map((response) => {
        const users = response.users.filter((us) => userIds.includes(us.userId!));
        if (users.length === 0) {
          throw new Error('No user found');
        }
        return users;
      }),
      catchError((error) =>
        throwError(() => (error instanceof Error ? error.message : error))
      )
    );
  }

  getAllUser(): Observable<{ users: UserVM[] }> {
    return this.http.get<{ users: UserVM[] }>(this.url).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  private readStoredUser(): UserVM | null {
    try {
      const fromTab = sessionStorage.getItem('user');
      if (fromTab) {
        return JSON.parse(fromTab);
      }
      return null;
    } catch {
      sessionStorage.removeItem('user');
      return null;
    }
  }
}
