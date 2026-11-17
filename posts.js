/*
 * Recent Activity feed.
 * Posts live in posts.json (newest are shown first). Each post:
 *   date  (required) "YYYY-MM-DD"
 *   text  (required) post text; use \n for line breaks
 *   image (optional) path to an image, e.g. "posts/my-photo.jpg"
 *   alt   (optional) short description of the image
 *   link  (optional) URL shown under the post
 *   builtWith (optional) [{ "name": "Full Name", "linkedin": "https://www.linkedin.com/in/..." }]
 *   url   (optional) full blog post (https://... opens in a new tab, or a local path); makes the whole card clickable
 */
(() => {
  const feed = document.getElementById('feed');
  if (!feed) return;

  const AUTHOR = 'Adam Zeineldin';
  const AVATAR = 'avatar.jpg';
  const PAGE_SIZE = 3; // posts shown before (and per) "See more"

  /** @param {unknown} post @returns {boolean} */
  function isValidPost(post) {
    return Boolean(post)
      && typeof post === 'object'
      && typeof post.text === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(post.date)
      && (post.image === undefined || typeof post.image === 'string')
      && (post.link === undefined || /^https?:\/\//.test(post.link))
      && (post.url === undefined || /^https:\/\//.test(post.url) || /^[a-z0-9/_-]+\/?$/i.test(post.url))
      && (post.builtWith === undefined || (Array.isArray(post.builtWith) && post.builtWith.every(isValidPerson)));
  }

  /** @param {unknown} p @returns {boolean} */
  function isValidPerson(p) {
    return Boolean(p) && typeof p.name === 'string'
      && (p.linkedin === undefined || /^https:\/\/(www\.)?linkedin\.com\//.test(p.linkedin));
  }

  /** "A", "A and B", "A, B, and C" with each name linked to LinkedIn. */
  function renderBuiltWith(people) {
    const p = el('p', 'post-built', 'Built with ');
    people.forEach((person, i) => {
      if (i > 0) p.append(people.length > 2 ? ', ' : ' ');
      if (i > 0 && i === people.length - 1) p.append('and ');
      if (person.linkedin) {
        const a = el('a', 'post-person', person.name);
        a.href = person.linkedin;
        a.target = '_blank';
        a.rel = 'noopener';
        p.append(a);
      } else {
        p.append(person.name);
      }
    });
    return p;
  }

  /** @param {string} url @returns {boolean} */
  function isExternal(url) {
    return /^https?:\/\//.test(url);
  }

  /** Whole card opens the blog post; inner links keep their own behavior. */
  function makeClickable(article, url) {
    article.classList.add('post-clickable');
    article.addEventListener('click', (e) => {
      if (e.target.closest('a') || window.getSelection().toString()) return;
      if (isExternal(url)) window.open(url, '_blank', 'noopener');
      else window.location.href = url;
    });
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

    if (post.builtWith && post.builtWith.length) article.append(renderBuiltWith(post.builtWith));

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

    if (post.url) {
      const external = isExternal(post.url);
      const read = el('a', 'post-read', external ? 'Read the full post ↗' : 'Read the full post →');
      read.href = post.url;
      if (external) {
        read.target = '_blank';
        read.rel = 'noopener';
      }
      article.append(read);
      makeClickable(article, post.url);
    }

    return article;
  }

  function showMessage(text) {
    feed.replaceChildren(el('p', 'feed-message', text));
  }

  /** Shows PAGE_SIZE posts at a time, with a "See more" button for the next batch. */
  function renderPaged(posts) {
    let shown = 0;
    const more = el('button', 'feed-more', 'See more');
    more.type = 'button';

    function showNext() {
      const batch = posts.slice(shown, shown + PAGE_SIZE).map(renderPost);
      more.before(...batch);
      shown += batch.length;
      const left = posts.length - shown;
      more.hidden = left <= 0;
    }

    more.addEventListener('click', showNext);
    feed.replaceChildren(more);
    showNext();
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
      renderPaged(sorted);
    })
    .catch(err => {
      console.error('Could not load posts:', err);
      showMessage('couldn’t load posts right now.');
    });
})();
