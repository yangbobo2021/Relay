import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";

export function prepareDshLocalWorkspaceLinks(dshRoot) {
  const deepseekPackages = join(dshRoot, "node_modules", ".pnpm", "node_modules", "@deepseek-ai");
  const packageSources = new Map();
  for (const packageName of readdirSync(deepseekPackages)) {
    packageSources.set(`@deepseek-ai/${packageName}`, join(deepseekPackages, packageName));
  }

  const vendorSources = collectVendorSources(dshRoot);
  for (const [packageName, source] of vendorSources) packageSources.set(packageName, source);

  for (const source of new Set(packageSources.values())) {
    linkPackageWorkspaceDependencies(dshRoot, source, packageSources);
  }
}

export function linkDshWorkspacePackagesInto(dshRoot, targetNodeModules) {
  const sourceDirectory = join(dshRoot, "node_modules", ".pnpm", "node_modules", "@deepseek-ai");
  const peerDirectory = join(targetNodeModules, "@deepseek-ai");
  mkdirSync(peerDirectory, { recursive: true });
  for (const peer of readdirSync(sourceDirectory)) {
    linkForce(join(sourceDirectory, peer), join(peerDirectory, peer));
  }
}

function linkPackageWorkspaceDependencies(dshRoot, source, packageSources) {
  const manifestPath = join(source, "package.json");
  if (!existsSync(manifestPath)) return;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const dependencies = { ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.devDependencies };
  for (const [name, version] of Object.entries(dependencies)) {
    if (name === "@standard-schema/spec") {
      linkStandardSchemaSpec(dshRoot, source);
      continue;
    }
    if (typeof version !== "string" || !version.startsWith("workspace:")) continue;
    const dependencySource = packageSources.get(name);
    if (dependencySource === undefined) continue;
    linkForce(dependencySource, join(source, "node_modules", ...name.split("/")));
  }
}

function collectVendorSources(dshRoot) {
  const vendors = new Map();
  const vendorRoot = join(dshRoot, "vendor");
  for (const directory of readdirSync(vendorRoot)) {
    const source = join(vendorRoot, directory);
    const manifestPath = join(source, "package.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    vendors.set(manifest.name, source);
  }
  return vendors;
}

function linkStandardSchemaSpec(dshRoot, source) {
  const target = join(source, "node_modules", "@standard-schema", "spec");
  const dependencySource = join(dshRoot, "node_modules", ".pnpm", "node_modules", "@standard-schema", "spec");
  linkForce(dependencySource, target);
}

function linkForce(source, target) {
  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  symlinkSync(source, target, "dir");
}
