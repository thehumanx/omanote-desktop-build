// Bridge to the shared Convex backend. Metro's watchFolders config makes the
// monorepo root visible so this relative import resolves at build time.
export { api } from '../../../convex/_generated/api';
export type { Id, Doc } from '../../../convex/_generated/dataModel';
