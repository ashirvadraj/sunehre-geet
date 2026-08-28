// Sunehre Geet - Smart Song Recommendation & Notification Service
import { SONGS } from '../data/songs';
import { Song } from '../types';

const NOTIFICATION_PHRASES = [
  'मौसम है सुहाना, सुनिए यह सदाबहार तराना 🎶',
  'पुरानी यादें ताज़ा करने का वक़्त... सुनिए यह ख़ास गीत ✨',
  'दिल को छू लेने वाली एक सुरीली धुन आपके लिए 📻',
  'शाम की चाय और यह दिलकश नगमा... क्या बात है! ☕',
  'मोहम्मद रफ़ी और किशोर दा का यह अमर गीत सुना क्या? 🎵',
  'आज के दिन को बनाइए और भी यादगार इस क्लासिक के साथ 🌸',
  'सदाबहार यादों का सफ़र... एक खूबसूरत गीत आपके नाम 🎼',
  'सुकून भरे कुछ पल... सुनिए यह रूहानी धुन 🕊️',
  'गुनगुनाइए यह प्यारा सा नगमा... दिल खुश हो जाएगा! 💛',
  'मौसम के मिज़ाज के साथ एक अनमोल क्लासिक धुन 🌧️',
  'रात की ख़ामोशी और यह सदाबहार संगीत... सुनिए अभी 🌙',
  'सुरों की महफ़िल सजाइए इस सदाबहार क्लासिक के संग 🎻',
  'एक प्यारा सा गीत, जो आपके चेहरे पर मुस्कान ला दे 😊',
  'सुनहरे दौर का वो अमर गीत जो आज भी दिल धड़काता है 💖',
  'लता जी और मुकेश जी की आवाज़ का यह जादू कभी पुराना नहीं होता 🌹',
  'दिल की गहराइयों को छूने वाला सुरीला संगीत 🎧',
];

const STORAGE_KEY_LAST_NOTIF = 'sunehre_geet_last_recommendation_time';
const STORAGE_KEY_LAST_PHRASE = 'sunehre_geet_last_recommendation_phrase';
const MIN_INTERVAL_MS = 2 * 60 * 60 * 1000; // Minimum 2 hours between automatic notifications

export const RecommendationService = {
  /**
   * Pick a random golden masterpiece song
   */
  pickRandomMasterpiece(): Song {
    const indianSongs = SONGS.filter((s) => {
      if (s.language === 'english') return false;
      const combined = `${s.title} ${s.artist} ${s.movie}`.toLowerCase();
      return !combined.includes('bhojpuri');
    });

    const goldenLegends = [
      'kishore', 'lata', 'rafi', 'mukesh', 'asha', 'jagjit', 'hemant', 
      'sonu nigam', 'kk', 'kumar sanu', 'udit narayan', 'alka yagnik', 
      'lucky ali', 'shreya ghoshal', 'arijit singh', 'mohit chauhan'
    ];

    const corePool = indianSongs.filter((s) => {
      const txt = `${s.artist} ${s.title}`.toLowerCase();
      return goldenLegends.some((g) => txt.includes(g));
    });

    const pool = corePool.length > 0 ? corePool : indianSongs;
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
  },

  /**
   * Pick a random poetic phrase different from the previous one
   */
  pickRandomPhrase(): string {
    const lastPhrase = localStorage.getItem(STORAGE_KEY_LAST_PHRASE) || '';
    const candidates = NOTIFICATION_PHRASES.filter((p) => p !== lastPhrase);
    const pool = candidates.length > 0 ? candidates : NOTIFICATION_PHRASES;
    const selected = pool[Math.floor(Math.random() * pool.length)];
    try {
      localStorage.setItem(STORAGE_KEY_LAST_PHRASE, selected);
    } catch {}
    return selected;
  },

  /**
   * Send a rich song recommendation notification via native plugin
   */
  async sendRecommendation(customSong?: Song): Promise<boolean> {
    try {
      const song = customSong || this.pickRandomMasterpiece();
      const phrase = this.pickRandomPhrase();

      const cap = (window as any).Capacitor;
      if (cap?.Plugins?.MediaNotificationPlugin?.sendSongRecommendation) {
        await cap.Plugins.MediaNotificationPlugin.sendSongRecommendation({
          phrase,
          songTitle: song.title,
          songArtist: song.artist,
          songId: song.id,
          coverUrl: song.coverUrl,
        });

        try {
          localStorage.setItem(STORAGE_KEY_LAST_NOTIF, Date.now().toString());
        } catch {}
        return true;
      }
    } catch (e) {
      console.warn('Could not dispatch song recommendation notification:', e);
    }
    return false;
  },

  /**
   * Check and send automatic periodic recommendation if enough time has passed
   */
  checkAndSendPeriodicRecommendation(): void {
    try {
      const lastTimeStr = localStorage.getItem(STORAGE_KEY_LAST_NOTIF);
      const lastTime = lastTimeStr ? parseInt(lastTimeStr, 10) : 0;
      const now = Date.now();

      if (now - lastTime >= MIN_INTERVAL_MS) {
        // Send a random recommendation after a short delay
        setTimeout(() => {
          this.sendRecommendation();
        }, 12000); // 12 seconds after launch
      }
    } catch {}
  },

  /**
   * Start periodic timer to check every 45 minutes
   */
  startScheduler(): () => void {
    this.checkAndSendPeriodicRecommendation();
    const interval = setInterval(() => {
      this.checkAndSendPeriodicRecommendation();
    }, 45 * 60 * 1000);

    return () => clearInterval(interval);
  }
};
