import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Injectable,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * The profile picture of a self-hosted account (JFK, 2026-10-18): the round picture at the left of every page's toolbar is the
 * account's own, the leaderboard shows it too. Chosen and removed in Settings > Edit profile. The text of this feature is plain
 * strings here and not translation keys on purpose (docs/adr/0004: the i18n files ship to the Firebase edition as well).
 */
const DEFAULT_SRC = '../assets/profile-blank.jpg';
const SIZE = 192;
const url = () => `${environment.selfhosted.apiUrl}/v1/profile/picture`;

const WORDS: Record<
  string,
  { title: string; choose: string; remove: string; hint: string; failed: string; saving: string }
> = {
  en: {
    title: 'Profile picture',
    choose: 'Choose a picture',
    remove: 'Remove',
    hint: 'Shown at the top left of every page and on the leaderboard. Cut square automatically.',
    failed: 'The picture could not be saved.',
    saving: 'Saving ...',
  },
  de: {
    title: 'Profilbild',
    choose: 'Bild wählen',
    remove: 'Entfernen',
    hint: 'Wird oben links auf jeder Seite und in der Rangliste gezeigt. Wird automatisch quadratisch zugeschnitten.',
    failed: 'Das Bild konnte nicht gespeichert werden.',
    saving: 'Speichern ...',
  },
  es: {
    title: 'Foto de perfil',
    choose: 'Elegir una foto',
    remove: 'Quitar',
    hint: 'Se muestra arriba a la izquierda en cada página y en la clasificación. Se recorta en cuadrado automáticamente.',
    failed: 'No se pudo guardar la foto.',
    saving: 'Guardando ...',
  },
  fr: {
    title: 'Photo de profil',
    choose: 'Choisir une photo',
    remove: 'Retirer',
    hint: 'Affichée en haut à gauche de chaque page et dans le classement. Recadrée automatiquement en carré.',
    failed: "La photo n'a pas pu être enregistrée.",
    saving: 'Enregistrement ...',
  },
  cn: {
    title: '头像',
    choose: '选择图片',
    remove: '移除',
    hint: '显示在每个页面的左上角和排行榜上。会自动裁剪为正方形。',
    failed: '无法保存头像。',
    saving: '保存中 ...',
  },
  ar: {
    title: 'صورة الملف الشخصي',
    choose: 'اختيار صورة',
    remove: 'إزالة',
    hint: 'تظهر أعلى يسار كل صفحة وفي لوحة الصدارة. تُقصّ بشكل مربع تلقائياً.',
    failed: 'تعذّر حفظ الصورة.',
    saving: 'جارٍ الحفظ ...',
  },
};

/** Keeps the account's picture on the toolbar of whatever page is on screen. */
@Injectable({ providedIn: 'root' })
export class ProfilePictureService {
  private readonly http = inject(HttpClient);
  private picture: string | null = null;
  private observer: MutationObserver | null = null;

  /** Loads the account's picture and puts it on every page's toolbar. */
  reload(): void {
    this.http.get<{ picture: string | null }>(url()).subscribe({
      next: (reply) => this.show(reply.picture ?? null),
      error: () => undefined,
    });
  }

  /** The user logged out: the default picture is back. */
  clear(): void {
    this.show(null);
  }

  /** The picture now in use (null: the default). */
  show(picture: string | null): void {
    this.picture = picture;
    if (picture && !this.observer && typeof MutationObserver !== 'undefined') {
      // every page has its own toolbar image: one that appears later gets the picture too
      this.observer = new MutationObserver(() => this.apply());
      this.observer.observe(document.body, { childList: true, subtree: true });
    }
    this.apply();
  }

  private apply(): void {
    document.querySelectorAll<HTMLImageElement>('img#profile-pic').forEach((img) => {
      if (this.picture) {
        if (img.dataset['standard'] === undefined) {
          img.dataset['standard'] = img.getAttribute('src') ?? DEFAULT_SRC;
        }
        if (img.getAttribute('src') !== this.picture) img.setAttribute('src', this.picture);
        img.classList.add('profile-pic--custom');
      } else if (img.dataset['standard'] !== undefined) {
        img.setAttribute('src', img.dataset['standard']);
        delete img.dataset['standard'];
        img.classList.remove('profile-pic--custom');
      }
    });
    if (!this.picture && this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

/** Cuts the middle square of an image file and shrinks it: what is sent is a few KB. */
async function squareJpeg(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no canvas');
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    SIZE,
    SIZE,
  );
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

/** The picture row of the edit-profile form: the current picture, choose a new one, remove it. Saves at once. */
@Component({
  selector: 'app-profile-picture-editor',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pp">
      <span class="pp-title">{{ w.title }}</span>
      <div class="pp-row">
        <img class="pp-preview" [src]="current || standard" alt="" width="64" height="64" />
        <div class="pp-actions">
          <label class="pp-btn">
            {{ busy ? w.saving : w.choose }}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              [disabled]="busy"
              (change)="picked($event)"
            />
          </label>
          <button type="button" class="pp-btn" *ngIf="current" [disabled]="busy" (click)="remove()">
            {{ w.remove }}
          </button>
        </div>
      </div>
      <small class="pp-hint">{{ w.hint }}</small>
      <small class="pp-error" *ngIf="error" role="alert">{{ error }}</small>
    </div>
  `,
  styles: [
    `
      .pp {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin: 8px 0 12px;
      }
      .pp-title {
        font-weight: 600;
      }
      .pp-row {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .pp-preview {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid var(--color-border, #ccc);
        background: var(--color-surface-alt, #eee);
      }
      .pp-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .pp-btn {
        padding: 8px 14px;
        border-radius: var(--radius-md, 8px);
        border: 1px solid var(--color-border, #ccc);
        background: var(--color-surface, #fff);
        color: inherit;
        cursor: pointer;
        font: inherit;
      }
      .pp-hint {
        color: var(--color-text-secondary, #666);
      }
      .pp-error {
        color: var(--color-danger, #c00);
      }
    `,
  ],
})
export class ProfilePictureEditorComponent {
  private readonly http = inject(HttpClient);
  private readonly service = inject(ProfilePictureService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly standard = DEFAULT_SRC;
  current: string | null = null;
  busy = false;
  error = '';

  constructor() {
    this.http.get<{ picture: string | null }>(url()).subscribe({
      next: (reply) => {
        this.current = reply.picture ?? null;
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }

  get w() {
    const lang = (this.translate.currentLang || this.translate.defaultLang || 'en').slice(0, 2);
    return WORDS[lang === 'zh' ? 'cn' : lang] ?? WORDS['en'];
  }

  async picked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.busy = true;
    this.error = '';
    try {
      const image = await squareJpeg(file);
      const reply = await firstValueFrom(this.http.put<{ picture: string }>(url(), { image }));
      this.current = reply.picture;
      this.service.show(reply.picture);
    } catch {
      this.error = this.w.failed;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  async remove(): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      await firstValueFrom(this.http.delete(url()));
      this.current = null;
      this.service.show(null);
    } catch {
      this.error = this.w.failed;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
