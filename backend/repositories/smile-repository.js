'use strict';

/**
 * Smile projects — see fund-project-repository.js, which implements Smile
 * and Fire once (they differ only in storage key and naming).
 */

const {
  FUND_PHASES,
  createFundProjectRepository,
  encryptProject,
} = require('./fund-project-repository');

const repository = createFundProjectRepository({
  kind: 'smile',
  label: 'Smile',
  codePrefix: 'SMILE',
});

module.exports = {
  SMILE_PHASES: FUND_PHASES,
  listSmileProjects: repository.listProjects,
  getSmileProject: repository.getProject,
  createSmileProject: repository.createProject,
  updateSmileProject: repository.updateProject,
  deleteSmileProject: repository.deleteProject,
  createSmilePaymentPlan: repository.createPaymentPlan,
  // Re-exported for data-repository.js's importUserData, which delegates to
  // each collection's own encrypt logic per D-9 rather than reimplementing it.
  encryptProject,
  decryptAllProjects: repository.decryptAllProjects,
  repository,
};
