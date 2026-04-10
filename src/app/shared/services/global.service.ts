import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
/** Shared utility service with static helper methods. */
export class GlobalService {

  constructor() { }

  static zeroPadded(val: number) {
    if (val >= 10)
      return val;
    else
      return '0' + val;
  }
}
