/**
 * Template: Angular Service Test
 *
 * Usage: Copy this file, rename to <service-name>.service.spec.ts,
 *        and replace all TODO placeholders.
 *
 * Run:   npm test -- --testPathPattern="<service-name>"
 * Watch: npm run test:watch -- --testPathPattern="<service-name>"
 */

// TODO: import your service
// import { MyService } from './my.service';

describe('MyService', () => {  // TODO: rename
  let service: any; // TODO: use actual type

  beforeEach(() => {
    // TODO: reset any global state
    // localStorage.clear();
    service = undefined; // TODO: service = new MyService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // TODO: group tests by method
  // describe('myMethod()', () => {
  //   it('should return expected value', () => {
  //     expect(service.myMethod(input)).toBe(expected);
  //   });
  //
  //   it('should handle edge case', () => {
  //     expect(service.myMethod(null)).toBe(fallback);
  //   });
  // });
});
