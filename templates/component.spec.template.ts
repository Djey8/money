/**
 * Template: Angular Component Test
 *
 * Usage: Copy this file, rename to <component-name>.component.spec.ts,
 *        and replace all TODO placeholders.
 *
 * Run:   npm test -- --testPathPattern="<component-name>"
 * Watch: npm run test:watch -- --testPathPattern="<component-name>"
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatabaseService } from '../../shared/services/database.service'; // TODO: adjust path
import { PersistenceService } from '../../shared/services/persistence.service'; // TODO: adjust path
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { AppStateService } from '../../shared/services/app-state.service'; // TODO: adjust path

// TODO: import your component
// import { MyComponent } from './my.component';

describe('MyComponent', () => {  // TODO: rename
  let component: any; // TODO: use actual type
  let fixture: ComponentFixture<any>; // TODO: use actual type
  let mockPersistence: jest.Mocked<Partial<PersistenceService>>;

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;

    mockPersistence = {
      writeAndSync: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [
        // TODO: MyComponent,  (standalone components go here)
        TranslateModule.forRoot(),
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: DatabaseService, useValue: {} },
        { provide: PersistenceService, useValue: mockPersistence },
        { provide: FIREBASE_OPTIONS, useValue: { projectId: 'test', appId: 'test', apiKey: 'test' } },
        // TODO: add additional providers/mocks
      ],
    }).compileComponents();

    // TODO: fixture = TestBed.createComponent(MyComponent);
    // component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // TODO: add tests for component methods
  // describe('myMethod()', () => {
  //   it('should ...', () => {
  //     expect(component.myMethod()).toBe(...);
  //   });
  // });
});
