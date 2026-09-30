import { OFFER, PAY_LANGS, PAY_STRINGS, type PayKey, type PayLang } from "./i18n";
import { merchantInfo, type Plan, type ProviderId } from "./config";

/** Languages without their own offer text borrow the closest one. */
const OFFER_FALLBACK: Record<PayLang, PayLang> = {
  uz: "uz",
  "uz-kril": "uz-kril",
  ru: "ru",
  en: "en",
  kk: "ru",
  ky: "ru",
  tg: "ru",
  tk: "ru",
  tr: "en",
  fa: "en",
};

const LANG_NAMES: Record<PayLang, string> = {
  uz: "O'zbekcha",
  "uz-kril": "Ўзбекча",
  ru: "Русский",
  en: "English",
  kk: "Қазақша",
  ky: "Кыргызча",
  tg: "Тоҷикӣ",
  tk: "Türkmençe",
  tr: "Türkçe",
  fa: "فارسی",
};

/** BCP-47 tags for dates in the browser; Persian keeps the Gregorian calendar. */
const DATE_LOCALE: Record<PayLang, string> = {
  uz: "uz-Latn",
  "uz-kril": "uz-Cyrl",
  ru: "ru",
  en: "en-GB",
  kk: "kk",
  ky: "ky",
  tg: "tg",
  tk: "tk",
  tr: "tr",
  fa: "fa-IR-u-ca-gregory-nu-latn",
};

export function isPayLang(v: unknown): v is PayLang {
  return typeof v === "string" && (PAY_LANGS as readonly string[]).includes(v);
}

/** ?lang= first, then the saved cookie, then the browser's Accept-Language. */
export function pickLang(query: unknown, cookie: string | undefined, accept: string | undefined): PayLang {
  if (isPayLang(query)) return query;
  const saved = /(?:^|;\s*)pay_lang=([^;]+)/.exec(cookie ?? "")?.[1];
  if (isPayLang(saved)) return saved;
  for (const part of (accept ?? "").split(",")) {
    const tag = part.split(";")[0]!.trim().toLowerCase();
    if (tag.startsWith("uz-cyrl")) return "uz-kril";
    const base = tag.split("-")[0]!;
    if (isPayLang(base)) return base;
  }
  return "uz";
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function formatSum(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function t(lang: PayLang, key: PayKey, ...args: Array<string | number>): string {
  return PAY_STRINGS[lang][key].replace(/\{(\d+)\}/g, (_m, i) => String(args[Number(i)] ?? ""));
}

const PROVIDERS: Record<ProviderId, { name: string; color: string }> = {
  click: { name: "Click", color: "#0CA5E9" },
  payme: { name: "Payme", color: "#33CCCC" },
  uzum: { name: "Uzum Bank", color: "#7B2FF7" },
  card: { name: "Visa / Mastercard", color: "#1A1F71" },
};

const CSS = `
:root{--bg:#F5F7F2;--card:#fff;--text:#1B2616;--muted:#63705E;--line:#E2E8DC;--primary:#2C5F1A;--primary-2:#4E9F35;--soft:#EAF3E4;--danger:#C62828;--danger-soft:#FDECEC}
@media (prefers-color-scheme:dark){:root{--bg:#0F140D;--card:#182115;--text:#EEF3EA;--muted:#A3B09C;--line:#2A3625;--primary:#4E9F35;--primary-2:#6CC24F;--soft:#1F2D1A;--danger:#FF8A80;--danger-soft:#3A1D1D}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif}
a{color:var(--primary-2)}
.wrap{max-width:560px;margin:0 auto;padding:16px 16px 40px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.3px;text-decoration:none;color:var(--text)}
.logo{width:36px;height:36px;border-radius:10px;background:var(--primary);color:#fff;display:grid;place-items:center;font-size:14px}
select{font:inherit;font-size:14px;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--text);max-width:48vw}
h1{font-size:26px;line-height:1.2;margin:0 0 8px}
h2{font-size:15px;margin:24px 0 10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px}
.lead{color:var(--muted);margin:0 0 14px}
.benefits{list-style:none;padding:0;margin:0 0 8px;display:grid;gap:8px}
.benefits li{display:flex;gap:10px;align-items:center}
.benefits li:before{content:"✓";width:22px;height:22px;flex:none;border-radius:50%;background:var(--soft);color:var(--primary-2);display:grid;place-items:center;font-size:13px;font-weight:800}
.opts{display:grid;gap:10px}
.opt{position:relative;display:flex;align-items:center;gap:12px;padding:14px 16px;border:1.5px solid var(--line);border-radius:14px;background:var(--card);cursor:pointer}
.opt input{position:absolute;opacity:0;pointer-events:none}
.opt:has(input:checked){border-color:var(--primary-2);box-shadow:0 0 0 3px var(--soft)}
.opt:has(input:focus-visible){outline:2px solid var(--primary-2);outline-offset:2px}
.opt .grow{flex:1;min-width:0}
.opt .title{font-weight:700}
.opt .sub{color:var(--muted);font-size:13px}
.price{font-weight:800;font-size:18px;white-space:nowrap}
.dot{width:14px;height:14px;border-radius:50%;flex:none}
.field{margin-top:10px}
.field input{width:100%;font:inherit;padding:12px 14px;border-radius:12px;border:1.5px solid var(--line);background:var(--card);color:var(--text);text-transform:uppercase}
.hidden{display:none!important}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:54px;margin-top:22px;border:0;border-radius:27px;background:var(--primary);color:#fff;font:inherit;font-weight:700;font-size:17px;cursor:pointer;text-decoration:none;padding:0 20px;text-align:center}
.btn:disabled{opacity:.6;cursor:default}
.btn.secondary{background:var(--soft);color:var(--text)}
.note{color:var(--muted);font-size:13px;margin:12px 0 0;text-align:center}
.err{background:var(--danger-soft);color:var(--danger);border-radius:12px;padding:10px 14px;margin-top:14px;font-size:14px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px}
.center{text-align:center}
.big{font-size:44px;line-height:1;margin:6px 0 10px}
.cred{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-top:10px}
.cred .k{color:var(--muted);font-size:12px}
.cred .v{font:700 20px/1.3 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:1px;direction:ltr;unicode-bidi:embed}
.cred button{margin-inline-start:auto;font:inherit;font-size:13px;padding:8px 12px;border-radius:10px;border:1px solid var(--line);background:var(--soft);color:var(--text);cursor:pointer}
.spinner{width:36px;height:36px;border-radius:50%;border:4px solid var(--soft);border-top-color:var(--primary-2);animation:spin 1s linear infinite;margin:6px auto 12px}
@keyframes spin{to{transform:rotate(360deg)}}
.stores{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:14px}
.stores a{font-size:14px}
footer{margin-top:36px;color:var(--muted);font-size:13px;display:grid;gap:6px;text-align:center}
footer nav{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.offer h3{font-size:16px;margin:22px 0 6px}
.offer p{margin:0;color:var(--text)}
`;

function shell(opts: {
  lang: PayLang;
  title: string;
  nonce: string;
  body: string;
  script?: string;
  langSwitchPath: string;
}): string {
  const { lang } = opts;
  const dir = lang === "fa" ? "rtl" : "ltr";
  const htmlLang = lang === "uz-kril" ? "uz-Cyrl" : lang;
  const options = PAY_LANGS.map(
    (l) => `<option value="${l}"${l === lang ? " selected" : ""}>${esc(LANG_NAMES[l])}</option>`,
  ).join("");
  const m = merchantInfo();
  return `<!doctype html>
<html lang="${htmlLang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="light dark">
<title>${esc(opts.title)}</title>
<style nonce="${opts.nonce}">${CSS}</style>
</head>
<body>
<div class="wrap">
<header>
  <a class="brand" href="/pay?lang=${lang}"><span class="logo">UD</span><span>UzDieta AI</span></a>
  <form method="get" action="${esc(opts.langSwitchPath)}" id="langForm">
    <label class="hidden" for="langSel">${esc(t(lang, "language"))}</label>
    <select id="langSel" name="lang" aria-label="${esc(t(lang, "language"))}">${options}</select>
    <noscript><button type="submit">OK</button></noscript>
  </form>
</header>
${opts.body}
<footer>
  <nav>
    <a href="/pay/offer?lang=${lang}">${esc(t(lang, "offer"))}</a>
    <a href="/privacy">${esc(t(lang, "privacy"))}</a>
    ${m.telegram ? `<a href="https://t.me/${esc(m.telegram.replace(/^@/, ""))}" rel="noopener">Telegram</a>` : ""}
    ${m.email ? `<a href="mailto:${esc(m.email)}">${esc(t(lang, "contacts"))}</a>` : ""}
  </nav>
  <div>${esc(t(lang, "seller"))}: ${esc(m.legalName)}${m.inn ? ` · ${esc(t(lang, "inn"))}: ${esc(m.inn)}` : ""}</div>
</footer>
</div>
<script nonce="${opts.nonce}">
document.getElementById("langSel").addEventListener("change",function(){
  document.cookie="pay_lang="+this.value+";path=/;max-age=31536000;samesite=lax";
  var u=new URL(location.href);u.searchParams.set("lang",this.value);location.replace(u.toString());
});
${opts.script ?? ""}
</script>
</body>
</html>`;
}

export function renderCheckout(opts: {
  lang: PayLang;
  nonce: string;
  plans: Plan[];
  providers: ProviderId[];
  renewLogin?: string;
}): string {
  const { lang, plans, providers } = opts;
  const planHtml = plans
    .map((p, i) => {
      const label = p.months === 12 ? t(lang, "year") : t(lang, "months", p.months);
      const per =
        p.months > 1 ? t(lang, "perMonth", `${formatSum(Math.round(p.amount / p.months))} ${t(lang, "sum")}`) : "";
      return `<label class="opt"><input type="radio" name="plan" value="${esc(p.id)}"${i === plans.length - 1 ? " checked" : ""}>
  <span class="grow"><span class="title">${esc(label)}</span>${per ? `<br><span class="sub">${esc(per)}</span>` : ""}</span>
  <span class="price" data-amount="${p.amount}">${formatSum(p.amount)} ${esc(t(lang, "sum"))}</span></label>`;
    })
    .join("\n");

  const providerHtml = providers
    .map((id, i) => {
      const p = PROVIDERS[id];
      const sub = id === "card" ? `<br><span class="sub">${esc(t(lang, "cardHint"))}</span>` : "";
      return `<label class="opt"><input type="radio" name="provider" value="${id}"${i === 0 ? " checked" : ""}>
  <span class="dot" style="background:${p.color}"></span><span class="grow"><span class="title">${esc(id === "card" ? t(lang, "card") : p.name)}</span>${sub}</span></label>`;
    })
    .join("\n");

  const renewing = !!opts.renewLogin;
  const body = `
<main>
  <h1>UzDieta AI Premium</h1>
  <p class="lead">${esc(t(lang, "tagline"))}</p>
  <ul class="benefits">
    <li>${esc(t(lang, "b1"))}</li><li>${esc(t(lang, "b2"))}</li><li>${esc(t(lang, "b3"))}</li><li>${esc(t(lang, "b4"))}</li>
  </ul>
  ${
    providers.length === 0 || plans.length === 0
      ? `<div class="err">${esc(t(lang, "noProviders"))}</div>`
      : `<form id="payForm" novalidate>
  <h2>${esc(t(lang, "choosePlan"))}</h2>
  <div class="opts">${planHtml}</div>

  <h2>${esc(t(lang, "accountTitle"))}</h2>
  <div class="opts">
    <label class="opt"><input type="radio" name="acct" value="new"${renewing ? "" : " checked"}>
      <span class="grow"><span class="title">${esc(t(lang, "newAccount"))}</span><br><span class="sub">${esc(t(lang, "newAccountHint"))}</span></span></label>
    <label class="opt"><input type="radio" name="acct" value="renew"${renewing ? " checked" : ""}>
      <span class="grow"><span class="title">${esc(t(lang, "renew"))}</span><br><span class="sub">${esc(t(lang, "renewHint"))}</span></span></label>
  </div>
  <div class="field${renewing ? "" : " hidden"}" id="loginField">
    <input id="login" name="login" autocomplete="username" autocapitalize="characters" spellcheck="false" maxlength="20"
      placeholder="${esc(t(lang, "loginPlaceholder"))}" value="${esc(opts.renewLogin ?? "")}" aria-label="${esc(t(lang, "login"))}">
  </div>

  <h2>${esc(t(lang, "choosePay"))}</h2>
  <div class="opts">${providerHtml}</div>

  <div class="err hidden" id="err" role="alert"></div>
  <button class="btn" id="payBtn" type="submit"></button>
  <p class="note"><a href="/pay/offer?lang=${lang}">${esc(t(lang, "agree"))}</a></p>
  <p class="note">🔒 ${esc(t(lang, "secure"))}</p>
</form>`
  }
</main>`;

  const S = {
    pay: t(lang, "pay", "{0}"),
    sum: t(lang, "sum"),
    redirecting: t(lang, "redirecting"),
    errLogin: t(lang, "errLogin"),
    errGeneric: t(lang, "errGeneric"),
    errChoose: t(lang, "errChoose"),
  };
  const script = `
(function(){
var f=document.getElementById("payForm");if(!f)return;
var S=${JSON.stringify(S).replace(/</g, "\\u003c")};
var btn=document.getElementById("payBtn"),err=document.getElementById("err"),lf=document.getElementById("loginField"),li=document.getElementById("login");
function fmt(n){return String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g,"\\u00a0")}
function sel(n){var e=f.querySelector('input[name="'+n+'"]:checked');return e?e.value:""}
function refresh(){
  var p=f.querySelector('input[name="plan"]:checked');
  var amt=p?p.closest("label").querySelector(".price").getAttribute("data-amount"):"";
  btn.textContent=S.pay.replace("{0}",fmt(amt)+" "+S.sum);
  lf.classList.toggle("hidden",sel("acct")!=="renew");
}
f.addEventListener("change",refresh);refresh();
function showErr(m){err.textContent=m;err.classList.remove("hidden")}
f.addEventListener("submit",function(e){
  e.preventDefault();err.classList.add("hidden");
  var provider=sel("provider");if(!provider){showErr(S.errChoose);return}
  var renew=sel("acct")==="renew",login=(li.value||"").trim().toUpperCase();
  if(renew&&!login){showErr(S.errLogin);li.focus();return}
  btn.disabled=true;btn.textContent=S.redirecting;
  fetch("/api/pay/orders",{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({plan:sel("plan"),provider:provider,lang:${JSON.stringify(lang)},login:renew?login:undefined})})
  .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d}})})
  .then(function(x){
    if(!x.ok||!x.d.redirectUrl){throw new Error(x.d&&x.d.error||"generic")}
    try{localStorage.setItem("uzdieta_last_order",x.d.statusUrl)}catch(_){}
    location.href=x.d.redirectUrl;
  })
  .catch(function(e){btn.disabled=false;refresh();showErr(e.message==="login_not_found"?S.errLogin:S.errGeneric)});
});
})();`;

  return shell({ lang, title: t(lang, "pageTitle"), nonce: opts.nonce, body, script, langSwitchPath: "/pay" });
}

export function renderStatus(opts: {
  lang: PayLang;
  nonce: string;
  no: number;
  token: string;
  appStoreUrl?: string;
  playStoreUrl?: string;
}): string {
  const { lang } = opts;
  const stores = [
    opts.playStoreUrl ? `<a href="${esc(opts.playStoreUrl)}" rel="noopener">Google Play</a>` : "",
    opts.appStoreUrl ? `<a href="${esc(opts.appStoreUrl)}" rel="noopener">App Store</a>` : "",
  ].join("");
  const body = `
<main class="panel" id="root" aria-live="polite">
  <p class="note" style="margin:0 0 6px">${esc(t(lang, "order", opts.no))}</p>

  <section id="s-wait" class="center">
    <div class="spinner" aria-hidden="true"></div>
    <h1>${esc(t(lang, "waitTitle"))}</h1>
    <p class="lead">${esc(t(lang, "waitText"))}</p>
    <a class="btn secondary hidden" id="continueBtn" href="#">${esc(t(lang, "continuePay"))}</a>
  </section>

  <section id="s-paid" class="hidden">
    <div class="center"><div class="big">🎉</div><h1>${esc(t(lang, "paidTitle"))}</h1>
    <p class="lead" id="until"></p></div>
    <div id="creds" class="hidden">
      <h2>${esc(t(lang, "credsTitle"))}</h2>
      <div class="cred"><div><div class="k">${esc(t(lang, "login"))}</div><div class="v" id="vLogin"></div></div><button type="button" data-copy="vLogin">${esc(t(lang, "copy"))}</button></div>
      <div class="cred"><div><div class="k">${esc(t(lang, "password"))}</div><div class="v" id="vPass"></div></div><button type="button" data-copy="vPass">${esc(t(lang, "copy"))}</button></div>
      <p class="note">⚠️ ${esc(t(lang, "saveHint"))}</p>
      <a class="btn" id="openApp" href="#">${esc(t(lang, "openApp"))}</a>
      <p class="note">${esc(t(lang, "howTo"))}</p>
    </div>
    <p class="lead center hidden" id="renewed">${esc(t(lang, "renewedText"))}</p>
    ${stores ? `<p class="note">${esc(t(lang, "getApp"))}</p><div class="stores">${stores}</div>` : ""}
  </section>

  <section id="s-cancel" class="hidden center">
    <div class="big">✕</div>
    <h1 id="cancelTitle"></h1>
    <p class="lead">${esc(t(lang, "cancelText"))}</p>
    <a class="btn" href="/pay?lang=${lang}">${esc(t(lang, "retry"))}</a>
  </section>

  <section id="s-missing" class="hidden center">
    <h1>${esc(t(lang, "notFound"))}</h1>
    <a class="btn" href="/pay?lang=${lang}">${esc(t(lang, "back"))}</a>
  </section>
</main>`;

  const S = {
    paidUntil: t(lang, "paidUntil", "{0}"),
    copied: t(lang, "copied"),
    copy: t(lang, "copy"),
    cancelTitle: t(lang, "cancelTitle"),
    refundTitle: t(lang, "refundTitle"),
    locale: DATE_LOCALE[lang],
  };
  const script = `
(function(){
var S=${JSON.stringify(S).replace(/</g, "\\u003c")};
var api="/api/pay/orders/${opts.no}?t="+encodeURIComponent(${JSON.stringify(opts.token)});
function show(id){["s-wait","s-paid","s-cancel","s-missing"].forEach(function(s){document.getElementById(s).classList.toggle("hidden",s!==id)})}
function date(iso){try{return new Intl.DateTimeFormat(S.locale,{day:"numeric",month:"long",year:"numeric"}).format(new Date(iso)).replace(/\.$/,"")}catch(_){return iso.slice(0,10)}}
document.querySelectorAll("[data-copy]").forEach(function(b){b.addEventListener("click",function(){
  var v=document.getElementById(b.getAttribute("data-copy")).textContent;
  (navigator.clipboard?navigator.clipboard.writeText(v):Promise.reject()).then(function(){b.textContent=S.copied;setTimeout(function(){b.textContent=S.copy},1500)}).catch(function(){});
})});
var tries=0,timer=null;
function poll(){
  tries++;
  fetch(api,{cache:"no-store"}).then(function(r){if(r.status===404||r.status===403){show("s-missing");return null}return r.json()}).then(function(d){
    if(!d)return;
    if(d.status==="paid"){
      show("s-paid");
      if(d.premiumUntil)document.getElementById("until").textContent=S.paidUntil.replace("{0}",date(d.premiumUntil));
      if(d.password){
        document.getElementById("creds").classList.remove("hidden");
        document.getElementById("vLogin").textContent=d.login;
        document.getElementById("vPass").textContent=d.password;
        document.getElementById("openApp").href="uzdieta://activate?login="+encodeURIComponent(d.login)+"&password="+encodeURIComponent(d.password);
      } else if(d.renewal){document.getElementById("renewed").classList.remove("hidden")}
      return;
    }
    if(d.status==="cancelled"||d.status==="refunded"){
      document.getElementById("cancelTitle").textContent=d.status==="refunded"?S.refundTitle:S.cancelTitle;show("s-cancel");return;
    }
    show("s-wait");
    var c=document.getElementById("continueBtn");
    if(d.payUrl){c.href=d.payUrl;c.classList.remove("hidden")}
    timer=setTimeout(poll,tries<100?3000:15000);
  }).catch(function(){timer=setTimeout(poll,5000)});
}
poll();
document.addEventListener("visibilitychange",function(){if(!document.hidden&&timer){clearTimeout(timer);poll()}});
})();`;

  return shell({
    lang,
    title: t(lang, "pageTitle"),
    nonce: opts.nonce,
    body,
    script,
    langSwitchPath: `/pay/o/${opts.no}`,
  });
}

export function renderOffer(opts: { lang: PayLang; nonce: string }): string {
  const { lang } = opts;
  const m = merchantInfo();
  const sections = OFFER[OFFER_FALLBACK[lang]] ?? OFFER.uz!;
  const details = [
    `${t(lang, "seller")}: ${m.legalName}`,
    m.inn ? `${t(lang, "inn")}: ${m.inn}` : "",
    m.address ? `${t(lang, "address")}: ${m.address}` : "",
    m.phone ? `${t(lang, "phone")}: ${m.phone}` : "",
    m.email ? `${t(lang, "email")}: ${m.email}` : "",
    m.telegram ? `Telegram: ${m.telegram}` : "",
  ]
    .filter(Boolean)
    .map(esc)
    .join("<br>");
  const html = sections
    .map(([h, p]) => {
      const text = p === "{details}" ? details : esc(p.replace("{seller}", m.legalName));
      return `<h3>${esc(h)}</h3><p>${text}</p>`;
    })
    .join("\n");
  const body = `<main class="panel offer"><h1>${esc(t(lang, "offer"))}</h1>${html}
  <a class="btn secondary" href="/pay?lang=${lang}">${esc(t(lang, "back"))}</a></main>`;
  return shell({ lang, title: `${t(lang, "offer")} — UzDieta AI`, nonce: opts.nonce, body, langSwitchPath: "/pay/offer" });
}
