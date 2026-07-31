export interface CreateModuleOptions {
  sourceRoot?: string;
}

export function createModule(name: string, options?: CreateModuleOptions): Promise<string>;
