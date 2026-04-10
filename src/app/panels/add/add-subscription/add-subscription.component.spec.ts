import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddSubscriptionComponent } from './add-subscription.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatabaseService } from '../../../shared/services/database.service';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('AddSubscriptionComponent', () => {
  let component: AddSubscriptionComponent;
  let fixture: ComponentFixture<AddSubscriptionComponent>;

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;

    await TestBed.configureTestingModule({
      imports: [
        AddSubscriptionComponent,
        TranslateModule.forRoot(),
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        { provide: DatabaseService, useValue: {} },
        { provide: FIREBASE_OPTIONS, useValue: { projectId: 'test', appId: 'test', apiKey: 'test' } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AddSubscriptionComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should default selectedOption to Daily', () => {
      expect(AddSubscriptionComponent.selectedOption).toBe('Daily');
    });

    it('should default categoryTextField to @', () => {
      expect(AddSubscriptionComponent.categoryTextField).toBe('@');
    });
  });

  describe('closeWindow()', () => {
    it('should reset form fields', () => {
      AddSubscriptionComponent.amountTextField = '50';
      AddSubscriptionComponent.commentTextField = 'test';
      AddSubscriptionComponent.categoryTextField = '@Music';
      component.closeWindow();
      expect(AddSubscriptionComponent.amountTextField).toBe('');
      expect(AddSubscriptionComponent.commentTextField).toBe('');
      expect(AddSubscriptionComponent.categoryTextField).toBe('@');
    });
  });
});
