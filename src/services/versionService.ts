export interface VersionConfig {
  min_supported_version: number;
  latest_version: number;
  force_update: boolean;
  update_url: string;
  message_hindi: string;
  message_english: string;
}

export const CURRENT_APP_VERSION = 51.0;

const CLOUD_GIST_ID = 'a62d2ce04fb2cad264471951a42790da';
const CLOUD_GIST_TOKEN = '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';

export const VersionService = {
  async checkVersion(): Promise<{ isUpdateRequired: boolean; config: VersionConfig | null }> {
    try {
      const res = await fetch(`https://api.github.com/gists/${CLOUD_GIST_ID}`, {
        headers: {
          'User-Agent': 'SunehreGeet-VersionCheck',
          'Authorization': `token ${CLOUD_GIST_TOKEN}`,
        },
      });

      if (res.ok) {
        const gist = await res.json();
        if (gist?.files?.['app_version_config.json']?.content) {
          const config: VersionConfig = JSON.parse(gist.files['app_version_config.json'].content);
          if (config && typeof config.min_supported_version === 'number') {
            const isUpdateRequired = config.force_update && CURRENT_APP_VERSION < config.min_supported_version;
            return { isUpdateRequired, config };
          }
        }
      }
    } catch (e) {
      console.warn('Version check error:', e);
    }
    return { isUpdateRequired: false, config: null };
  },
};
