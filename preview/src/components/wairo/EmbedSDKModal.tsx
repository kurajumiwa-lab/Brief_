import React, { useState } from 'react';
import { X, Code2, Copy, Check, Terminal, Globe, Layers, Sparkles } from 'lucide-react';
import { playSound } from './wairoAudio';

interface EmbedSDKModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmbedSDKModal: React.FC<EmbedSDKModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'react' | 'script' | 'iframe' | 'webcomponent'>('react');
  const [copied, setCopied] = useState(false);
  const [widgetPosition, setWidgetPosition] = useState('right-edge');
  const [accentColor, setAccentColor] = useState('#F58220');

  if (!isOpen) return null;

  const getEmbedCode = () => {
    switch (activeTab) {
      case 'react':
        return `// 1. Install Wairo Kenyan Logistics & Errands SDK
npm install @wairo/kenya-logistics-sdk

// 2. Import & Mount in your WebApp
import { WairoLogisticsProvider, WairoDeliveryCompanion } from '@wairo/kenya-logistics-sdk';
import '@wairo/kenya-logistics-sdk/dist/style.css';

export default function MyKenyanMarketplace() {
  return (
    <WairoLogisticsProvider 
      apiKey="wro_live_ke_nairobi_9942"
      defaultLocation="langata"
      currency="KES"
      payoutModel={{
        driverSharePercent: 90, // 90% payout via M-Pesa B2C
        settlementMethod: "mpesa_instant"
      }}
      theme={{
        accentColor: "${accentColor}",
        background: "#0B1B2A",
        dockPosition: "${widgetPosition}" // minimal right-edge note tab
      }}
    >
      <StoreCheckout onOrderCreated={(order) => {
        // Automatically dispatches private reverse-auction for courier / consolidated shipping
      }} />
      <WairoDeliveryCompanion mode="right-edge-drawer" />
    </WairoLogisticsProvider>
  );
}`;

      case 'script':
        return `<!-- Embed Wairo Kenya Courier & Errands Widget into any web page -->
<script 
  src="https://cdn.wairo.tech/sdk/v2.5/wairo-kenya-logistics.min.js" 
  data-wairo-api-key="wro_live_ke_nairobi_9942"
  data-position="right-edge"
  data-accent="${accentColor}"
  data-default-dropzone="langata"
  data-currency="KES"
  async>
</script>

<!-- Open the Wairo Courier & Errands Mini App on demand -->
<button onclick="window.WairoSDK.open({ service: 'courier', destination: 'langata' })">
  Dispatch Courier (90% Driver Return)
</button>`;

      case 'iframe':
        return `<!-- Standard iframe embed for logistics dashboards or checkout portals -->
<iframe 
  src="https://app.wairo.tech/kenya/embed?location=langata&accent=${encodeURIComponent(accentColor)}&services=courier,consolidated,errands"
  width="412" 
  height="780" 
  frameborder="0"
  allow="geolocation"
  style="border-radius: 36px; box-shadow: 0 20px 40px rgba(11, 27, 42, 0.4); border: 1px solid #173247;"
  title="Wairo Kenyan Logistics Mini App">
</iframe>`;

      case 'webcomponent':
        return `<!-- Web Component Micro-Frontend -->
<script type="module" src="https://cdn.wairo.tech/elements/wairo-kenya.js"></script>

<wairo-kenya-logistics
  api-key="wro_live_ke_nairobi_9942"
  active-corridor="langata"
  driver-payout="90"
  palette-primary="#0B1B2A"
  palette-accent="${accentColor}"
  palette-cyan="#00BFEF"
  display-mode="right-edge-tab">
</wairo-kenya-logistics>`;

      default:
        return '';
    }
  };

  const handleCopy = () => {
    playSound('click');
    navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-3xl bg-[#0B1B2A] border border-[#173247] rounded-3xl overflow-hidden shadow-2xl flex flex-col text-white">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#173247] flex items-center justify-between bg-gradient-to-r from-[#0B1B2A] via-[#173247] to-[#0B1B2A]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#00BFEF]/20 border border-[#00BFEF]/40 flex items-center justify-center text-[#00BFEF]">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base sm:text-lg text-white">Wairo Kenya Logistics & Errands SDK</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00BFEF]/20 text-[#00BFEF] border border-[#00BFEF]/40 font-bold">
                  v2.5.0 KE
                </span>
              </div>
              <p className="text-xs text-[#DCE2E6]/70">Courier, Consolidated Cargo, Errands & 90% Provider Returns</p>
            </div>
          </div>
          <button
            onClick={() => {
              playSound('click');
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Integration type tabs */}
        <div className="flex border-b border-[#173247] bg-[#07111a] px-4 pt-2 overflow-x-auto">
          {[
            { id: 'react', label: 'React / Next.js', icon: Layers },
            { id: 'script', label: 'Vanilla JS / CDN Script', icon: Globe },
            { id: 'iframe', label: 'iFrame Embed', icon: Terminal },
            { id: 'webcomponent', label: 'Web Component', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  playSound('click');
                  setActiveTab(tab.id as any);
                }}
                className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-[#00BFEF] text-[#00BFEF] bg-[#00BFEF]/10'
                    : 'border-transparent text-[#DCE2E6]/60 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Code Snippet Box */}
        <div className="p-5 overflow-y-auto max-h-[50vh]">
          <div className="relative rounded-2xl bg-[#061019] border border-[#173247] p-4 font-mono text-xs text-[#DCE2E6]">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-[11px] text-[#00BFEF]">
              <span className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#00BFEF] animate-pulse"></span>
                <span>INTEGRATION SNIPPET (KENYAN LOGISTICS)</span>
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-[#00BFEF]/20 hover:bg-[#00BFEF]/30 text-[#00BFEF] border border-[#00BFEF]/40 transition-all font-bold cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'COPIED TO CLIPBOARD' : 'COPY CODE'}</span>
              </button>
            </div>

            <pre className="overflow-x-auto whitespace-pre leading-relaxed text-gray-200">
              <code>{getEmbedCode()}</code>
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#07111a] border-t border-[#173247] flex items-center justify-between">
          <span className="text-xs text-[#DCE2E6]/60">Supports M-Pesa B2C automated disbursements and reverse-auction webhooks.</span>
          <button
            onClick={() => {
              playSound('click');
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
