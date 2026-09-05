import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChannelVM } from '../models/channelVM';
import { Observable, catchError, forkJoin, map, switchMap, throwError } from 'rxjs';
import { ChannelMessageVM } from '../models/channelMessageVM';
import { ChannelParticipantVM } from '../models/channelParticipantVM';
import { UserService } from './user.service';
import { AppSettingsService } from './app-settings.service';

@Injectable({
  providedIn: 'root',
})
export class MessengerService {
  private channelUrl = '/assets/channel.json';
  private channelParticipantUrl = '/assets/channelParticipant.json';
  private messageUrl = '/assets/channelMessage.json';

  constructor(
    private http: HttpClient,
    private userService: UserService,
    private settings: AppSettingsService
  ) {}

  private get apiUrl(): string {
    return this.settings.current.expressUrl;
  }

  getAllChannels(channelIds: number[]): Observable<any[]> {
    return forkJoin([
      this.http.get<ChannelVM[]>(this.channelUrl),
      this.getChannelParticipantsByChannelIds(channelIds),
    ]).pipe(
      map(([parentData, childData]) =>
        this.joinChannelWithParticipant(
          parentData.filter((channel) => channelIds.includes(channel.channelId!)),
          childData
        )
      ),
      catchError((error) => throwError(() => error))
    );
  }

  addChannelMessage(data: ChannelMessageVM): Observable<{ res: boolean; message?: string }> {
    return this.http.post<{ res: boolean; message?: string }>(`${this.apiUrl}/addMessage`, data).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  createDirectChat(userId: number, otherUserId: number): Observable<any> {
    return this.http
      .post(`${this.apiUrl}/createDirectChat`, { userId, otherUserId })
      .pipe(catchError((error) => throwError(() => error)));
  }

  getChannelMessages(channelId: number, currentPage: number, pageSize: number): Observable<any[]> {
    return this.http.get<ChannelMessageVM[]>(this.messageUrl).pipe(
      map((response) => {
        const channelMessages = response.filter((u) => u.channelId == channelId);
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return [...channelMessages].reverse().slice(startIndex, endIndex);
      }),
      catchError((error) => throwError(() => error))
    );
  }

  getNewChannelMessages(channelId: number, lastChannelMessageId: number): Observable<any[]> {
    return this.http.get<ChannelMessageVM[]>(this.messageUrl).pipe(
      map((response) => {
        const channelMessages = response.filter((u) => u.channelId == channelId);
        const lastIndex = channelMessages.findIndex(
          (u) => u.channelMessageId === lastChannelMessageId
        );
        if (lastIndex === -1) {
          return [...channelMessages];
        }
        return channelMessages.slice(lastIndex + 1);
      }),
      catchError((error) => throwError(() => error))
    );
  }

  getUserChannels(userId: number): Observable<ChannelParticipantVM[]> {
    return this.http.get<ChannelParticipantVM[]>(this.channelParticipantUrl).pipe(
      map((response) => response.filter((u) => u.userId == userId)),
      catchError((error) => throwError(() => error))
    );
  }

  getChannelParticipants(channelId: number): Observable<any[]> {
    return this.http.get<ChannelParticipantVM[]>(this.channelParticipantUrl).pipe(
      switchMap((response) => {
        const channelParticipant = response.filter((u) => u.channelId == channelId);
        const userIds = channelParticipant.map((cp) => cp.userId!);
        return this.userService.getUsersByUserIds(userIds).pipe(
          map((users) => this.joinOnParticipantAndUser(channelParticipant, users))
        );
      }),
      catchError((error) => throwError(() => error))
    );
  }

  getChannelParticipantsByChannelIds(channelIds: number[]): Observable<any[]> {
    return this.http.get<ChannelParticipantVM[]>(this.channelParticipantUrl).pipe(
      switchMap((response) => {
        const channelParticipant = response.filter((cp) =>
          channelIds.includes(cp.channelId!)
        );
        const userIds = [...new Set(channelParticipant.map((cp) => cp.userId!))];
        return this.userService.getUsersByUserIds(userIds).pipe(
          map((users) => this.joinOnParticipantAndUser(channelParticipant, users))
        );
      }),
      catchError((error) => throwError(() => error))
    );
  }

  private joinOnParticipantAndUser(data1: any[], data2: any[]): any[] {
    return data1.map((item1) => {
      const matchingItem = data2.find((item2) => item1.userId === item2.userId);
      return matchingItem ? { ...item1, ...matchingItem } : item1;
    });
  }

  private joinChannelWithParticipant(parents: any[], children: any[]): any[] {
    return parents.map((parent) => {
      const matchingChildren = children.filter((child) => child.channelId === parent.channelId);
      return matchingChildren.length > 0
        ? { ...parent, children: matchingChildren }
        : { ...parent, children: [] };
    });
  }
}
