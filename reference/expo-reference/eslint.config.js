let expoConfig = [];
try {
	expoConfig = require("eslint-config-expo/flat");
} catch {
	// eslint-config-expo/flat may not be available in all environments
}

module.exports = [
	...expoConfig,
	{
		ignores: ["dist/*", "node_modules/*", ".expo/*", "worker/*"],
	},
];
