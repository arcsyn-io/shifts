export interface CheckArchitectureOptions {
  sourceRoot?: string;
}

export function checkArchitecture(options?: CheckArchitectureOptions): Promise<string[]>;
