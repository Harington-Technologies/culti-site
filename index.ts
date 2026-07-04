import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL = "https://zuahstlswkprzdmflekg.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "Culti <bonjour@cultikids.com>";

function flagToISO(flag: string): string {
  if (!flag) return 'un';
  try {
    const codePoints = [...flag].map((c: string) => c.codePointAt(0) || 0);
    return codePoints.map((cp: number) => String.fromCharCode(cp - 127397)).join('').toLowerCase();
  } catch(e) { return 'un'; }
}

function flagImg(flag: string, size = 32): string {
  const iso = flagToISO(flag);
  const h = Math.round(size * 0.75);
  return `<img src="https://flagcdn.com/${size}x${h}/${iso}.png" alt="${flag}" style="width:${size}px;height:${h}px;object-fit:cover;border-radius:3px;vertical-align:middle;margin-right:6px;display:inline-block;">`;
}
const UNSPLASH_KEY = "FIpZxO53Giw_tuvyYxGbgUpNKuF8Fx0--2OK4-eS0Tc";

async function getUnsplashPhoto(query: string, fallbackQuery = "travel landscape"): Promise<string> {
  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`,
      { headers: { "Authorization": `Client-ID ${UNSPLASH_KEY}` } }
    );
    if (!res.ok) throw new Error("Unsplash error");
    const data = await res.json();
    return data.urls?.small || "";
  } catch(e) {
    try {
      const res2 = await fetch(
        `https://api.unsplash.com/photos/random?query=${encodeURIComponent(fallbackQuery)}&orientation=landscape`,
        { headers: { "Authorization": `Client-ID ${UNSPLASH_KEY}` } }
      );
      const data2 = await res2.json();
      return data2.urls?.regular || "";
    } catch(e2) {
      return "";
    }
  }
}
const SITE_URL = "https://cultikids.com";

const AUDIENCES = [
  {
    key: "enfant",
    label: "Enfant",
    prompt: `Tu écris pour des enfants de 6 à 12 ans. Utilise des phrases très courtes et simples. Pas de mots compliqués. Beaucoup d'emojis. Commence chaque explication par une comparaison avec quelque chose qu'un enfant connaît. Rends tout magique et amusant. Maximum 2 phrases par champ.`
  },
  {
    key: "ado",
    label: "Ado",
    prompt: `Tu écris pour des adolescents de 13 à 17 ans. Ton direct, moderne et sans condescendance. Utilise des références pop culture quand c'est pertinent. Phrases dynamiques, pas trop longues. Rends le contenu surprenant et cool. 2-3 phrases par champ.`
  },
  {
    key: "adulte",
    label: "Adulte",
    prompt: `Tu écris pour des adultes cultivés. Ton magazine, riche et précis. Anecdotes détaillées, contexte historique, nuances. Style GEO / National Geographic. 3-4 phrases par champ.`
  },
  {
    key: "senior",
    label: "Sénior",
    prompt: `Tu écris pour des personnes de 60 ans et plus. Langage clair et accessible, sans jargon moderne. Rythme posé. Références culturelles classiques (cinéma, littérature, histoire). Fond bienveillant et chaleureux. 2-3 phrases par champ bien construites.`
  }
];

async function generateForAudience(baseContent: any, audience: any): Promise<any> {
  const prompt = `${audience.prompt}

Voici le contenu de base d'une édition culturelle quotidienne (pays: ${baseContent.pays.nom}, personnalité: ${baseContent.personnalite.nom}).
Réécris UNIQUEMENT les champs texte pour les adapter à ce public. Garde exactement la même structure JSON, les mêmes faits, mais reformule tout le texte pour ce public.
Conserve les accents français. Guillemets doubles uniquement. Réponds UNIQUEMENT avec le JSON valide.

${JSON.stringify(baseContent, null, 2)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  let text = data.content[0].text.trim();
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`JSON introuvable pour ${audience.key}`);
  return JSON.parse(text.slice(start, end + 1));
}

async function generateBaseEdition(recentPays: string[] = []): Promise<any> {
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  const exclusions = recentPays.length > 0 
    ? `\nPAYS DÉJÀ UTILISÉS RÉCEMMENT (à éviter absolument) : ${recentPays.join(', ')}. Choisis un pays DIFFÉRENT.`
    : '';

  const prompt = `Génère une édition Culti en JSON valide. Date: ${today}. TOUT EN FRANÇAIS. JSON UNIQUEMENT.${exclusions}

{"date":"${today}","pays":{"flag":"🇯🇵","nom":"Pays","titre":"Titre 5 mots","intro":"1 phrase immersive.","contexte":"1 phrase historique.","capitale":"Tokyo","population":"125M","monnaie":"Yen","langue":"Japonais","salaire_moyen":"2500€/mois","rang_bonheur":"54/156","chef_etat":"Prénom Nom, Premier ministre","montagne":"Fuji, 3776m","fleuve_lac":"Shinano, 367km","paysage_unique":"Archipel volcanique","plat_national":"Ramen","fete_nationale":"11 février","actualite":"1 phrase actu récente.","mot_local":"Mot + signification","expression":"Expression + traduction","poeme":"Un court vers traduit","ecrivain":"Auteur","livre":"Titre","chiffre":"6852","chiffre_label":"îles","lecon":"1 leçon de vie.","photo_search":"japan landscape nature"},"personnalite":{"nom":"Nom","epoque":"dates","titre":"titre court","histoire":"1 phrase clé.","impact":"1 phrase impact.","lecon":"1 leçon."},"art":{"oeuvre":"Titre","artiste":"Artiste","annee":"1900","description":"1 phrase.","contexte":"1 phrase.","defi":"1 défi."},"musique":{"titre":"Titre","artiste":"Artiste","annee":"1975","anecdote":"1 phrase.","pourquoi_ecouter":"1 phrase.","lecon":"1 leçon.","youtube_search":"artiste titre"},"idee":{"mot":"Concept","langue":"Langue","definition":"1 phrase.","pourquoi":"1 phrase."},"vivant":{"animal":"Animal","fait1":"1 fait avec chiffre.","fait2":"1 fait surprenant.","lecon":"1 leçon."},"citation":{"texte":"Citation courte en français","auteur":"Auteur","traduction":"1 phrase moderne."},"enigme":{"question":"Énigme?","reponse":"Réponse"},"quiz":[{"question":"Q pays?","options":["A","B","C","D"],"correct":0},{"question":"Q personnalité?","options":["A","B","C","D"],"correct":1},{"question":"Q art?","options":["A","B","C","D"],"correct":2},{"question":"Q musique?","options":["A","B","C","D"],"correct":3},{"question":"Q vivant?","options":["A","B","C","D"],"correct":0}],"mission_reelle":{"emoji":"🌿","titre":"Mission du jour","action":"Une action concrète dans le monde réel liée au thème du jour. Ex: Observe un arbre, ferme le robinet, regarde le ciel 2 minutes. Max 2 phrases, simple et accessible à un enfant.","xp":15}}

Remplace TOUTES les valeurs. Textes courts. JSON uniquement.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  let text = data.content[0].text.trim();
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("JSON introuvable dans la réponse");
  const jsonStr = text.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch(e) {
    // Tentative de réparation du JSON tronqué
    console.error("JSON invalide, tentative de réparation...");
    const repaired = jsonStr
      .replace(/,\s*$/, '')           // virgule finale
      .replace(/,\s*\]/, ']')         // virgule avant ]
      .replace(/,\s*\}/, '}');        // virgule avant }
    try {
      return JSON.parse(repaired + ']}]}');
    } catch(e2) {
      throw new Error(`JSON invalide même après réparation: ${e}`);
    }
  }
}

function emailHtml(edition: any, subscriberEmail: string, audienceLabel: string, photos?: any): string {
  const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(edition.musique?.youtube_search || "")}`;
  const editionUrl = `${SITE_URL}/edition.html`;

  const section = (color: string, emoji: string, label: string, content: string) => `
    <tr><td style="padding:0 0 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #F0E8E0;">
        <tr><td style="background:${color};padding:12px 20px;">
          <span style="font-size:11px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;color:#ffffff;font-family:Arial,sans-serif;">${emoji} ${label}</span>
        </td></tr>
        <tr><td style="padding:20px 24px 24px;">
          ${content}
        </td></tr>
      </table>
    </td></tr>`;

  const infoGrid = (items: string[][]) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;">
      ${items.map(row => `<tr>${row.map(cell => `<td width="${Math.floor(100/row.length)}%" style="padding:6px 8px 6px 0;font-size:13px;color:#374151;font-family:Arial,sans-serif;vertical-align:top;">${cell}</td>`).join('')}</tr>`).join('')}
    </table>`;

  const infoTag = (label: string, value: string) => 
    `<table cellpadding="0" cellspacing="0" style="display:inline-table;margin:3px 4px 3px 0;">
      <tr><td style="background:#F5F0EB;border-radius:8px;padding:6px 12px;font-size:13px;font-family:Arial,sans-serif;white-space:nowrap;">
        <span style="font-weight:800;color:#1A1A2E;">${label}</span> <span style="color:#718096;">${value}</span>
      </td></tr>
    </table>`;

  const culturalBox = (label: string, value: string, sub?: string) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;">
      <tr><td style="background:#F9F6F2;border-radius:10px;padding:12px 16px;">
        <div style="font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#FF6B6B;font-family:Arial,sans-serif;margin-bottom:6px;">${label}</div>
        <div style="font-size:14px;color:#1A1A2E;font-family:Arial,sans-serif;font-weight:700;">${value}</div>
        ${sub ? `<div style="font-size:13px;color:#718096;font-family:Arial,sans-serif;margin-top:4px;font-style:italic;">${sub}</div>` : ''}
      </td></tr>
    </table>`;

  const titre = (t: string) => `<div style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1A1A2E;line-height:1.3;margin-bottom:10px;">${t}</div>`;
  const sous_titre = (t: string) => `<div style="font-size:12px;color:#999;font-family:Arial,sans-serif;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.08em;">${t}</div>`;
  const para = (t: string) => `<div style="font-size:15px;color:#374151;line-height:1.8;font-family:Arial,sans-serif;margin-bottom:10px;">${t}</div>`;
  const italic = (t: string) => `<div style="font-size:14px;color:#718096;line-height:1.7;font-family:Arial,sans-serif;font-style:italic;margin-bottom:10px;">${t}</div>`;
  const lecon = (t: string) => `<div style="border-left:4px solid #FF6B6B;padding:10px 16px;background:#FFF8F0;border-radius:0 8px 8px 0;font-size:14px;color:#1A1A2E;font-weight:700;font-style:italic;font-family:Arial,sans-serif;margin-top:12px;">${t}</div>`;
  const stat = (num: string, label: string) => `<div style="display:inline-block;background:#1A1A2E;border-radius:50px;padding:8px 20px;margin:10px 0;"><span style="font-size:22px;font-weight:900;color:#4ECDC4;font-family:Arial,sans-serif;">${num}</span><span style="font-size:12px;color:rgba(255,255,255,0.65);margin-left:10px;font-family:Arial,sans-serif;">${label}</span></div>`;
  const defi = (t: string) => `<div style="background:#E0F7F6;border-radius:10px;padding:12px 16px;font-size:13px;color:#0E7490;font-weight:700;font-family:Arial,sans-serif;margin-top:12px;">✦ ${t}</div>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Culti · ${edition.date}</title></head>
<body style="margin:0;padding:0;background:#F5F0EB;font-family:Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0EB;padding:24px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- HEADER -->
  <tr><td style="padding-bottom:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #F0E8E0;">
      <tr><td style="background:linear-gradient(135deg,#FF6B6B,#FF9F1C);padding:32px 32px 24px;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:52px;height:52px;background:rgba(255,255,255,0.25);border-radius:14px;text-align:center;vertical-align:middle;">
              <span style="font-size:30px;font-weight:900;color:white;font-family:Arial,sans-serif;">C</span>
            </td>
            <td style="padding-left:14px;vertical-align:middle;">
              <div style="font-size:26px;font-weight:900;color:white;font-family:Arial,sans-serif;letter-spacing:-0.02em;">culti</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.75);font-family:Arial,sans-serif;margin-top:2px;">Version ${audienceLabel}</div>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 32px 24px;">
        <div style="font-size:13px;color:#FF6B6B;font-weight:800;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">${edition.date}</div>
        <div style="font-size:18px;font-weight:900;color:#1A1A2E;font-family:Arial,sans-serif;margin-bottom:4px;">${flagImg(edition.pays?.flag || "", 28)} ${edition.pays?.nom} · ${edition.personnalite?.nom}</div>
        <div style="font-size:14px;color:#999;font-family:Arial,sans-serif;">+ ${edition.art?.oeuvre} · ${edition.idee?.mot} · Quiz</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- PAYS -->
  ${section('#2D6A4F', '🌍', 'Le monde · ' + edition.pays?.nom,
    (photos?.pays ? `<img src="${photos.pays}" alt="${edition.pays?.nom}" style="width:100%;height:180px;object-fit:cover;border-radius:12px;margin-bottom:12px;display:block;max-width:560px;" />` : '') +
    titre(edition.pays?.nom + ' — ' + edition.pays?.titre) +
    para(edition.pays?.intro || '') +
    (edition.pays?.contexte ? italic(edition.pays.contexte) : '') +
    '<div style="margin:14px 0 6px;">' +
    infoTag('🏛️ Capitale', edition.pays?.capitale || '?') +
    infoTag('👥 Population', edition.pays?.population || '?') +
    infoTag('💰 Monnaie', edition.pays?.monnaie || '?') +
    infoTag('🗣️ Langue', edition.pays?.langue || '?') +
    infoTag('💵 Salaire moyen', edition.pays?.salaire_moyen || '?') +
    infoTag('😊 Bonheur mondial', edition.pays?.rang_bonheur || '?') +
    infoTag('🏛️ Chef d\'État', edition.pays?.chef_etat || '?') +
    '</div><div style="margin:6px 0 14px;">' +
    (edition.pays?.montagne ? infoTag('⛰️ Montagne', edition.pays.montagne) : '') +
    (edition.pays?.fleuve_lac ? infoTag('🌊 Fleuve/Lac', edition.pays.fleuve_lac) : '') +
    (edition.pays?.paysage_unique ? infoTag('🌄 Paysage', edition.pays.paysage_unique) : '') +
    (edition.pays?.plat_national ? infoTag('🍽️ Plat national', edition.pays.plat_national) : '') +
    (edition.pays?.fete_nationale ? infoTag('🎉 Fête nationale', edition.pays.fete_nationale) : '') +
    '</div>' +
    (edition.pays?.actualite ? '<div style="background:#EFF6FF;border-radius:10px;padding:12px 16px;margin:10px 0;font-size:13px;color:#1D4ED8;font-family:Arial,sans-serif;"><span style="font-weight:800;">📰 Actu :</span> ' + edition.pays.actualite + '</div>' : '') +
    culturalBox('📝 Mot local', edition.pays?.mot_local || '') +
    culturalBox('💬 Expression', edition.pays?.expression || '') +
    culturalBox('✍️ Vers de poème', edition.pays?.poeme || '') +
    culturalBox('📚 Écrivain', edition.pays?.ecrivain || '', edition.pays?.livre || '') +
    stat(edition.pays?.chiffre || '', edition.pays?.chiffre_label || '') +
    lecon(edition.pays?.lecon || '')
  )}

  <!-- PERSONNALITÉ -->
  ${section('#1D4E8F', '👤', 'Destin extraordinaire',
    titre(edition.personnalite?.nom || '') +
    sous_titre((edition.personnalite?.epoque || '') + ' · ' + (edition.personnalite?.titre || '')) +
    para(edition.personnalite?.histoire || '') +
    (edition.personnalite?.impact ? para(edition.personnalite.impact) : '') +
    lecon(edition.personnalite?.lecon || '')
  )}

  <!-- ART -->
  ${section('#6B3FA0', '🎨', 'Art · ' + (edition.art?.artiste || ''),
    titre(edition.art?.oeuvre + ' (' + edition.art?.annee + ')') +
    (photos?.art ? `<img src="${photos.art}" alt="${edition.art?.oeuvre}" style="width:100%;height:160px;object-fit:cover;border-radius:12px;margin-bottom:12px;display:block;max-width:560px;" />` : '') +
    para(edition.art?.description || '') +
    (edition.art?.contexte ? italic(edition.art.contexte) : '') +
    defi(edition.art?.defi || '')
  )}

  <!-- MUSIQUE -->
  ${section('#B45309', '🎵', 'Musique · ' + (edition.musique?.artiste || ''),
    titre(edition.musique?.titre + ' (' + edition.musique?.annee + ')') +
    (photos?.musique ? `<img src="${photos.musique}" alt="${edition.musique?.artiste}" style="width:100%;height:140px;object-fit:cover;border-radius:12px;margin-bottom:12px;display:block;max-width:560px;" />` : '') +
    para(edition.musique?.anecdote || '') +
    (edition.musique?.pourquoi_ecouter ? italic(edition.musique.pourquoi_ecouter) : '') +
    lecon(edition.musique?.lecon || '') +
    `<div style="margin-top:16px;"><a href="${ytUrl}" style="display:inline-block;background:#FF0000;color:white;text-decoration:none;padding:10px 20px;border-radius:50px;font-size:13px;font-weight:800;font-family:Arial,sans-serif;">▶ Écouter sur YouTube</a></div>`
  )}

  <!-- IDÉE -->
  <tr><td style="padding:0 0 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1A2E;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:24px 28px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;color:#4ECDC4;font-family:Arial,sans-serif;margin-bottom:12px;">🧠 Idée du jour · ${edition.idee?.langue}</div>
        <div style="font-family:Georgia,serif;font-size:32px;font-weight:700;color:#ffffff;margin-bottom:12px;">${edition.idee?.mot}</div>
        <div style="font-size:15px;color:rgba(255,255,255,0.75);line-height:1.8;font-family:Arial,sans-serif;margin-bottom:10px;">${edition.idee?.definition}</div>
        <div style="font-size:13px;color:#4ECDC4;font-style:italic;font-family:Arial,sans-serif;">${edition.idee?.pourquoi}</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- VIVANT -->
  ${section('#2D6A4F', '🦁', 'Le vivant · ' + (edition.vivant?.animal || ''),
    (photos?.vivant ? `<img src="${photos.vivant}" alt="${edition.vivant?.animal}" style="width:100%;height:160px;object-fit:cover;border-radius:12px;margin-bottom:12px;display:block;max-width:560px;" />` : '') +
    para(edition.vivant?.fait1 || '') +
    para(edition.vivant?.fait2 || '') +
    lecon(edition.vivant?.lecon || '')
  )}

  <!-- CITATION -->
  <tr><td style="padding:0 0 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8F0;border-radius:16px;overflow:hidden;border:2px solid #FFE5D0;">
      <tr><td style="padding:28px 32px;text-align:center;">
        <div style="font-size:52px;color:#FF6B6B;line-height:0.8;margin-bottom:16px;font-family:Georgia,serif;">"</div>
        <div style="font-family:Georgia,serif;font-size:20px;font-style:italic;color:#1A1A2E;line-height:1.6;margin-bottom:14px;">${edition.citation?.texte}</div>
        <div style="font-size:13px;font-weight:800;color:#FF6B6B;font-family:Arial,sans-serif;margin-bottom:8px;">— ${edition.citation?.auteur}</div>
        <div style="font-size:13px;color:#718096;font-style:italic;font-family:Arial,sans-serif;">${edition.citation?.traduction}</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- QUIZ -->
  <tr><td style="padding:0 0 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #F0E8E0;">
      <tr><td style="background:#FF6B6B;padding:14px 24px;">
        <span style="font-size:14px;font-weight:900;color:white;font-family:Arial,sans-serif;">🎯 Quiz du jour — testez vos connaissances</span>
      </td></tr>
      <tr><td style="padding:20px 24px;">
        ${(edition.quiz || []).slice(0,3).map((q: any, i: number) => 
          `<div style="padding:10px 0;border-bottom:1px solid #F5F0EB;font-size:14px;color:#374151;font-family:Arial,sans-serif;">${i+1}. ${q.question}</div>`
        ).join('')}
        <div style="margin-top:16px;text-align:center;">
          <a href="${editionUrl}" style="display:inline-block;background:#FF6B6B;color:white;text-decoration:none;padding:12px 28px;border-radius:50px;font-size:14px;font-weight:800;font-family:Arial,sans-serif;">Jouer et gagner des points →</a>
        </div>
      </td></tr>
    </table>
  </td></tr>

  <!-- ÉNIGME -->
  <tr><td style="padding:0 0 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFE66D;border-radius:16px;">
      <tr><td style="padding:24px 28px;text-align:center;">
        <div style="font-size:36px;margin-bottom:10px;">🧩</div>
        <div style="font-size:11px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;color:#B45309;font-family:Arial,sans-serif;margin-bottom:10px;">Énigme du jour</div>
        <div style="font-family:Georgia,serif;font-size:17px;font-style:italic;color:#1A1A2E;line-height:1.6;">${edition.enigme?.question}</div>
        <div style="font-size:12px;color:#B45309;font-family:Arial,sans-serif;margin-top:10px;">Réponse dans la prochaine édition !</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1A2E;border-radius:16px;">
      <tr><td style="padding:24px 28px;text-align:center;">
        <table cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
          <tr>
            <td style="width:36px;height:36px;background:#FF6B6B;border-radius:10px;text-align:center;vertical-align:middle;">
              <span style="font-size:20px;font-weight:900;color:white;font-family:Arial,sans-serif;">C</span>
            </td>
            <td style="padding-left:10px;vertical-align:middle;">
              <span style="font-size:20px;font-weight:900;color:white;font-family:Arial,sans-serif;">culti</span>
            </td>
          </tr>
        </table>
        <div style="font-size:12px;color:rgba(255,255,255,0.4);line-height:1.8;font-family:Arial,sans-serif;">
          Vous recevez cet email (version ${audienceLabel}) car vous êtes abonné à Culti.<br>
          <a href="${SITE_URL}/unsubscribe.html?email=${encodeURIComponent(subscriberEmail)}" style="color:#FF6B6B;text-decoration:none;font-weight:800;">Se désabonner</a>
          &nbsp;·&nbsp;
          <a href="${SITE_URL}" style="color:#FF6B6B;text-decoration:none;font-weight:800;">Voir le site</a>
        </div>
      </td></tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}



serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Vérifier si une édition existe déjà aujourd'hui
    const todayStr = new Date().toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
    const { data: existingToday } = await supabase
      .from("editions")
      .select("id")
      .eq("audience", "adulte")
      .eq("date", todayStr)
      .limit(1);

    if (existingToday && existingToday.length > 0) {
      console.log("Édition déjà générée aujourd'hui — arrêt.");
      return new Response(JSON.stringify({ message: "Édition déjà générée aujourd'hui", date: todayStr }), { status: 200 });
    }

    // Récupérer les 30 derniers pays utilisés pour éviter les répétitions
    const { data: recentEditions } = await supabase
      .from("editions")
      .select("pays_nom")
      .eq("audience", "adulte")
      .order("created_at", { ascending: false })
      .limit(30);
    
    const recentPays = [...new Set((recentEditions || []).map((e: any) => e.pays_nom).filter(Boolean))];
    console.log("Pays récents à éviter:", recentPays.join(', '));

    console.log("Génération de l'édition de base...");
    const baseEdition = await generateBaseEdition(recentPays);
    console.log("Base générée:", baseEdition.date, "-", baseEdition.pays?.nom);

    // Adapter les 4 versions côté JS sans appels API supplémentaires
    // Récupérer photos Unsplash
    console.log("Récupération des photos Unsplash...");
    const paysNom = baseEdition.pays?.nom || "landscape";
    const photoSearch = baseEdition.pays?.photo_search || paysNom;
    const [photoPays, photoArt, photoMusique, photoVivant] = await Promise.all([
      getUnsplashPhoto(photoSearch, "travel landscape"),
      getUnsplashPhoto(baseEdition.art?.oeuvre + " " + baseEdition.art?.artiste, "art painting museum"),
      getUnsplashPhoto(baseEdition.musique?.artiste + " music", "music concert"),
      getUnsplashPhoto(baseEdition.vivant?.animal, "animal nature wildlife"),
    ]);
    baseEdition._photos = { pays: photoPays, art: photoArt, musique: photoMusique, vivant: photoVivant };
    console.log("Photos récupérées:", photoPays ? "✓" : "✗", photoArt ? "✓" : "✗");

    console.log("Adaptation des 4 versions...");
    
    function adaptForAudience(base: any, audienceKey: string): any {
      const ed = JSON.parse(JSON.stringify(base));
      ed.audience = audienceKey;
      if (audienceKey === "enfant") {
        ed.pays.intro = "🌟 " + base.pays.nom + " est un pays fascinant ! " + (base.pays.intro || "").substring(0, 120);
        ed.pays.lecon = "Ce qu'on apprend : " + base.pays.lecon;
        ed.personnalite.histoire = (base.personnalite.histoire || "").substring(0, 150) + " Incroyable !";
        ed.idee.definition = (base.idee.definition || "").substring(0, 180);
        ed.vivant.fait1 = (base.vivant.fait1 || "").substring(0, 150);
      } else if (audienceKey === "ado") {
        ed.pays.intro = (base.pays.intro || "").substring(0, 200) + " Franchement impressionnant.";
        ed.personnalite.histoire = (base.personnalite.histoire || "").substring(0, 220);
      } else if (audienceKey === "senior") {
        // Même contenu adulte mais flag différent
        ed.pays.intro = base.pays.intro;
      }
      return ed;
    }

    const versions = AUDIENCES.map(audience => ({
      audience,
      content: adaptForAudience(baseEdition, audience.key)
    }));

    // Sauvegarder les 4 versions en base
    for (const { audience, content } of versions) {
      await supabase.from("editions").insert({
        date: baseEdition.date,
        pays_nom: baseEdition.pays?.nom,
        pays_flag: baseEdition.pays?.flag,
        personnalite_nom: baseEdition.personnalite?.nom,
        contenu: content,
        audience: audience.key,
      });
    }
    console.log("4 versions sauvegardées");

    // Envoyer les emails aux abonnés
    const { data: subscribers, error } = await supabase
      .from("subscribers")
      .select("email")
      .eq("active", true);

    if (error) throw new Error(error.message);
    if (!subscribers || subscribers.length === 0) {
      return new Response(JSON.stringify({ message: "Aucun abonné", pays: baseEdition.pays?.nom }), { status: 200 });
    }

    // Envoyer la version adulte par défaut
    const adulteVersion = versions.find(v => v.audience.key === "adulte")?.content || baseEdition;
    let sent = 0, failed = 0;

    // MODE TEST — envoi uniquement à l'adresse de test
    const TEST_MODE = false;
    const TEST_EMAIL = "wessafi@harington.fr";
    const sendList = TEST_MODE ? [{ email: TEST_EMAIL }] : subscribers;

    for (const sub of sendList) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [sub.email],
          subject: `${TEST_MODE ? "[TEST] " : ""}Culti · ${baseEdition.date} — ${baseEdition.pays?.flag} ${baseEdition.pays?.nom}, ${baseEdition.personnalite?.nom}`,
          html: emailHtml(adulteVersion, sub.email, "Adulte", baseEdition._photos),
        }),
      });
      if (res.ok) sent++; else { failed++; console.error("Resend:", await res.text()); }
      await new Promise(r => setTimeout(r, 100));
    }

    return new Response(JSON.stringify({ success: true, sent, failed, pays: baseEdition.pays?.nom, versions: versions.map(v => v.audience.key) }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Erreur:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
