import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ConfirmRequest {
  message: string;
  onConfirm: () => void;
  confirmButtonText?: string; // Default: 'Info.delete'
  confirmButtonClass?: 'delete' | 'primary'; // Default: 'delete'
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private confirmSubject = new Subject<ConfirmRequest>();
  confirm$ = this.confirmSubject.asObservable();

  confirm(message: string, onConfirm: () => void, confirmButtonText?: string, confirmButtonClass?: 'delete' | 'primary') {
    this.confirmSubject.next({ 
      message, 
      onConfirm,
      confirmButtonText,
      confirmButtonClass
    });
  }
}
