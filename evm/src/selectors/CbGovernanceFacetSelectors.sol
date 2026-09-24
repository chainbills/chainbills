// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbGovernance} from '../interfaces/ICbGovernance.sol';

/// Selectors routed to `CbGovernanceFacet`.
library CbGovernanceFacetSelectors {
  /// Returns every selector served by `CbGovernanceFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](29);
    sels[0] = ICbGovernance.hasRole.selector;
    sels[1] = ICbGovernance.getRoleAdmin.selector;
    sels[2] = ICbGovernance.grantRole.selector;
    sels[3] = ICbGovernance.revokeRole.selector;
    sels[4] = ICbGovernance.renounceRole.selector;
    sels[5] = ICbGovernance.setRoleAdmin.selector;
    sels[6] = ICbGovernance.grantRoleBatch.selector;
    sels[7] = ICbGovernance.getRoleMemberCount.selector;
    sels[8] = ICbGovernance.getRoleMember.selector;
    sels[9] = ICbGovernance.getRoleMembers.selector;
    sels[10] = ICbGovernance.getKnownRoles.selector;
    sels[11] = ICbGovernance.getRolesOf.selector;
    sels[12] = ICbGovernance.DEFAULT_ADMIN_ROLE.selector;
    sels[13] = ICbGovernance.CONFIG_MANAGER_ROLE.selector;
    sels[14] = ICbGovernance.CHAIN_MANAGER_ROLE.selector;
    sels[15] = ICbGovernance.TOKEN_MANAGER_ROLE.selector;
    sels[16] = ICbGovernance.FEE_MANAGER_ROLE.selector;
    sels[17] = ICbGovernance.PAUSER_ROLE.selector;
    sels[18] = ICbGovernance.UNPAUSER_ROLE.selector;
    sels[19] = ICbGovernance.RELAYER_ROLE.selector;
    sels[20] = ICbGovernance.PAYABLE_SYNC_ROLE.selector;
    sels[21] = ICbGovernance.RESCUER_ROLE.selector;
    sels[22] = ICbGovernance.pause.selector;
    sels[23] = ICbGovernance.unpause.selector;
    sels[24] = ICbGovernance.pauseFeatures.selector;
    sels[25] = ICbGovernance.unpauseFeatures.selector;
    sels[26] = ICbGovernance.paused.selector;
    sels[27] = ICbGovernance.pausedFeatures.selector;
    sels[28] = ICbGovernance.isFeaturePaused.selector;
  }
}
