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

// Проверить книгу через Google Books. Возвращает нормализованную книгу или null.
const verifyBook = async ({ title, author }) => {
  try {
    const q = [`intitle:${title}`, author ? `inauthor:${author}` : ''].filter(Boolean).join('+');
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1&country=US`;
    const resp = await fetchTimeout(url);
    if (!resp.ok) return null;
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

// Проверить ссылку GET-запросом (точнее HEAD по части «мягких» 404). Возвращает источник или null.
const verifyLink = async ({ title, url }) => {
  try {
    if (!/^https?:\/\//i.test(url || '')) return null;
    // GET надёжнее HEAD: многие серверы отдают неверный статус на HEAD.
    const resp = await fetchTimeout(url, {
      method: 'GET',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; LinguaFlowBot/1.0)' },
    });
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
