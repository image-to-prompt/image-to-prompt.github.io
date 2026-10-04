(function () {
  const api = window.IMAGE_TO_PROMPT_API_URL || 'https://image-to-prompt-api.tastyeffectco.workers.dev';
  const countries = new Set(['DZ','BH','KM','DJ','EG','IQ','JO','KW','LB','LY','MR','MA','OM','PS','QA','SA','SO','SD','SY','TN','AE','YE']);
  const copy = {
    en: ['From the maker of this tool','Build a website from your idea.','Describe your website, then refine the design and content.','Build with','Before you copy','Keep the subject, light, and viewpoint.','Remove details the model guessed.','Add settings for your image generator.'],
    es: ['Del creador de esta herramienta','Crea un sitio web a partir de tu idea.','Describe tu sitio y ajusta el diseño y el contenido.','Crea con','Antes de copiar','Conserva el sujeto, la luz y el punto de vista.','Elimina los detalles que el modelo haya inventado.','Añade los ajustes de tu generador de imágenes.'],
    zh: ['来自本工具的开发者','将你的想法变成网站。','描述你的网站，再调整设计和内容。','使用','复制之前','保留主体、光线和视角。','删除模型猜错的细节。','添加图像生成器所需的设置。'],
    ru: ['От создателя этого инструмента','Создайте сайт по вашей идее.','Опишите сайт, затем уточните дизайн и содержание.','Создать с','Перед копированием','Сохраните объект, освещение и ракурс.','Удалите детали, которые модель угадала неверно.','Добавьте настройки вашего генератора изображений.'],
    ar: ['من صانع هذه الأداة','حوّل فكرتك إلى موقع.','صف موقعك بالعربي، ثم عدّل التصميم والمحتوى.','ابنِ موقعك مع','قبل نسخ الوصف','احتفظ بالموضوع والإضاءة وزاوية الصورة.','احذف التفاصيل التي خمّنها النموذج خطأً.','أضف إعدادات أداة توليد الصور.']
  };
  const language = document.documentElement.lang.split('-')[0];
  const tips = document.createElement('aside');
  tips.className = 'side-panel side-panel-left';
  const promo = document.createElement('aside');
  promo.className = 'side-panel side-panel-right';
  const target = document.querySelector('#upload') || document.querySelector('.hero') || document.querySelector('main');
  if (!target) return;
  target.insertAdjacentElement('afterend', tips);
  tips.insertAdjacentElement('afterend', promo);
  document.body.classList.add('has-side-panels');
  function show(arabic) {
    const text = copy[language] || copy.en;
    const marketing = arabic && language === 'en' ? copy.ar : text;
    const name = arabic ? 'يلا سوي' : 'uPilote';
    const url = 'https://' + (arabic ? 'yallasawi.com' : 'upilote.com') + '/?utm_source=image-to-prompt&utm_medium=sidebar&utm_campaign=maker-link';
    tips.replaceChildren(); promo.replaceChildren();
    const add = (parent, tag, value) => { const el = document.createElement(tag); el.textContent = value; parent.append(el); return el; };
    add(tips, 'h2', text[4]);
    const list = document.createElement('ul'); tips.append(list);
    text.slice(5).forEach(item => add(list, 'li', item));
    add(promo, 'p', marketing[0]).className = 'side-label';
    const brandLink = document.createElement('a');
    brandLink.href = url; brandLink.className = 'side-brand';
    const logo = document.createElement('img');
    logo.src = arabic ? '/assets/brands/yalla-sawi.png' : '/assets/brands/upilote-mark.svg';
    logo.alt = name; logo.className = arabic ? 'brand-wordmark' : 'brand-symbol';
    brandLink.append(logo);
    if (!arabic) { const wordmark = document.createElement('span'); wordmark.textContent = name; brandLink.append(wordmark); }
    promo.append(brandLink);
    add(promo, 'h2', marketing[1]);
    add(promo, 'p', marketing[2]);
    const link = add(promo, 'a', marketing[3] + ' ' + name + ' ↗');
    link.href = url; link.className = 'side-cta';
    promo.lang = arabic && language === 'en' ? 'ar' : language;
    promo.dir = promo.lang === 'ar' ? 'rtl' : 'ltr';
    tips.lang = language; tips.dir = language === 'ar' ? 'rtl' : 'ltr';
    tips.setAttribute('aria-label',text[4]); promo.setAttribute('aria-label',marketing[0]);
    document.querySelectorAll('[data-maker-link]').forEach(el => { el.href = url; el.textContent = name; });
  }
  show(language === 'ar' || (navigator.language || '').startsWith('ar'));
  fetch(api + '/api/region', {cache:'no-store'})
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => { if (typeof data.country === 'string') show(language === 'ar' || countries.has(data.country.toUpperCase())); })
    .catch(() => {});
})();
