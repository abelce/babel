"use strict";

const path = require("path");
const compatData = require("@mdn/browser-compat-data").javascript;
const { process } = require("./build-modules-support");
const {
  generateData,
  environments,
  writeFile,
  defineLegacyPluginAliases,
} = require("./utils-build-data");

for (const target of ["plugin", "corejs2-built-in"]) {
  // We ignore 'overlapping' here, because it's already generated by
  // built-bugfixes-targets.js which has a complete view over all the
  // plugins that we have data for.
  let { data: newData } = generateData(
    environments,
    require(`./data/${target}-features`)
  );
  if (target === "plugin") {
    // add export-namespace-from from @mdn/browser-compat-data
    const exportNamespaceFromCompatData = process(
      compatData.statements.export.namespace
    );
    // the node.js compat data is 12.0, the first node version ships `export *` behind a flag
    // here we overwrite to 13.2 which is the first unflagged version
    exportNamespaceFromCompatData.node = "13.2";
    newData["transform-export-namespace-from"] = exportNamespaceFromCompatData;

    // Add proposal-* aliases for backward compatibility.
    // TODO(Babel 7): This won't be needed anymore.
    newData = defineLegacyPluginAliases(newData);
  }
  const dataPath = path.join(__dirname, `../data/${target}s.json`);

  if (!writeFile(newData, dataPath, target)) {
    process.exitCode = 1;
    break;
  }
}
