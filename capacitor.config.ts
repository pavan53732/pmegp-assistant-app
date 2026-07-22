import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor 7 configuration for the PMEGP Assistant Android app.
//
// Encryption note: SQLite uses mode "secret" with a passphrase sourced from
// Secure Storage (Android Keystore). The earlier "mode: no-encryption" with an
// "encrypted: true" flag was self-contradictory — "no-encryption" disables
// encryption entirely. SQLCipher is engaged only when an encryption mode + key
// are supplied; the native SQLCipher library is bundled by the plugin in that
// case. See src/database/sqlite/connection.ts for key retrieval.
const config: CapacitorConfig = {
  appId: "com.pmegp.assistant",
  appName: "PMEGP Assistant",
  webDir: "dist",
  server: { androidScheme: "https" },
  plugins: {
    SQLite: {
      databaseName: "pmegp.db",
      encrypted: true,
      mode: "secret",
    },
    Camera: { permissions: ["camera"] },
    Filesystem: { iosDocumentStorageDirectory: "Documents" },
    Share: {},
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#064e3b",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: { style: "dark", backgroundColor: "#064e3b" },
  },
};

export default config;
