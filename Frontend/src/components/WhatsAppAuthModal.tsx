import React, { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'lucide-react';
import { useWhatsAppConnection } from '../context/WhatsAppConnectionContext';

const styles = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999
  },

  modal: {
    width: 900,
    minHeight: 460,
    background: "#fff",
    borderRadius: 14,
    display: "flex",
    padding: 50,
    boxShadow: "0 30px 80px rgba(0,0,0,0.35)"
  },

  leftSection: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    paddingRight: 60
  },

  heading: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 25,
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#111827"
  },

  title: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 30
  },

  steps: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 14
  },

  step: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    fontSize: 16
  },

  number: {
    width: 28,
    height: 28,
    borderRadius: 20,
    background: "#e9edef",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600
  },

  help: {
    marginTop: 30,
    fontSize: 14
  },

  link: {
    color: "#008069",
    textDecoration: "none"
  },

  qrSection: {
    width: 380,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderLeft: "1px solid #eee",
    paddingLeft: 50
  },

  loading: {
    fontSize: 15,
    color: "#666"
  }
};

export const WhatsAppAuthModal: React.FC = () => {
  const { state } = useWhatsAppConnection();
  const { qrRequired, qrCode, loading, error } = state;

  useEffect(() => {
    if (qrRequired) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [qrRequired]);

  if (!qrRequired) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* LEFT SIDE */}
        <div style={styles.leftSection}>
          <div style={styles.heading}>
            <span>JJE - LeadOps</span>
            <Link size={16} style={{ color: "#00a884" }} />
            <span>Whatsapp Web</span>
          </div>
          
          <h2 style={styles.title}>Scan to log in</h2>
          
          <div style={styles.steps}>
            <div style={styles.step}>
              <span style={styles.number}>1</span>
              <span>Open WhatsApp on your phone</span>
            </div>

            <div style={styles.step}>
              <span style={styles.number}>2</span>
              <span>Tap <b>Linked Devices</b></span>
            </div>

            <div style={styles.step}>
              <span style={styles.number}>3</span>
              <span>Scan this QR code</span>
            </div>
          </div>

          <div style={styles.help}>
            <a
              href="https://faq.whatsapp.com/"
              target="_blank"
              rel="noreferrer"
              style={styles.link}
            >
              Need help?
            </a>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div style={styles.qrSection}>
          {loading && (
            <div style={styles.loading}>
              Generating QR code...
            </div>
          )}

          {error && (
            <div style={styles.loading}>
              Failed to generate QR code...
            </div>
          )}

          {!loading && !error && qrCode && (
            <QRCodeSVG
              value={qrCode}
              size={280}
              bgColor="#ffffff"
              fgColor="#111"
            />
          )}
        </div>
      </div>
    </div>
  );
};
