import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Smartphone, Download, Share2, CheckCircle2 } from "lucide-react";
import { isStandalone } from "@/hooks/useStandaloneMode";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface Props {
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  fullWidth?: boolean;
}

const InstallAppButton = ({ variant = "default", size = "sm", className, fullWidth }: Props) => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [showHelp, setShowHelp] = useState(false);

  const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase()) && !/crios|fxios/.test(navigator.userAgent.toLowerCase());

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    setShowHelp(true);
  }, [deferred]);

  if (installed) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium ${className || ""}`}>
        <CheckCircle2 className="h-3.5 w-3.5" /> App installed
      </span>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        className={`gap-2 ${fullWidth ? "w-full" : ""} ${className || ""}`}
      >
        <Download className="h-4 w-4" />
        Install App
      </Button>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" /> Install OTS App
            </DialogTitle>
            <DialogDescription>
              Get one-tap access from your home screen with offline support and live notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {isIOS ? (
              <div className="space-y-2">
                <p className="font-medium">On iPhone / iPad (Safari):</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>
                    Tap the <Share2 className="inline h-4 w-4" /> Share button at the bottom of Safari.
                  </li>
                  <li>
                    Scroll down and tap <strong>Add to Home Screen</strong>.
                  </li>
                  <li>
                    Tap <strong>Add</strong> in the top-right corner.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="font-medium">On Android / Chrome:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Open the browser menu (⋮) at the top-right.</li>
                  <li>
                    Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                  </li>
                  <li>Confirm to install.</li>
                </ol>
                <p className="text-xs text-muted-foreground pt-2">
                  Note: this is a Progressive Web App installed directly from your browser — it is safe and never
                  triggers any "harmful app" warning.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallAppButton;
