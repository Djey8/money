import { Pipe, PipeTransform } from '@angular/core';
import { accountLabel } from '../account-label';

/** Shows the name of an account as the person knows it (the stored `Smile` reads `Dream`). */
@Pipe({ name: 'accountLabel', standalone: true })
export class AccountLabelPipe implements PipeTransform {
  transform(account: string | null | undefined): string {
    return accountLabel(account);
  }
}
