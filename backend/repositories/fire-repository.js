'use strict';

/**
 * Fire projects — see fund-project-repository.js, which implements Smile
 * and Fire once (they differ only in storage key and naming).
 */

const {
  FUND_PHASES,
  createFundProjectRepository,
  encryptProject,
} = require('./fund-project-repository');

const repository = createFundProjectRepository({
  kind: 'fire',
  label: 'Fire',
  codePrefix: 'FIRE',
});

module.exports = {
  FIRE_PHASES: FUND_PHASES,
  listFireProjects: repository.listProjects,
  getFireProject: repository.getProject,
  createFireProject: repository.createProject,
  updateFireProject: repository.updateProject,
  deleteFireProject: repository.deleteProject,
  createFirePaymentPlan: repository.createPaymentPlan,
  // Re-exported for data-repository.js's importUserData, which delegates to
  // each collection's own encrypt logic per D-9 rather than reimplementing it.
  encryptProject,
  decryptAllProjects: repository.decryptAllProjects,
  repository,
};
