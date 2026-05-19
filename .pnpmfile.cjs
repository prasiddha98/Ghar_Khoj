module.exports = {
  hooks: {
    readPackage(pkg) {
      // Allow all packages to run build scripts
      return pkg;
    },
  },
};
