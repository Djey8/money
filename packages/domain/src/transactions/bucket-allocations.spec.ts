import { applyBucketAllocations, parseBucketAllocations } from './bucket-allocations';

describe('bucket allocations', () => {
  it('parses legacy comment tags to minor units', () => {
    expect(parseBucketAllocations('Holiday #bucket:Flights:120.50 #bucket:Hotel:80')).toEqual([
      { bucketTitle: 'Flights', amountMinor: 12050 },
      { bucketTitle: 'Hotel', amountMinor: 8000 },
    ]);
  });

  it('caps allocations at targets without mutating the source buckets', () => {
    const buckets = [
      { id: 'flight', title: 'Flights', targetMinor: 10000, amountMinor: 9500 },
      { id: 'hotel', title: 'Hotel', targetMinor: 20000, amountMinor: 0 },
    ];
    expect(
      applyBucketAllocations(
        buckets,
        parseBucketAllocations('#bucket:Flights:20 #bucket:Hotel:80'),
      ),
    ).toEqual([
      { ...buckets[0], amountMinor: 10000 },
      { ...buckets[1], amountMinor: 8000 },
    ]);
    expect(buckets[0].amountMinor).toBe(9500);
  });
});
