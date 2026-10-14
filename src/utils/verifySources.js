// Проверка существования источников, предложенных ИИ (ИИ может выдумать).
// Книги — через Google Books API (бесплатно, без ключа). Ссылки — реальный GET-запрос.

// fetch с таймаутом (Node 22 — глобальный fetch + AbortController)
const fetchTimeout = async (url, opts = {}, ms = 6000) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, redirect: 'follow' });
  } finally {
    clearTimeout(t);
  }
};

// Запасная проверка книги — Open Library (без ключа и без общей дневной квоты).
const verifyBookOpenLibrary = async ({ title, author }) => {
  const params = new URLSearchParams({ title, limit: '1', fields: 'title,author_name,key' });
  if (author) params.set('author', author);
  const resp = await fetchTimeout(`https://openlibrary.org/search.json?${params}`, {
    headers: { 'user-agent': 'PeravenorBot/1.0 (support@peravenor.com)' },
  });
  if (!resp.ok) return null;
  const doc = (await resp.json()).docs?.[0];
  if (!doc) return null;
  return {
    type: 'book', verified: true,
    title: doc.title || title,
    author: (doc.author_name || []).join(', ') || author || '',
    url: doc.key ? `https://openlibrary.org${doc.key}` : null,
  };
};

// Проверить книгу через Google Books. Возвращает нормализованную книгу или null.
// Без ключа Google Books делит ОДНУ дневную квоту на всех анонимных клиентов и отвечает 429
// (2026-10-14: «Quota exceeded … Queries per day») — тогда не проходила ни одна книга.
// Поэтому при любом не-OK ответе проверяем по Open Library.
const verifyBook = async ({ title, author }) => {
  try {
    const q = [`intitle:${title}`, author ? `inauthor:${author}` : ''].filter(Boolean).join('+');
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1&country=US`;
    const resp = await fetchTimeout(url);
    if (!resp.ok) return await verifyBookOpenLibrary({ title, author });
    const json = await resp.json();
    const item = json.items?.[0]?.volumeInfo;
    if (!item) return null;
    return {
      type: 'book', verified: true,
      title: item.title || title,
      author: (item.authors || []).join(', ') || author || '',
      url: item.infoLink || item.canonicalVolumeLink || null,
    };
  } catch {
    return null;
  }
};

// Хост, по которому сервер НЕ должен ходить: ИИ может вернуть адрес внутренней сети,
// и тогда наш запрос уходит во внутренний периметр (SSRF).
const isInternalHost = (hostname) => {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true;
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const [a, b] = v4.slice(1).map(Number);
  return a === 10 || a === 127 || a === 0
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254);
};

// Основы значимых слов (≥4 букв, первые 5) — сравнение без учёта падежей: «империя» ≈ «империи».
const stems = (s) => new Set(s.toLowerCase().match(/[\p{L}\d]{4,}/gu)?.map((w) => w.slice(0, 5)) || []);

// ИИ часто угадывает название статьи Википедии неточно («Государственная_дума_(Российская_империя)»
// вместо «Государственная дума Российской империи») — такая ссылка даёт 404. Ищем статью
// полнотекстовым поиском самой Википедии и возвращаем РЕАЛЬНЫЙ адрес найденной статьи.
// Поиск находит что-нибудь всегда, поэтому найденное название должно покрывать не меньше половины
// значимых слов задуманного — иначе null (выдуманная статья не превращается в случайную настоящую).
const resolveWikipedia = async (url) => {
  const { hostname, pathname } = new URL(url);
  if (!/^[a-z-]+\.(m\.)?wikipedia\.org$/i.test(hostname) || !pathname.startsWith('/wiki/')) return null;
  const host = hostname.replace('.m.', '.');
  const guess = decodeURIComponent(pathname.slice(6)).replace(/_/g, ' ');
  const api = `https://${host}/w/api.php?${new URLSearchParams({
    action: 'query', list: 'search', srsearch: guess, srlimit: '1', srnamespace: '0', format: 'json',
  })}`;
  const resp = await fetchTimeout(api, { headers: { 'user-agent': 'PeravenorBot/1.0 (support@peravenor.com)' } });
  if (!resp.ok) return null;
  const title = (await resp.json()).query?.search?.[0]?.title;
  if (!title) return null;
  const want = stems(guess);
  const got = stems(title);
  const hit = [...want].filter((w) => got.has(w)).length;
  if (!want.size || hit * 2 < want.size) return null;
  return { title, url: `https://${host}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` };
};

// Проверить ссылку GET-запросом (точнее HEAD по части «мягких» 404). Возвращает источник или null.
const verifyLink = async ({ title, url }) => {
  try {
    if (!/^https?:\/\//i.test(url || '')) return null;
    if (isInternalHost(new URL(url).hostname)) return null;
    // GET надёжнее HEAD: многие серверы отдают неверный статус на HEAD.
    const resp = await fetchTimeout(url, {
      method: 'GET',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; PeravenorBot/1.0)' },
    });
    if (resp.status === 404) {
      const found = await resolveWikipedia(url);
      return found ? { type: 'link', verified: true, title: found.title, url: found.url } : null;
    }
    if (resp.status >= 400) return null;
    // финальный URL после редиректов — чтобы не сохранить ссылку, ведущую на страницу-заглушку
    const finalUrl = resp.url || url;
    return { type: 'link', verified: true, title: title || finalUrl, url: finalUrl };
  } catch {
    return null;
  }
};

// Проверить пачку предложений ИИ.
// { books:[{title,author}], links:[{title,url}] }, opts.loose — включать непрошедшие как verified:false.
const verifySources = async ({ books = [], links = [] }, { loose = false } = {}) => {
  const bookInputs = books.slice(0, 5);
  const linkInputs = links.slice(0, 5);
  const [bookResults, linkResults] = await Promise.all([
    Promise.all(bookInputs.map(verifyBook)),
    Promise.all(linkInputs.map(verifyLink)),
  ]);

  const verified = [...bookResults, ...linkResults].filter(Boolean);
  if (!loose) return verified;

  // loose: добавляем непрошедшие проверку как «менее проверенные» (verified:false)
  const verifiedUrls = new Set(verified.map((s) => s.url).filter(Boolean));
  const extras = [];
  bookInputs.forEach((b, i) => {
    if (!bookResults[i]) extras.push({ type: 'book', verified: false, title: b.title, author: b.author || '', url: null });
  });
  linkInputs.forEach((l, i) => {
    if (!linkResults[i] && l.url && !verifiedUrls.has(l.url)) {
      extras.push({ type: 'link', verified: false, title: l.title || l.url, url: l.url });
    }
  });
  return [...verified, ...extras];
};

module.exports = { verifySources };
