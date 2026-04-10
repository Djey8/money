import { TaggedAmount } from './tagged-amount';

export interface Liability extends TaggedAmount {
    investment: boolean;
    credit: number;
}
