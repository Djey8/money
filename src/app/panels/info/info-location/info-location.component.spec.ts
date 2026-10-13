import { InfoLocationComponent } from './info-location.component';

describe('InfoLocationComponent folded lists', () => {
  const open = () => InfoLocationComponent.setInfoLocationComponent(0, 'N26', 'Main', 100, 'bank');

  it('the related transactions and transfers are folded away when a location opens', () => {
    open();
    expect(InfoLocationComponent.showTransactions).toBe(false);
    expect(InfoLocationComponent.showTransfers).toBe(false);
  });

  it('clicking a heading opens that list only; clicking again folds it', () => {
    open();
    InfoLocationComponent.prototype.toggleTransactions.call({});
    expect(InfoLocationComponent.showTransactions).toBe(true);
    expect(InfoLocationComponent.showTransfers).toBe(false);
    InfoLocationComponent.prototype.toggleTransfers.call({});
    expect(InfoLocationComponent.showTransfers).toBe(true);
    InfoLocationComponent.prototype.toggleTransactions.call({});
    expect(InfoLocationComponent.showTransactions).toBe(false);
  });

  it('opening the next location folds both lists again', () => {
    open();
    InfoLocationComponent.prototype.toggleTransactions.call({});
    InfoLocationComponent.prototype.toggleTransfers.call({});
    InfoLocationComponent.setInfoLocationComponent(1, 'Cash', undefined, 5, 'cash');
    expect(InfoLocationComponent.showTransactions).toBe(false);
    expect(InfoLocationComponent.showTransfers).toBe(false);
  });
});
