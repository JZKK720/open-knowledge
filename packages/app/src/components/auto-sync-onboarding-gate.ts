export interface AutoSyncOnboardingGateInputs {
  autoSyncOnboardingDismissed: boolean;
  hasRemote: boolean | undefined;
  projectLocalSynced: boolean | undefined;
  projectLocalConfig: { autoSync?: { enabled: boolean | null } | null } | null;
  pushPermissionCheckStatus: 'allowed' | 'denied' | 'unknown' | undefined;
}

export function shouldShowAutoSyncOnboarding(inputs: AutoSyncOnboardingGateInputs): boolean {
  return (
    !inputs.autoSyncOnboardingDismissed &&
    inputs.hasRemote === true &&
    inputs.projectLocalSynced === true &&
    inputs.projectLocalConfig !== null &&
    inputs.projectLocalConfig.autoSync?.enabled === null &&
    (inputs.pushPermissionCheckStatus === 'allowed' ||
      inputs.pushPermissionCheckStatus === 'unknown')
  );
}
