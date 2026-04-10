import { TaggedAmount } from './tagged-amount';

export interface Investment extends TaggedAmount {
    deposit: number;
}
