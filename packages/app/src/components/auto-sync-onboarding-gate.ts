export interface AutoSyncOnboardingGateInputs {
  autoSyncOnboardingDismissed: boolean;
  hasRemote: boolean | undefined;
  projectLocalSynced: boolean | undefined;
  projectSynced: boolean | undefined;
  projectLocalConfig: { autoSync?: { enabled: boolean | null } | null } | null;
  projectConfig: { autoSync?: { default?: boolean | null } | null } | null;
  pushPermissionCheckStatus: 'allowed' | 'denied' | 'unknown' | undefined;
}

export function shouldShowAutoSyncOnboarding(inputs: AutoSyncOnboardingGateInputs): boolean {
  return (
    !inputs.autoSyncOnboardingDismissed &&
    inputs.hasRemote === true &&
    inputs.projectLocalSynced === true &&
    inputs.projectSynced === true &&
    inputs.projectLocalConfig !== null &&
    inputs.projectLocalConfig.autoSync?.enabled === null &&
    (inputs.projectConfig?.autoSync?.default ?? null) === null &&
    (inputs.pushPermissionCheckStatus === 'allowed' ||
      inputs.pushPermissionCheckStatus === 'unknown')
  );
}
