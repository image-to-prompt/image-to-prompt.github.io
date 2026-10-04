(function () {
  const api = window.IMAGE_TO_PROMPT_API_URL || 'https://image-to-prompt-api.tastyeffectco.workers.dev';
  const arabicCountries = new Set(['DZ','BH','KM','DJ','EG','IQ','JO','KW','LB','LY','MR','MA','OM','PS','QA','SA','SO','SD','SY','TN','AE','YE']);
  const brands = {
    ar: {
      name: 'يلا سوي',
      url: 'https://yallasawi.com/?utm_source=image-to-prompt&utm_medium=website&utm_campaign=maker-link',
      line: 'عندك فكرة لموقع؟ اكتبها بالعربي وابنِ موقعك مع يلا سوي.',
      link: 'تعرّف على يلا سوي ↗'
    },
    other: {
      name: 'uPilote',
      url: 'https://upilote.com/?utm_source=image-to-prompt&utm_medium=website&utm_campaign=maker-link',
      line: 'Have a website idea? Build it with uPilote.',
      link: 'Explore uPilote ↗'
    }
  };
  const arabicTips = '<span class="maker-label">بعد نسخ البرومبت</span><h2>حسّن الوصف</h2><ul><li>احتفظ بالموضوع والإضاءة وزاوية الصورة.</li><li>احذف التفاصيل التي خمّنها النموذج خطأً.</li><li>أضف إعدادات أداة توليد الصور التي تستخدمها.</li></ul><p class="maker-label">من صانع هذه الأداة</p><p id="maker-line"></p><a id="maker-link" href="https://yallasawi.com/">تعرّف على يلا سوي ↗</a>';
  const otherTips = '<span class="maker-label">After you copy your prompt</span><h2>Make it more useful</h2><ul><li>Keep the subject, setting, light, and viewpoint.</li><li>Remove details the model guessed incorrectly.</li><li>Add your image model’s own settings.</li></ul><p class="maker-label">From the maker of this tool</p><p id="maker-line"></p><a id="maker-link" href="https://upilote.com/">Explore uPilote ↗</a>';

  const style = document.createElement('style');
  style.textContent = `
    .maker-rail{background:#1e293b;border:1px solid #475569;border-radius:16px;padding:1.25rem;color:#f8fafc;font:14px/1.5 system-ui,sans-serif;max-width:760px;margin:1.5rem auto}
    .maker-rail h2{font-size:1rem;margin:0 0 .7rem}.maker-rail p{margin:.7rem 0;color:#cbd5e1}.maker-rail ul{margin:.5rem 0 1rem;padding-left:1.25rem;color:#cbd5e1}.maker-rail li{margin:.4rem 0}.maker-rail a{color:#c7d2fe;text-underline-offset:3px}.maker-rail .maker-label{font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8}
    @media(min-width:1280px){body.has-maker-rail{padding-right:285px}.maker-rail{position:fixed;z-index:30;right:14px;top:100px;width:255px;max-height:calc(100vh - 120px);overflow:auto;margin:0}}
  `;
  document.head.append(style);

  const rail = document.createElement('aside');
  rail.className = 'maker-rail';
  rail.setAttribute('aria-label', 'Prompt tips and project maker');
  rail.innerHTML = otherTips;
  const target = document.querySelector('#upload') || document.querySelector('main') || document.body;
  target.insertAdjacentElement('afterend', rail);
  document.body.classList.add('has-maker-rail');

  function show(key) {
    const brand = brands[key];
    rail.innerHTML = key === 'ar' ? arabicTips : otherTips;
    rail.querySelector('#maker-line').textContent = brand.line;
    const link = rail.querySelector('#maker-link');
    link.textContent = brand.link;
    link.href = brand.url;
    rail.lang = key === 'ar' ? 'ar' : 'en';
    rail.dir = key === 'ar' ? 'rtl' : 'ltr';
    for (const el of document.querySelectorAll('[data-maker-link]')) {
      el.href = brand.url;
      el.textContent = brand.name;
    }
  }

  const fallbackArabic = document.documentElement.lang === 'ar' || (navigator.language || '').toLowerCase().startsWith('ar');
  show(fallbackArabic ? 'ar' : 'other');
  fetch(`${api}/api/region`, { cache: 'no-store' })
    .then(response => response.ok ? response.json() : Promise.reject(new Error('Region unavailable')))
    .then(data => { if (data && typeof data.country === 'string') show(arabicCountries.has(data.country.toUpperCase()) ? 'ar' : 'other'); })
    .catch(() => {});
})();
