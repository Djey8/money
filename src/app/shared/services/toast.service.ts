import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Toast {
  message: string;
  type: 'success' | 'error' | 'info' | 'update' | 'delete';
  id: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  private toastSubject = new Subject<Toast>();
  private dismissSubject = new Subject<number>();

  toast$ = this.toastSubject.asObservable();
  dismiss$ = this.dismissSubject.asObservable();

  show(message: string, type: 'success' | 'error' | 'info' | 'update' | 'delete' = 'success') {
    const id = ++this.counter;
    this.toastSubject.next({ message, type, id });
    return id;
  }

  dismiss(id: number) {
    this.dismissSubject.next(id);
  }
}
