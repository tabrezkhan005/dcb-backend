import axios from "axios";
import { log } from "../../utils/logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const unique = [...new Set(tokens.filter((t) => t.length > 0))];
  if (unique.length === 0) {
    return;
  }

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    const messages: ExpoPushMessage[] = chunk.map((to) => ({
      to,
      title,
      body,
      data,
    }));

    try {
      const res = await axios.post<{ data?: { status?: string; message?: string }[] }>(
        EXPO_PUSH_URL,
        messages,
        {
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          validateStatus: () => true,
        },
      );

      if (res.status >= 400) {
        log.error("Expo push HTTP error", {
          status: res.status,
          body: JSON.stringify(res.data).slice(0, 500),
        });
        continue;
      }

      const results = Array.isArray(res.data?.data) ? res.data.data : [];
      for (const row of results) {
        if (row?.status === "error") {
          log.warn("Expo push message error", { message: row.message });
        }
      }
    } catch (err) {
      log.error("Expo push request failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
