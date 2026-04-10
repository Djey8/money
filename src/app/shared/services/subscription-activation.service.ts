import { Injectable } from '@angular/core';
import { PlannedSubscription } from '../../interfaces/planned-subscription';
import { Subscription } from '../../interfaces/subscription';
import { Smile } from '../../interfaces/smile';
import { Fire } from '../../interfaces/fire';
import { AppStateService } from './app-state.service';
import { PersistenceService } from './persistence.service';

/**
 * Service for activating and deactivating planned subscriptions
 * Manages the lifecycle of payment plans from planned → active → inactive states
 */
@Injectable({
  providedIn: 'root'
})
export class SubscriptionActivationService {

  constructor(private persistence: PersistenceService) { }

  /**
   * Activate a planned subscription
   * Creates a real subscription in the main subscriptions list
   * Subscriptions use NEGATIVE amounts (money leaves the account to fund buckets)
   * 
   * @param plan - Planned subscription to activate
   * @param project - Parent Smile or Fire project
   * @returns true if successful, false otherwise
   */
  activatePlannedSubscription(
    plan: PlannedSubscription,
    project: Smile | Fire
  ): boolean {
    try {
      // Validate plan is in 'planned' or 'inactive' status
      if (plan.status === 'active') {
        console.warn('Plan is already active');
        return false;
      }

      // Create a real subscription from the plan
      // IMPORTANT: Amount is negative because money leaves the account to fund buckets
      const subscription: Subscription = {
        title: plan.title,
        account: plan.account,
        amount: plan.amount * -1,  // Negative: deducting from account
        startDate: plan.startDate,
        endDate: plan.endDate,
        category: plan.category,
        comment: plan.comment,
        frequency: plan.frequency
      };

      // Add to main subscriptions list
      AppStateService.instance.allSubscriptions.push(subscription);

      // Update plan status to active
      plan.status = 'active';
      plan.updatedAt = new Date().toISOString();
      plan.activatedAt = new Date().toISOString();

      // Save to database
      this.persistence.writeAndSync({
        tag: 'subscriptions',
        data: AppStateService.instance.allSubscriptions,
        localStorageKey: 'subscriptions',
        logEvent: 'activate_payment_plan',
        logMetadata: { title: plan.title, projectTitle: plan.projectTitle },
        onSuccess: () => {
          console.log('Subscription activated and saved to database');
        },
        onError: (error) => {
          console.error('Failed to save subscription to database:', error);
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error activating planned subscription:', error);
      return false;
    }
  }

  /**
   * Deactivate an active planned subscription
   * Sets the subscription end date to today instead of deleting it
   * This preserves the subscription if transactions were already created
   * 
   * @param plan - Planned subscription to deactivate
   * @param project - Parent Smile or Fire project
   * @returns true if successful, false otherwise
   */
  deactivatePlannedSubscription(
    plan: PlannedSubscription,
    project: Smile | Fire
  ): boolean {
    try {
      // Validate plan is active
      if (plan.status !== 'active') {
        console.warn('Plan is not active');
        return false;
      }

      // Find the corresponding subscription
      // Note: subscription has negative amount, plan has positive
      const subscriptionIndex = AppStateService.instance.allSubscriptions.findIndex(sub =>
        sub.title === plan.title &&
        sub.category === plan.category &&
        Math.abs(sub.amount) === Math.abs(plan.amount) &&
        sub.frequency === plan.frequency
      );

      if (subscriptionIndex !== -1) {
        // Set end date to today instead of deleting
        const subscription = AppStateService.instance.allSubscriptions[subscriptionIndex];
        subscription.endDate = new Date().toISOString().split('T')[0];
      }

      // Update plan status to inactive
      plan.status = 'inactive';
      plan.updatedAt = new Date().toISOString();
      plan.deactivatedAt = new Date().toISOString();
      
      // Clear active subscription reference
      delete plan.activeSubscriptionId;

      // Save to database
      this.persistence.writeAndSync({
        tag: 'subscriptions',
        data: AppStateService.instance.allSubscriptions,
        localStorageKey: 'subscriptions',
        logEvent: 'deactivate_payment_plan',
        logMetadata: { title: plan.title, projectTitle: plan.projectTitle },
        onSuccess: () => {
          console.log('Subscription deactivated - end date set to today');
        },
        onError: (error) => {
          console.error('Failed to update subscription in database:', error);
        }
      });

      return true;
    } catch (error) {
      console.error('Error deactivating planned subscription:', error);
      return false;
    }
  }

  /**
   * Reactivate an inactive planned subscription
   * Updates start date to today and end date based on the plan's target date
   * Looks for existing subscription first, creates new one if not found
   * 
   * @param plan - Planned subscription to reactivate
   * @param project - Parent Smile or Fire project
   * @returns true if successful, false otherwise
   */
  reactivatePlannedSubscription(
    plan: PlannedSubscription,
    project: Smile | Fire
  ): boolean {
    try {
      // Validate plan is inactive
      if (plan.status === 'active') {
        console.warn('Plan is already active');
        return false;
      }

      const today = new Date().toISOString().split('T')[0];
      const endDate = plan.targetDate || plan.endDate;

      // Look for existing subscription (that was deactivated)
      const subscriptionIndex = AppStateService.instance.allSubscriptions.findIndex(sub =>
        sub.title === plan.title &&
        sub.category === plan.category &&
        Math.abs(sub.amount) === Math.abs(plan.amount) &&
        sub.frequency === plan.frequency
      );

      if (subscriptionIndex !== -1) {
        // Update existing subscription with new dates
        const subscription = AppStateService.instance.allSubscriptions[subscriptionIndex];
        subscription.startDate = today;
        subscription.endDate = endDate;
      } else {
        // Create new subscription if not found
        const subscription: Subscription = {
          title: plan.title,
          account: plan.account,
          amount: plan.amount * -1,  // Negative: deducting from account
          startDate: today,
          endDate: endDate,
          category: plan.category,
          comment: plan.comment,
          frequency: plan.frequency
        };
        AppStateService.instance.allSubscriptions.push(subscription);
      }

      // Update plan status to active
      plan.status = 'active';
      plan.updatedAt = new Date().toISOString();
      plan.activatedAt = new Date().toISOString();
      delete plan.deactivatedAt;

      // Save to database
      this.persistence.writeAndSync({
        tag: 'subscriptions',
        data: AppStateService.instance.allSubscriptions,
        localStorageKey: 'subscriptions',
        logEvent: 'reactivate_payment_plan',
        logMetadata: { title: plan.title, projectTitle: plan.projectTitle },
        onSuccess: () => {
          console.log('Subscription reactivated with new dates');
        },
        onError: (error) => {
          console.error('Failed to reactivate subscription in database:', error);
        }
      });

      return true;
    } catch (error) {
      console.error('Error reactivating planned subscription:', error);
      return false;
    }
  }

  /**
   * Delete a planned subscription
   * Removes from project's plannedSubscriptions array
   * If active, also removes from main subscriptions list
   * 
   * @param planId - ID of plan to delete
   * @param project - Parent Smile or Fire project
   * @returns true if successful, false otherwise
   */
  deletePlannedSubscription(
    planId: string,
    project: Smile | Fire
  ): boolean {
    try {
      if (!project.plannedSubscriptions) {
        return false;
      }

      const planIndex = project.plannedSubscriptions.findIndex(p => p.id === planId);
      
      if (planIndex === -1) {
        console.warn('Plan not found');
        return false;
      }

      const plan = project.plannedSubscriptions[planIndex];

      // If plan is active, deactivate it first
      if (plan.status === 'active') {
        this.deactivatePlannedSubscription(plan, project);
      }

      // Remove from project's planned subscriptions
      project.plannedSubscriptions.splice(planIndex, 1);

      return true;
    } catch (error) {
      console.error('Error deleting planned subscription:', error);
      return false;
    }
  }

  /**
   * Update a planned subscription
   * If active, updates the corresponding subscription in main list
   * 
   * @param plan - Updated plan
   * @param project - Parent Smile or Fire project
   * @returns true if successful, false otherwise
   */
  updatePlannedSubscription(
    plan: PlannedSubscription,
    project: Smile | Fire
  ): boolean {
    try {
      plan.updatedAt = new Date().toISOString();

      // If plan is active, update the corresponding subscription
      if (plan.status === 'active') {
        const subscriptionIndex = AppStateService.instance.allSubscriptions.findIndex(sub =>
          sub.title === plan.title &&
          sub.category === plan.category
        );

        if (subscriptionIndex !== -1) {
          const subscription = AppStateService.instance.allSubscriptions[subscriptionIndex];
          subscription.amount = plan.amount * -1;  // Negative: money leaves account
          subscription.startDate = plan.startDate;
          subscription.endDate = plan.endDate;
          subscription.comment = plan.comment;
          subscription.frequency = plan.frequency;
          subscription.account = plan.account;
          
          // Save updated subscriptions to database
          this.persistence.writeAndSync({
            tag: 'subscriptions',
            data: AppStateService.instance.allSubscriptions,
            localStorageKey: 'subscriptions',
            logEvent: 'update_payment_plan',
            logMetadata: { title: plan.title, projectTitle: plan.projectTitle },
            onSuccess: () => {
              console.log('Subscription updated and saved to database');
            },
            onError: (error) => {
              console.error('Failed to update subscription in database:', error);
            }
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Error updating planned subscription:', error);
      return false;
    }
  }

  /**
   * Get all active planned subscriptions for a project
   * 
   * @param project - Smile or Fire project
   * @returns Array of active plans
   */
  getActivePlans(project: Smile | Fire): PlannedSubscription[] {
    return project.plannedSubscriptions?.filter(p => p.status === 'active') || [];
  }

  /**
   * Get all planned (not yet activated) subscriptions for a project
   * 
   * @param project - Smile or Fire project
   * @returns Array of planned (not active) plans
   */
  getPlannedPlans(project: Smile | Fire): PlannedSubscription[] {
    return project.plannedSubscriptions?.filter(p => p.status === 'planned') || [];
  }

  /**
   * Get all inactive planned subscriptions for a project
   * 
   * @param project - Smile or Fire project
   * @returns Array of inactive plans
   */
  getInactivePlans(project: Smile | Fire): PlannedSubscription[] {
    return project.plannedSubscriptions?.filter(p => p.status === 'inactive') || [];
  }

  /**
   * Check if a subscription in the main list is linked to a payment plan
   * 
   * @param subscription - Subscription to check
   * @param allProjects - All Smile and Fire projects
   * @returns Linked plan if found, undefined otherwise
   */
  findLinkedPlan(
    subscription: Subscription,
    allProjects: Array<Smile | Fire>
  ): PlannedSubscription | undefined {
    for (const project of allProjects) {
      if (!project.plannedSubscriptions) continue;

      const linkedPlan = project.plannedSubscriptions.find(plan =>
        plan.status === 'active' &&
        plan.title === subscription.title &&
        plan.category === subscription.category &&
        plan.amount === subscription.amount &&
        plan.frequency === subscription.frequency
      );

      if (linkedPlan) {
        return linkedPlan;
      }
    }

    return undefined;
  }
}
