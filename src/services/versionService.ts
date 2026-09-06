export interface VersionConfig {
  min_supported_version: number;
  latest_version: number;
  force_update: boolean;
  update_url: string;
  message_hindi: string;
  message_english: string;
}

export const CURRENT_APP_VERSION = 59.0;

const CLOUD_GIST_ID = 'a62d2ce04fb2cad264471951a42790da';
const RAW_GIST_URL = `https://gist.githubusercontent.com/ashirvadraj/${CLOUD_GIST_ID}/raw/app_version_config.json`;
const REPO_FALLBACK_URL = 'https://raw.githubusercontent.com/ashirvadraj/sunehre-geet/main/version_config.json';
const API_GIST_URL = `https://api.github.com/gists/${CLOUD_GIST_ID}`;

export const VersionService = {
  isLocked: false,
  cachedConfig: null as VersionConfig | null,

  async checkVersion(): Promise<{ isUpdateRequired: boolean; config: VersionConfig | null }> {
    const urls = [
      `${RAW_GIST_URL}?_t=${Date.now()}`,
      `${REPO_FALLBACK_URL}?_t=${Date.now()}`,
      API_GIST_URL,
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'SunehreGeet-VersionCheck',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });

        if (res.ok) {
          const json = await res.json();
          let config: VersionConfig | null = null;

          if (json && typeof json.min_supported_version === 'number') {
            config = json as VersionConfig;
          } else if (json?.files?.['app_version_config.json']?.content) {
            config = JSON.parse(json.files['app_version_config.json'].content);
          }

          if (config && typeof config.min_supported_version === 'number') {
            const isUpdateRequired = config.force_update && CURRENT_APP_VERSION < config.min_supported_version;
            this.cachedConfig = config;
            if (isUpdateRequired) {
              this.isLocked = true;
            }
            return { isUpdateRequired, config };
          }
        }
      } catch (e) {
        // Try next fallback endpoint
      }
    }

    return { isUpdateRequired: this.isLocked, config: this.cachedConfig };
  },
};
