// Vercel serverless function : /api/google-lead
// Reçoit les leads du formulaire natif Google Ads (webhook) et les pousse sur Telegram.
//
// Variables d'environnement à créer dans Vercel (Settings > Environment Variables) :
//   GOOGLE_ADS_KEY      -> la clé que tu saisis dans le formulaire Google Ads (champ "Clé")
//   TELEGRAM_BOT_TOKEN  -> token donné par @BotFather
//   TELEGRAM_CHAT_ID    -> ton chat ID (ou celui d'un groupe, commence par -100...)

const LABELS = {
  FULL_NAME: "Nom",
  FIRST_NAME: "Prénom",
  LAST_NAME: "Nom",
  PHONE_NUMBER: "Téléphone",
  EMAIL: "Email",
  POSTAL_CODE: "Code postal",
  CITY: "Ville",
  COMPANY_NAME: "Entreprise",
  JOB_TITLE: "Poste",
};

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const lead = req.body || {};

  // Sécurité : on rejette tout ce qui ne vient pas de ton formulaire
  if (lead.google_key !== process.env.GOOGLE_ADS_KEY) {
    return res.status(401).send("Invalid key");
  }

  const lines = (lead.user_column_data || []).map((f) => {
    const label = LABELS[f.column_id] || f.column_name || f.column_id;
    return `<b>${escapeHtml(label)}</b> : ${escapeHtml(f.string_value)}`;
  });

  const header = lead.is_test ? "🧪 <b>LEAD TEST Google Ads</b>" : "🔥 <b>Nouveau lead Google Ads</b>";
  const footer = `\n<i>Campagne ${escapeHtml(lead.campaign_id)} · Formulaire ${escapeHtml(lead.form_id)}</i>`;
  const text = [header, "", ...lines, footer].join("\n");

  try {
    const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: "HTML" }),
    });
    if (!r.ok) console.error("Telegram error", await r.text());
  } catch (e) {
    console.error("Telegram fetch failed", e);
  }

  // Google Ads attend un 200, sinon il considère la livraison en échec
  return res.status(200).json({});
}
