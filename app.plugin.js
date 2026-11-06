const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * munim-haptics needs no configuration: the library's own Android manifest
 * already declares VIBRATE, and Core Haptics needs no Info.plist key. Adding
 * the plugin is optional; it also lists VIBRATE in the app's own manifest.
 *
 * @param {import('@expo/config-plugins').ExpoConfig} config
 */
function withMunimHaptics(config) {
  return withAndroidManifest(config, (pluginConfig) => {
    const manifest = pluginConfig.modResults.manifest;
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }
    const permissions = manifest['uses-permission'];
    const name = 'android.permission.VIBRATE';
    if (!permissions.some((entry) => entry.$?.['android:name'] === name)) {
      permissions.push({ $: { 'android:name': name } });
    }
    return pluginConfig;
  });
}

module.exports = withMunimHaptics;
module.exports.default = withMunimHaptics;
