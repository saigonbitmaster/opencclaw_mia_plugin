import fs from "node:fs";
import path from "node:path";
//#region src/infra/update-install-root.ts
/** Resolve the canonical identity of an update checkout/install root. */
function resolveUpdateInstallRoot(root) {
	try {
		return fs.realpathSync.native(root);
	} catch {
		return path.resolve(root);
	}
}
function updateInstallRootsMatch(left, right) {
	return resolveUpdateInstallRoot(left) === resolveUpdateInstallRoot(right);
}
//#endregion
export { updateInstallRootsMatch as n, resolveUpdateInstallRoot as t };
