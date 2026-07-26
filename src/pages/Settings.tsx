import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";

export function Settings() {
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await base44.auth.me();
      const existing = await base44.entities.Merchant.filter({ created_by: user.email });
      if (existing?.[0]) {
        setMerchant(existing[0]);
      } else {
        const created = await base44.entities.Merchant.create({
          business_name: "My Store",
          notification_email: user.email,
        });
        setMerchant(created);
      }
      setLoading(false);
    })();
  }, []);

  function update(field: string, value: unknown) {
    setMerchant((m: any) => ({ ...m, [field]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    await base44.entities.Merchant.update(merchant.id, {
      business_name: merchant.business_name,
      notification_email: merchant.notification_email,
      auto_draft_enabled: merchant.auto_draft_enabled,
      require_approval_before_submit: merchant.require_approval_before_submit,
      risk_alert_threshold: merchant.risk_alert_threshold,
      reminder_cadence_hours: merchant.reminder_cadence_hours,
    });
    setSaving(false);
    setSaved(true);
  }

  if (loading) return <p style={{ color: "var(--text-dim)" }}>Loading…</p>;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      <motion.div variants={itemVariants} className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Merchant profile, notification email, and automation policy.</p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="card" style={{ maxWidth: 480 }}>
        <div className="field-row">
          <label>Business name</label>
          <input value={merchant.business_name ?? ""} onChange={(e) => update("business_name", e.target.value)} />
        </div>
        <div className="field-row">
          <label>Notification email</label>
          <input
            type="email"
            value={merchant.notification_email ?? ""}
            onChange={(e) => update("notification_email", e.target.value)}
          />
        </div>
        <div className="field-row">
          <label>Risk alert threshold (0–100)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={merchant.risk_alert_threshold ?? 60}
            onChange={(e) => update("risk_alert_threshold", Number(e.target.value))}
          />
        </div>
        <div className="field-row">
          <label>Reminder cadence (hours between checks)</label>
          <input
            type="number"
            min={1}
            value={merchant.reminder_cadence_hours ?? 24}
            onChange={(e) => update("reminder_cadence_hours", Number(e.target.value))}
          />
        </div>
        <div className="field-row" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={!!merchant.auto_draft_enabled}
            onChange={(e) => update("auto_draft_enabled", e.target.checked)}
            style={{ width: "auto" }}
          />
          <label style={{ margin: 0 }}>Auto-draft evidence as soon as a dispute arrives</label>
        </div>
        <div className="field-row" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={!!merchant.require_approval_before_submit}
            onChange={(e) => update("require_approval_before_submit", e.target.checked)}
            style={{ width: "auto" }}
          />
          <label style={{ margin: 0 }}>Require manual approval before submitting to Stripe</label>
        </div>

        <button className="btn" onClick={save} disabled={saving} style={{ marginTop: 12 }}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
        </button>
      </motion.div>
    </motion.div>
  );
}
