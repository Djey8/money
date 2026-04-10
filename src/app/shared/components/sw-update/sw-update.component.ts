import { Component, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-sw-update',
  standalone: true,
  imports: [NgIf],
  template: `
    <div class="update-banner" *ngIf="updateAvailable">
      <span>A new version is available.</span>
      <button (click)="reload()">Update now</button>
    </div>
  `,
  styles: [`
    .update-banner {
      position: fixed;
      bottom: 72px;
      left: 16px;
      right: 16px;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--color-primary, #3f51b5);
      color: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-size: 14px;
    }
    button {
      background: #fff;
      color: var(--color-primary, #3f51b5);
      border: none;
      padding: 6px 16px;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
    }
  `]
})
export class SwUpdateComponent implements OnInit {
  updateAvailable = false;

  constructor(private swUpdate: SwUpdate) {}

  ngOnInit() {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => {
        this.updateAvailable = true;
      });
  }

  reload() {
    window.location.reload();
  }
}
