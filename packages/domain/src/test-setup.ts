import { CASHFLOW_GAME_SETS } from './cashflow-content';
import { setDefaultTableGameSets } from './cashflow-game/table/default-game-sets';

// the specs play with the printed catalog: it is registered once for every spec file
setDefaultTableGameSets(CASHFLOW_GAME_SETS);
