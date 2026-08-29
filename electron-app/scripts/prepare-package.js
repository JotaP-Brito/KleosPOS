const fs = require("fs");
const path = require("path");

const electronDir = path.resolve(__dirname, "..");
const workspaceDir = path.resolve(electronDir, "..");
const bundleDir = path.join(electronDir, ".bundle");

const ensureExists = (target, label) => {
  if (!fs.existsSync(target)) throw new Error(`${label} not found: ${target}`);
};

const cleanDir = (target) => {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
};

const copyDir = (source, destination, filter) => fs.cpSync(source, destination, { recursive: true, force: true, filter });

const backendSource = path.join(workspaceDir, "pos-backend");
const frontendSource = path.join(workspaceDir, "pos-frontend", "dist");
ensureExists(path.join(backendSource, "app.js"), "Backend app");
ensureExists(path.join(frontendSource, "index.html"), "Frontend build");

cleanDir(bundleDir);
copyDir(backendSource, path.join(bundleDir, "pos-backend"), (source) => path.basename(source) !== ".env");
copyDir(frontendSource, path.join(bundleDir, "pos-frontend", "dist"));
console.log(`Prepared packaged resources in ${bundleDir}`);
