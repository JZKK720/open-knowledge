export interface BottomComposerGateInputs {
  terminalVisible: boolean;
  isEmbedded: boolean;
  isDesktop: boolean;
  activeDocName: string | null;
}

export function shouldShowBottomComposer(inputs: BottomComposerGateInputs): boolean {
  return (
    !inputs.terminalVisible &&
    !inputs.isEmbedded &&
    inputs.isDesktop &&
    inputs.activeDocName !== null
  );
}

export function shouldShowFolderComposer(
  inputs: Omit<BottomComposerGateInputs, 'activeDocName'>,
): boolean {
  return !inputs.terminalVisible && !inputs.isEmbedded && inputs.isDesktop;
}
