import { Component, Injectable } from '@angular/core';

/**
 * The profile picture is a self-hosted feature (JFK, 2026-10-18). This file is the Firebase edition's side of it: nothing, so
 * not a line of the feature is in that build. `angular.json` swaps in `profile-picture.selfhosted.ts` for the self-hosted
 * builds (docs/adr/0004: a whole file swapped by fileReplacements, never a runtime check).
 */
@Injectable({ providedIn: 'root' })
export class ProfilePictureService {
  /** Loads the account's picture and puts it on every page's toolbar. */
  reload(): void {
    // no picture in this edition
  }

  /** The user logged out: the default picture is back. */
  clear(): void {
    // no picture in this edition
  }
}

/** The editor in the edit-profile form: empty in this edition. */
@Component({ selector: 'app-profile-picture-editor', standalone: true, template: '' })
export class ProfilePictureEditorComponent {}
