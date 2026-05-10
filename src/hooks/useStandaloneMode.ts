import { useEffect, useState } from "react";

const matches = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-ignore - iOS Safari
    window.navigator.standalone === true ||
    document.referrer.startsWith("android-app://"));

export const isStandalone = () => matches();

export const useStandaloneMode = () => {
  const [standalone, setStandalone] = useState<boolean>(matches());

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const handler = () => setStandalone(matches());
    mq.addEventListener?.("change", handler);
    window.addEventListener("appinstalled", handler);
    return () => {
      mq.removeEventListener?.("change", handler);
      window.removeEventListener("appinstalled", handler);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("app-mode", standalone);
  }, [standalone]);

  return standalone;
};
