/*
 * Recent Activity feed.
 * Posts live in posts.json (newest are shown first). Each post:
 *   date  (required) "YYYY-MM-DD"
 *   text  (required) post text; use \n for line breaks
 *   image (optional) path to an image, e.g. "posts/my-photo.jpg"
 *   alt   (optional) short description of the image
 *   link  (optional) URL shown under the post
 */
(() => {
  const feed = document.getElementById('feed');
  if (!feed) return;

  const AUTHOR = 'Adam Zeineldin';
  const AVATAR = 'avatar.jpg';

  /** @param {unknown} post @returns {boolean} */
  function isValidPost(post) {
    return Boolean(post)
      && typeof post === 'object'
      && typeof post.text === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(post.date)
      && (post.image === undefined || typeof post.image === 'string')
      && (post.link === undefined || /^https?:\/\//.test(post.link));
  }

  /** @param {string} iso @returns {string} */
  function formatDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderPost(post) {
    const article = el('article', 'post');

    const head = el('header', 'post-head');
    const avatar = el('img', 'post-avatar');
    avatar.src = AVATAR;
    avatar.alt = '';
    const time = el('time', 'post-date', formatDate(post.date));
    time.dateTime = post.date;
    head.append(avatar, el('span', 'post-author', AUTHOR), el('span', 'post-sep', '·'), time);
    article.append(head);

    article.append(el('p', 'post-text', post.text));

    if (post.image) {
      const img = el('img', 'post-image');
      img.src = post.image;
      img.alt = post.alt || '';
      img.loading = 'lazy';
      article.append(img);
    }

    if (post.link) {
      const a = el('a', 'post-link', post.link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''));
      a.href = post.link;
      a.target = '_blank';
      a.rel = 'noopener';
      article.append(a);
    }

    return article;
  }

  function showMessage(text) {
    feed.replaceChildren(el('p', 'feed-message', text));
  }

  fetch('posts.json', { cache: 'no-cache' })
    .then(res => {
      if (!res.ok) throw new Error(`posts.json returned ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (!Array.isArray(data)) throw new Error('posts.json must be a list of posts');
      const posts = data.filter(isValidPost);
      if (posts.length !== data.length) console.warn(`Skipped ${data.length - posts.length} invalid post(s) in posts.json`);
      if (posts.length === 0) return showMessage('nothing here yet.');
      const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));
      feed.replaceChildren(...sorted.map(renderPost));
    })
    .catch(err => {
      console.error('Could not load posts:', err);
      showMessage('couldn’t load posts right now.');
    });
})();
