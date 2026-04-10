import { Transaction } from '../interfaces/transaction';
import { Smile } from '../interfaces/smile';
import { Fire } from '../interfaces/fire';
import { Mojo } from './mojo';
export interface Profile {
    info: {
        email: string,
        username: string
    };
    transactions: Transaction[];
    smile: Smile[];
    fire: Fire[];
    mojo: Mojo;
}
