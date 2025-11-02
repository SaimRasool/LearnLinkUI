import { Injectable, EventEmitter } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SharedService {
  onInitiateCall: EventEmitter<any> = new EventEmitter<any>();
}
