import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Smartphone,
  Download,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Check,
  Shield,
  Store,
  Globe,
  FileCode,
  Rocket,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';

interface StepProps {
  number: number;
  title: string;
  children: React.ReactNode;
  icon: React.ReactNode;
}

function Step({ number, title, children, icon }: StepProps) {
  const [open, setOpen] = useState(number === 1);
  return (
    <Card className="bg-slate-800/60 border-slate-700/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 font-bold text-sm border border-blue-500/30">
          {number}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon}
          <h3 className="text-base font-semibold text-white truncate">{title}</h3>
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="h-5 w-5 text-slate-400 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-0 border-t border-slate-700/30">
          <div className="pl-14 space-y-3 text-sm text-slate-300 leading-relaxed">
            {children}
          </div>
        </div>
      )}
    </Card>
  );
}

function CodeBlock({ code, filename }: { code: string; filename?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-600/50 my-3">
      {filename && (
        <div className="flex items-center justify-between bg-slate-700/80 px-4 py-2 border-b border-slate-600/50">
          <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            <FileCode className="h-3.5 w-3.5" />
            {filename}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
      <pre className="bg-slate-900/80 p-4 overflow-x-auto text-xs leading-relaxed">
        <code className="text-emerald-300 font-mono whitespace-pre">{code}</code>
      </pre>
      {!filename && (
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2 right-2 text-slate-500 hover:text-white p-1.5 rounded-md hover:bg-slate-700/50 transition-colors"
        >
          {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

function InfoBox({ type, children }: { type: 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  };
  const icons = {
    info: <Info className="h-4 w-4 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />,
    success: <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />,
  };

  return (
    <div className={`flex gap-2.5 p-3 rounded-lg border text-xs leading-relaxed ${styles[type]}`}>
      {icons[type]}
      <div>{children}</div>
    </div>
  );
}

const ASSET_LINKS_EXAMPLE = `[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.yourdomain.twa",
    "sha256_cert_fingerprints": [
      "YOUR_SHA256_FINGERPRINT_HERE"
    ]
  }
}]`;

const MANIFEST_EXAMPLE = `{
  "name": "PIS UAE - Electronics & More",
  "short_name": "PIS UAE",
  "description": "Your one-stop shop for electronics, clothing, and more",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#3b82f6",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}`;

export default function PWAGuide() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10" />
        <div className="container mx-auto px-4 py-12 sm:py-16 relative">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/20">
                <Smartphone className="h-6 w-6 text-white" />
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
                PWA Ready
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 bg-gradient-to-r from-white via-blue-100 to-blue-300 bg-clip-text text-transparent">
              Install PIS UAE on Your Device
            </h1>
            <p className="text-slate-400 text-base sm:text-lg max-w-2xl">
              Get the full app experience on your Android or iOS device, or publish to the Google Play Store using Trusted Web Activity (TWA).
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-16">
        <div className="max-w-3xl mx-auto space-y-10">

          {/* Section A: Install on Android */}
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <Download className="h-5 w-5 text-blue-400" />
              <h2 className="text-xl font-bold text-white">Part A: Install PWA on Android</h2>
            </div>

            <div className="space-y-3">
              <Step number={1} title="Open in Chrome Browser" icon={<Globe className="h-4 w-4 text-blue-400" />}>
                <p>Open <strong className="text-white">Google Chrome</strong> on your Android device and navigate to:</p>
                <CodeBlock code={`${window.location.origin}`} />
                <InfoBox type="info">
                  PWA installation works best with Chrome 89+ on Android. Samsung Internet and Edge also support PWA installation.
                </InfoBox>
              </Step>

              <Step number={2} title="Tap the Install Banner or Menu" icon={<Download className="h-4 w-4 text-blue-400" />}>
                <p>You should see an <strong className="text-white">"Install app"</strong> banner at the bottom of the screen. If not:</p>
                <ol className="list-decimal list-inside space-y-2 ml-1">
                  <li>Tap the <strong className="text-white">three-dot menu</strong> (⋮) in the top-right corner</li>
                  <li>Look for <strong className="text-white">"Install app"</strong> or <strong className="text-white">"Add to Home screen"</strong></li>
                  <li>Tap it and confirm the installation</li>
                </ol>
                <InfoBox type="success">
                  Once installed, the app will appear on your home screen with its own icon, launch in full-screen mode, and work offline for cached content.
                </InfoBox>
              </Step>

              <Step number={3} title="Launch & Enjoy" icon={<Rocket className="h-4 w-4 text-blue-400" />}>
                <p>Find the <strong className="text-white">PIS UAE</strong> icon on your home screen and tap to launch. The app will:</p>
                <ul className="space-y-1.5 ml-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    Open in full-screen standalone mode (no browser chrome)
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    Support push notifications (if enabled)
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    Cache pages for faster loading and offline access
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    Appear in your app switcher like a native app
                  </li>
                </ul>
              </Step>
            </div>
          </div>

          {/* Divider between Android and iOS */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">iOS Users</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          </div>

          {/* Section B: Install on iOS */}
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <Smartphone className="h-5 w-5 text-purple-400" />
              <h2 className="text-xl font-bold text-white">Part B: Install PWA on iOS (iPhone & iPad)</h2>
            </div>

            <InfoBox type="info">
              On iOS, PWAs can only be installed through <strong>Safari</strong>. Chrome, Firefox, and other browsers on iOS do not support the "Add to Home Screen" PWA feature.
            </InfoBox>

            <div className="space-y-3 mt-4">
              <Step number={1} title="Open the Website in Safari" icon={<Globe className="h-4 w-4 text-purple-400" />}>
                <p>Open <strong className="text-white">Safari</strong> on your iPhone or iPad and navigate to:</p>
                <CodeBlock code={`${window.location.origin}`} />
                <div className="rounded-xl overflow-hidden border border-slate-700/50 my-3">
                  <img
                    src="https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-22/1dad7f74-434b-4b93-ba78-c01771c0d075.png"
                    alt="Safari browser with share button highlighted"
                    className="w-full h-auto"
                    loading="lazy"
                  />
                  <div className="bg-slate-800/80 px-4 py-2.5 border-t border-slate-700/50">
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Info className="h-3 w-3 text-blue-400" />
                      Look for the <strong className="text-white">Share button</strong> (square with an upward arrow) at the bottom center of Safari
                    </p>
                  </div>
                </div>
                <InfoBox type="warning">
                  Make sure you're using <strong>Safari</strong> — not Chrome, Firefox, or any other browser. iOS only supports PWA installation through Safari.
                </InfoBox>
              </Step>

              <Step number={2} title="Tap the Share Button" icon={<ExternalLink className="h-4 w-4 text-purple-400" />}>
                <p>Locate and tap the <strong className="text-white">Share button</strong> at the bottom of the Safari toolbar:</p>
                <ul className="space-y-2 ml-1 mt-2">
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">1</span>
                    <span>The Share button looks like a <strong className="text-white">square with an upward arrow</strong> (⬆️)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">2</span>
                    <span>It's located at the <strong className="text-white">bottom center</strong> of the Safari toolbar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">3</span>
                    <span>If the toolbar is hidden, tap the bottom of the screen to reveal it</span>
                  </li>
                </ul>
                <InfoBox type="info">
                  On iPad, the Share button may be in the <strong>top-right corner</strong> of the Safari toolbar instead of the bottom.
                </InfoBox>
              </Step>

              <Step number={3} title="Select 'Add to Home Screen'" icon={<Download className="h-4 w-4 text-purple-400" />}>
                <p>In the Share sheet that appears, scroll down and tap <strong className="text-white">"Add to Home Screen"</strong>:</p>
                <div className="rounded-xl overflow-hidden border border-slate-700/50 my-3">
                  <img
                    src="https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-22/1b688f6b-31a1-47ca-b1df-7166ef1feaa7.png"
                    alt="Safari share sheet with Add to Home Screen option"
                    className="w-full h-auto"
                    loading="lazy"
                  />
                  <div className="bg-slate-800/80 px-4 py-2.5 border-t border-slate-700/50">
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Info className="h-3 w-3 text-blue-400" />
                      Scroll down in the share sheet to find <strong className="text-white">"Add to Home Screen"</strong> with a <strong className="text-white">+ icon</strong>
                    </p>
                  </div>
                </div>
                <ul className="space-y-2 ml-1 mt-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>You may need to <strong className="text-white">scroll down</strong> in the share sheet to find this option</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>If you don't see it, scroll to the bottom and tap <strong className="text-white">"Edit Actions"</strong> to add it to your favorites</span>
                  </li>
                </ul>
              </Step>

              <Step number={4} title="Confirm the App Name & Tap 'Add'" icon={<CheckCircle2 className="h-4 w-4 text-purple-400" />}>
                <p>A confirmation dialog will appear showing:</p>
                <ul className="space-y-2 ml-1 mt-2">
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">•</span>
                    <span><strong className="text-white">App icon</strong> — Preview of the home screen icon</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">•</span>
                    <span><strong className="text-white">App name</strong> — You can edit this (defaults to "PIS UAE")</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">•</span>
                    <span><strong className="text-white">URL</strong> — The website address</span>
                  </li>
                </ul>
                <p className="mt-3">Tap <strong className="text-white">"Add"</strong> in the top-right corner to complete the installation.</p>
              </Step>

              <Step number={5} title="Launch from Home Screen" icon={<Rocket className="h-4 w-4 text-purple-400" />}>
                <p>Find the <strong className="text-white">PIS UAE</strong> icon on your home screen and tap to launch!</p>
                <div className="rounded-xl overflow-hidden border border-slate-700/50 my-3">
                  <img
                    src="https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-22/61036997-7d1f-41c2-8c70-fed31e78df43.png"
                    alt="iPhone home screen with PIS UAE app icon"
                    className="w-full h-auto"
                    loading="lazy"
                  />
                  <div className="bg-slate-800/80 px-4 py-2.5 border-t border-slate-700/50">
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Info className="h-3 w-3 text-emerald-400" />
                      The app will appear on your home screen just like a native app
                    </p>
                  </div>
                </div>
                <p className="font-medium text-white mt-2">What you'll get:</p>
                <ul className="space-y-1.5 ml-1 mt-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    Full-screen experience without Safari's address bar
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    App appears in the iOS App Switcher
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    Cached pages for faster loading
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    Dedicated app icon on your home screen
                  </li>
                </ul>
                <InfoBox type="warning">
                  <strong>iOS limitations:</strong> Unlike Android, iOS PWAs do not support push notifications (prior to iOS 16.4), background sync, or Bluetooth access. On iOS 16.4+, push notifications are supported for added-to-home-screen PWAs.
                </InfoBox>
              </Step>
            </div>
          </div>

          {/* Divider before developer section */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">For Developers</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          </div>

          {/* Section B: TWA for Play Store */}
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <Store className="h-5 w-5 text-purple-400" />
              <h2 className="text-xl font-bold text-white">Part C: Publish to Google Play Store (TWA)</h2>
            </div>

            <div className="space-y-3">
              <Step number={1} title="Prerequisites & Requirements" icon={<Shield className="h-4 w-4 text-purple-400" />}>
                <p>Before generating a TWA package, ensure you have:</p>
                <ul className="space-y-1.5 ml-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>A <strong className="text-white">published website</strong> served over HTTPS</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>A valid <strong className="text-white">manifest.json</strong> with 192×192 and 512×512 icons</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>A registered <strong className="text-white">service worker</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>A <strong className="text-white">Google Play Developer account</strong> ($25 one-time fee)</span>
                  </li>
                </ul>
                <InfoBox type="info">
                  Your PWA manifest should look like this:
                </InfoBox>
                <CodeBlock code={MANIFEST_EXAMPLE} filename="public/manifest.json" />
              </Step>

              <Step number={2} title="Generate TWA Package with PWABuilder" icon={<Rocket className="h-4 w-4 text-purple-400" />}>
                <p>The easiest way to create a TWA is using <strong className="text-white">PWABuilder</strong>:</p>
                <ol className="list-decimal list-inside space-y-3 ml-1">
                  <li>
                    Visit{' '}
                    <a
                      href="https://www.pwabuilder.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline underline-offset-2 inline-flex items-center gap-1"
                    >
                      pwabuilder.com <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li>Enter your published website URL and click <strong className="text-white">"Start"</strong></li>
                  <li>PWABuilder will analyze your PWA and show a score report</li>
                  <li>Navigate to the <strong className="text-white">"Android"</strong> section</li>
                  <li>Click <strong className="text-white">"Generate Package"</strong> → choose <strong className="text-white">"Google Play"</strong></li>
                  <li>Configure your package settings:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-slate-400">
                      <li><strong className="text-slate-300">Package ID:</strong> com.yourdomain.app</li>
                      <li><strong className="text-slate-300">App name:</strong> PIS UAE</li>
                      <li><strong className="text-slate-300">Launcher name:</strong> PIS UAE</li>
                      <li><strong className="text-slate-300">App version:</strong> 1.0.0</li>
                      <li><strong className="text-slate-300">Status bar color:</strong> #0f172a</li>
                      <li><strong className="text-slate-300">Navigation bar color:</strong> #0f172a</li>
                    </ul>
                  </li>
                  <li>Click <strong className="text-white">"Download"</strong> to get the <code className="bg-slate-700 px-1.5 py-0.5 rounded text-xs">.aab</code> file</li>
                </ol>
                <InfoBox type="warning">
                  PWABuilder will also generate a signing key. <strong>Save it securely</strong> — you'll need it for future app updates.
                </InfoBox>
              </Step>

              <Step number={3} title="Configure Digital Asset Links" icon={<FileCode className="h-4 w-4 text-purple-400" />}>
                <p>
                  Digital Asset Links verify that your app and website belong to the same developer. Without this, Chrome will show the URL bar inside your TWA.
                </p>

                <p className="font-medium text-white mt-3">How to get your SHA-256 fingerprint:</p>
                <ol className="list-decimal list-inside space-y-2 ml-1">
                  <li>PWABuilder provides the fingerprint in the download package</li>
                  <li>Or run this command with your keystore:
                    <CodeBlock code={`keytool -list -v -keystore your-keystore.jks -alias your-alias`} />
                  </li>
                  <li>Copy the <strong className="text-white">SHA256</strong> fingerprint value</li>
                </ol>

                <p className="font-medium text-white mt-3">Create the assetlinks.json file:</p>
                <CodeBlock code={ASSET_LINKS_EXAMPLE} filename="public/.well-known/assetlinks.json" />

                <p className="mt-2">
                  Place this file at{' '}
                  <code className="bg-slate-700 px-1.5 py-0.5 rounded text-xs text-emerald-300">
                    public/.well-known/assetlinks.json
                  </code>{' '}
                  in your project, then redeploy.
                </p>

                <InfoBox type="success">
                  Verify it's accessible at:{' '}
                  <code className="text-emerald-200">{window.location.origin}/.well-known/assetlinks.json</code>
                </InfoBox>
              </Step>

              <Step number={4} title="Upload to Google Play Console" icon={<Store className="h-4 w-4 text-purple-400" />}>
                <ol className="list-decimal list-inside space-y-3 ml-1">
                  <li>
                    Go to{' '}
                    <a
                      href="https://play.google.com/console"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline underline-offset-2 inline-flex items-center gap-1"
                    >
                      Google Play Console <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li>Click <strong className="text-white">"Create app"</strong> and fill in the details:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-slate-400">
                      <li><strong className="text-slate-300">App name:</strong> PIS UAE</li>
                      <li><strong className="text-slate-300">Default language:</strong> English</li>
                      <li><strong className="text-slate-300">App or game:</strong> App</li>
                      <li><strong className="text-slate-300">Free or paid:</strong> Free</li>
                    </ul>
                  </li>
                  <li>Navigate to <strong className="text-white">Release → Production → Create new release</strong></li>
                  <li>Upload the <code className="bg-slate-700 px-1.5 py-0.5 rounded text-xs">.aab</code> file from PWABuilder</li>
                  <li>Complete the <strong className="text-white">Store listing</strong>:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-slate-400">
                      <li>Short description (80 chars max)</li>
                      <li>Full description (4000 chars max)</li>
                      <li>Screenshots (min 2, recommended 8)</li>
                      <li>Feature graphic (1024×500 px)</li>
                      <li>App icon (512×512 px)</li>
                    </ul>
                  </li>
                  <li>Complete the <strong className="text-white">Content rating</strong> questionnaire</li>
                  <li>Set up <strong className="text-white">Pricing & distribution</strong></li>
                  <li>Click <strong className="text-white">"Submit for review"</strong></li>
                </ol>
                <InfoBox type="info">
                  Review typically takes 1–7 days. You'll receive an email when your app is approved and live on the Play Store.
                </InfoBox>
              </Step>

              <Step number={5} title="Alternative: Bubblewrap CLI (Advanced)" icon={<FileCode className="h-4 w-4 text-purple-400" />}>
                <p>For more control, use Google's <strong className="text-white">Bubblewrap CLI</strong>:</p>
                <CodeBlock
                  code={`# Install Bubblewrap
npm install -g @anthropic/bubblewrap-cli

# Initialize TWA project
bubblewrap init --manifest="https://your-domain.com/manifest.json"

# Build the Android package
bubblewrap build

# Output: app-release-bundle.aab & app-release-signed.apk`}
                />
                <InfoBox type="warning">
                  Bubblewrap requires <strong>Java JDK 8+</strong> and <strong>Android SDK</strong> installed on your machine.
                </InfoBox>
              </Step>
            </div>
          </div>

          {/* Troubleshooting */}
          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Troubleshooting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-300">
              <div>
                <p className="font-medium text-white mb-1">URL bar showing in TWA?</p>
                <p>This means Digital Asset Links verification failed. Double-check that <code className="bg-slate-700 px-1 py-0.5 rounded text-xs">assetlinks.json</code> is accessible at the correct URL and the SHA-256 fingerprint matches your signing key.</p>
              </div>
              <div>
                <p className="font-medium text-white mb-1">Install prompt not appearing?</p>
                <p>Ensure your manifest.json has all required fields (name, icons, start_url, display), your service worker is registered, and you're serving over HTTPS. Try clearing Chrome cache.</p>
              </div>
              <div>
                <p className="font-medium text-white mb-1">App rejected on Play Store?</p>
                <p>Common reasons: missing privacy policy, incomplete store listing, or content policy violations. Ensure all required fields are filled and your app complies with Google Play policies.</p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-blue-500/20">
            <CardContent className="p-5">
              <h3 className="font-semibold text-white mb-3">Useful Resources</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { label: 'PWABuilder', url: 'https://www.pwabuilder.com' },
                  { label: 'Google Play Console', url: 'https://play.google.com/console' },
                  { label: 'Digital Asset Links Tool', url: 'https://developers.google.com/digital-asset-links/tools/generator' },
                  { label: 'Bubblewrap Documentation', url: 'https://github.com/nicolo-nicoli/nicolo-nicoli.github.io' },
                  { label: 'PWA Checklist', url: 'https://web.dev/pwa-checklist/' },
                  { label: 'Lighthouse PWA Audit', url: 'https://developer.chrome.com/docs/lighthouse/pwa/' },
                ].map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/30 hover:border-slate-600/50 text-sm text-slate-300 hover:text-white transition-all"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    {link.label}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}