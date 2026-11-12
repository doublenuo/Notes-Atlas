<script setup lang="ts">
import { computed } from "vue";
import { withBase } from "vitepress";
import { usePosts } from "vitepress-theme-teek";

type ReviewPost = {
  title?: string;
  url?: string;
  date?: string;
  capture?: string;
  relativePath?: string;
  frontmatter?: { description?: string };
};

const posts = usePosts();
const currentYear = new Date().getFullYear();

const formatMonthDay = (value?: string) => {
  if (!value || value.length < 10) return "未标注日期";
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return `${month} 月 ${day} 日`;
};

const excerpt = (value?: string) => {
  if (!value) return "";
  const plain = value
    .replace(/<[^>]+>/g, "")
    .replace(/[#>*_`[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 96 ? `${plain.slice(0, 96)}…` : plain;
};

const summary = (review: ReviewPost) => excerpt(review.frontmatter?.description || review.capture);

const reviews = computed<ReviewPost[]>(() => {
  const list = (posts.value?.sortPostsByDate ?? []) as ReviewPost[];
  return list
    .filter((post) => {
      const path = (post.relativePath ?? "").replace(/^\/+/, "");
      return path.startsWith("04.随笔/03.年终总结/") && !path.endsWith("/index.md");
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
});

const groups = computed(() => {
  const map = new Map<string, ReviewPost[]>();
  for (const review of reviews.value) {
    const year = review.date?.slice(0, 4) || "未标注年份";
    const list = map.get(year) ?? [];
    list.push(review);
    map.set(year, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, list]) => ({ year, items: list }));
});

const total = computed(() => reviews.value.length);
const essaysHref = withBase("/essays");
const reviewHref = (review: ReviewPost) => (review.url ? withBase(review.url) : withBase("/essays"));
</script>

<template>
  <div class="year-page" data-pagefind-body>
    <section class="year-hero" aria-labelledby="year-title">
      <div class="year-hero__copy">
        <p class="year-kicker">YEAR IN REVIEW · 年终总结</p>
        <h1 id="year-title">年终总结<span class="year-title__dot">.</span></h1>
        <p class="year-hero__desc">
          把一年里做成的事、没做好的事、想明白和没想明白的，都放回时间里再看一遍。
        </p>
        <div class="year-hero__meta">
          <span>{{ total }} 篇复盘</span>
          <span class="year-hero__meta-dot" aria-hidden="true"></span>
          <span>不定期更新</span>
        </div>
      </div>

      <div class="year-orbit" aria-hidden="true" data-pagefind-ignore>
        <div class="year-orbit__ring year-orbit__ring--outer"></div>
        <div class="year-orbit__ring year-orbit__ring--inner"></div>
        <span class="year-orbit__label">REVIEW / RESET / RESTART</span>
        <strong>{{ currentYear }}</strong>
        <span class="year-orbit__caption">THE YEAR IN BETWEEN</span>
      </div>
    </section>

    <div class="year-grid">
      <section class="year-index" aria-labelledby="year-index-title">
        <header class="year-section-head">
          <p class="year-kicker">THE ARCHIVE</p>
          <h2 id="year-index-title">年度索引</h2>
          <p>按年份翻回去，看见当时是怎么想的。</p>
        </header>

        <div v-if="groups.length" class="year-timeline">
          <article v-for="group in groups" :key="group.year" class="year-group">
            <div class="year-group__marker">
              <span>{{ group.year }}</span>
              <i aria-hidden="true"></i>
            </div>
            <div class="year-group__body">
              <header class="year-group__head">
                <h3>{{ group.year }}</h3>
                <span>{{ group.items.length }} 篇</span>
              </header>
              <a
                v-for="review in group.items"
                :key="review.url || review.title"
                class="year-entry"
                :href="reviewHref(review)"
                :aria-label="review.title ? `阅读年终总结：${review.title}` : '年终总结'"
              >
                <time>{{ formatMonthDay(review.date) }}</time>
                <div class="year-entry__copy">
                  <h4>{{ review.title || "未命名总结" }}</h4>
                  <p v-if="summary(review)">{{ summary(review) }}</p>
                </div>
                <span class="year-entry__arrow" aria-hidden="true">↗</span>
              </a>
            </div>
          </article>
        </div>

        <div v-else class="year-empty">
          <div class="year-empty__year" aria-hidden="true">{{ currentYear }}</div>
          <div class="year-empty__copy">
            <p class="year-kicker">IN PROGRESS</p>
            <h3>这一年还没写完</h3>
            <p>
              今年的总结还没落笔。等这一年走到结尾，再回来补上。平时想说的话，可以先放在生活随笔里。
            </p>
            <a :href="essaysHref">去生活随笔看看 <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </section>

      <aside class="year-aside">
        <p class="year-kicker">PROMPTS</p>
        <h2>我会写什么</h2>
        <ol class="year-prompts">
          <li>
            <span>01</span>
            <div>
              <h3>做成的事</h3>
              <p>不按结果大小排，只记下真正花过时间的地方。</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>没做好的事</h3>
              <p>那些绕不过去的弯路，往往比顺利的部分更有用。</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>明年想试的事</h3>
              <p>不写目标清单，只留几个还想继续追的问题。</p>
            </div>
          </li>
        </ol>
        <p class="year-aside__note">写给自己看，也留给以后的我。</p>
      </aside>
    </div>

    <footer class="year-footer">
      <a class="year-back" :href="essaysHref">回到生活随笔 <span aria-hidden="true">→</span></a>
      <span class="year-footer__note">YEAR REVIEW · {{ currentYear }}</span>
    </footer>
  </div>
</template>

<style scoped>
.year-page {
  --year-ink: var(--vp-c-text-1);
  --year-muted: var(--vp-c-text-2);
  --year-faint: var(--vp-c-text-3);
  --year-line: var(--vp-c-divider);
  --year-soft: var(--vp-c-bg-soft);
  --year-brand: var(--vp-c-brand-1);
  max-width: 1160px;
  margin: 0 auto;
  padding: 12px 20px 56px;
  overflow-x: clip;
  color: var(--year-ink);
}

.year-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
  gap: 48px;
  align-items: center;
  min-height: 350px;
  padding: 34px 0 54px;
  border-bottom: 1px solid var(--year-line);
}

.year-hero::before {
  position: absolute;
  top: -100px;
  right: -6%;
  width: 46%;
  height: 420px;
  background: radial-gradient(ellipse at center, rgba(183, 132, 82, 0.14), transparent 67%);
  content: "";
  pointer-events: none;
}

.year-hero__copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.year-kicker {
  margin: 0;
  color: var(--year-brand);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.16em;
  line-height: 1.5;
  text-transform: uppercase;
}

.year-hero h1 {
  margin: 14px 0 18px;
  color: var(--year-ink);
  font-family: var(--vp-font-family-heading);
  font-size: clamp(2.8rem, 5vw, 4.25rem);
  font-weight: 800;
  letter-spacing: -0.045em;
  line-height: 1.04;
}

.year-title__dot {
  color: var(--year-brand);
}

.year-hero__desc {
  max-width: 520px;
  margin: 0;
  color: var(--year-muted);
  font-size: 15.5px;
  line-height: 1.9;
}

.year-hero__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 28px;
  color: var(--year-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  letter-spacing: 0.03em;
}

.year-hero__meta-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--year-brand);
}

.year-orbit {
  position: relative;
  display: flex;
  width: 300px;
  height: 300px;
  align-items: center;
  justify-content: center;
  justify-self: center;
  border-radius: 50%;
}

.year-orbit::before {
  position: absolute;
  inset: 20px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(142, 92, 246, 0.13), transparent 68%);
  content: "";
  filter: blur(4px);
}

.year-orbit__ring {
  position: absolute;
  border-radius: 50%;
}

.year-orbit__ring--outer {
  inset: 0;
  border: 1px solid var(--year-line);
}

.year-orbit__ring--inner {
  inset: 42px;
  border: 1px dashed var(--year-line);
}

.year-orbit__ring--outer::after {
  position: absolute;
  top: 16px;
  right: 30px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--year-brand);
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--vp-c-brand-1) 12%, transparent);
  content: "";
}

.year-orbit strong {
  position: relative;
  z-index: 1;
  color: var(--year-ink);
  font-family: var(--vp-font-family-heading);
  font-size: 82px;
  font-weight: 800;
  letter-spacing: -0.08em;
  line-height: 1;
}

.year-orbit__label,
.year-orbit__caption {
  position: absolute;
  left: 50%;
  z-index: 1;
  color: var(--year-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 9px;
  letter-spacing: 0.15em;
  white-space: nowrap;
  transform: translateX(-50%);
}

.year-orbit__label {
  top: 24px;
}

.year-orbit__caption {
  bottom: 24px;
}

.year-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.48fr) minmax(258px, 0.52fr);
  gap: 56px;
  padding-top: 46px;
}

.year-index {
  min-width: 0;
}

.year-section-head {
  margin-bottom: 28px;
}

.year-section-head h2,
.year-aside h2 {
  margin: 8px 0 10px;
  color: var(--year-ink);
  font-family: var(--vp-font-family-heading);
  font-size: 30px;
  font-weight: 750;
  letter-spacing: -0.035em;
  line-height: 1.2;
}

.year-section-head > p:last-child {
  margin: 0;
  color: var(--year-muted);
  font-size: 14px;
  line-height: 1.8;
}

.year-group {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 18px;
}

.year-group + .year-group {
  margin-top: 40px;
}

.year-group__marker {
  position: relative;
  padding-top: 2px;
}

.year-group__marker span {
  color: var(--year-brand);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.04em;
}

.year-group__marker i {
  position: absolute;
  top: 30px;
  bottom: -40px;
  left: 3px;
  width: 1px;
  background: var(--year-line);
}

.year-group:last-child .year-group__marker i {
  display: none;
}

.year-group__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--year-line);
  padding-bottom: 10px;
}

.year-group__head h3 {
  margin: 0;
  color: var(--year-ink);
  font-family: var(--vp-font-family-heading);
  font-size: 26px;
  font-weight: 750;
  letter-spacing: -0.04em;
  line-height: 1;
}

.year-group__head span {
  color: var(--year-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
}

.year-entry {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr) 20px;
  gap: 14px;
  align-items: start;
  border-bottom: 1px solid var(--year-line);
  padding: 16px 0 17px;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.2s ease;
}

.year-entry:hover {
  border-color: var(--year-brand);
}

.year-entry time {
  padding-top: 3px;
  color: var(--year-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.year-entry__copy {
  min-width: 0;
}

.year-entry h4 {
  margin: 0;
  color: var(--year-ink);
  font-family: var(--vp-font-family-heading);
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.015em;
  line-height: 1.5;
  transition: color 0.2s ease;
}

.year-entry:hover h4 {
  color: var(--year-brand);
}

.year-entry p {
  display: -webkit-box;
  overflow: hidden;
  margin: 5px 0 0;
  color: var(--year-muted);
  font-size: 13px;
  line-height: 1.75;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.year-entry__arrow {
  color: var(--year-brand);
  font-size: 15px;
  line-height: 1.5;
  opacity: 0.7;
  transition: transform 0.2s ease;
}

.year-entry:hover .year-entry__arrow {
  transform: translate(2px, -2px);
}

.year-empty {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 28px;
  align-items: center;
  border: 1px solid var(--year-line);
  border-radius: 20px;
  padding: 34px 34px 36px;
  background:
    radial-gradient(ellipse at 0% 0%, rgba(183, 132, 82, 0.1), transparent 58%),
    var(--vp-c-bg-soft);
}

.year-empty__year {
  color: var(--year-faint);
  font-family: var(--vp-font-family-heading);
  font-size: 52px;
  font-weight: 800;
  letter-spacing: -0.06em;
  line-height: 1;
  opacity: 0.62;
}

.year-empty__copy h3 {
  margin: 8px 0 8px;
  color: var(--year-ink);
  font-family: var(--vp-font-family-heading);
  font-size: 23px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.year-empty__copy > p:last-of-type {
  max-width: 430px;
  margin: 0;
  color: var(--year-muted);
  font-size: 13.5px;
  line-height: 1.85;
}

.year-empty__copy a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 16px;
  color: var(--year-brand);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.year-aside {
  align-self: start;
  border-left: 1px solid var(--year-line);
  padding-left: 32px;
}

.year-aside h2 {
  font-size: 27px;
}

.year-prompts {
  display: grid;
  gap: 22px;
  margin: 26px 0 0;
  padding: 0;
  list-style: none;
}

.year-prompts li {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 12px;
}

.year-prompts li > span {
  padding-top: 2px;
  color: var(--year-brand);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
}

.year-prompts h3 {
  margin: 0 0 5px;
  color: var(--year-ink);
  font-size: 14.5px;
  font-weight: 650;
  line-height: 1.5;
}

.year-prompts p {
  margin: 0;
  color: var(--year-muted);
  font-size: 13px;
  line-height: 1.75;
}

.year-aside__note {
  margin: 28px 0 0;
  border-left: 2px solid var(--year-brand);
  padding: 2px 0 2px 14px;
  color: var(--year-muted);
  font-family: var(--vp-font-family-heading);
  font-size: 13.5px;
  line-height: 1.8;
}

.year-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 54px;
  border-top: 1px solid var(--year-line);
  padding-top: 20px;
}

.year-back {
  color: var(--year-ink);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.year-back span {
  display: inline-block;
  margin-left: 5px;
  color: var(--year-brand);
  transition: transform 0.2s ease;
}

.year-back:hover span {
  transform: translateX(4px);
}

.year-footer__note {
  color: var(--year-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
}

@media (max-width: 960px) {
  .year-hero {
    grid-template-columns: 1fr;
    min-height: 0;
    gap: 0;
    padding-top: 28px;
  }

  .year-orbit {
    display: none;
  }

  .year-grid {
    grid-template-columns: 1fr;
    gap: 42px;
  }

  .year-aside {
    border-top: 1px solid var(--year-line);
    border-left: 0;
    padding-top: 32px;
    padding-left: 0;
  }

  .year-prompts {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
  }

  .year-prompts li {
    grid-template-columns: 1fr;
    gap: 5px;
  }
}

@media (max-width: 640px) {
  .year-page {
    padding-bottom: 44px;
  }

  .year-hero {
    padding: 20px 0 36px;
  }

  .year-hero h1 {
    margin-top: 12px;
    font-size: clamp(2.6rem, 11vw, 3.4rem);
  }

  .year-hero__desc {
    font-size: 14.5px;
    line-height: 1.85;
  }

  .year-hero__meta {
    margin-top: 22px;
  }

  .year-grid {
    padding-top: 34px;
  }

  .year-section-head h2,
  .year-aside h2 {
    font-size: 25px;
  }

  .year-group {
    grid-template-columns: 48px minmax(0, 1fr);
    gap: 12px;
  }

  .year-group__marker span {
    font-size: 11px;
  }

  .year-group__head h3 {
    font-size: 23px;
  }

  .year-entry {
    grid-template-columns: minmax(0, 1fr) 16px;
    gap: 4px 10px;
    padding: 14px 0 15px;
  }

  .year-entry time {
    grid-column: 1 / -1;
    padding-top: 0;
    font-size: 9.5px;
  }

  .year-entry__copy {
    grid-column: 1;
  }

  .year-entry__arrow {
    grid-column: 2;
    grid-row: 2;
    padding-top: 2px;
  }

  .year-entry h4 {
    font-size: 16px;
  }

  .year-entry p {
    font-size: 12.5px;
  }

  .year-empty {
    grid-template-columns: 1fr;
    gap: 18px;
    padding: 28px 22px 30px;
  }

  .year-empty__year {
    font-size: 44px;
  }

  .year-prompts {
    grid-template-columns: 1fr;
    gap: 20px;
    margin-top: 20px;
  }

  .year-footer {
    margin-top: 40px;
  }
}

@media (max-width: 360px) {
  .year-hero h1 {
    font-size: 2.45rem;
  }

  .year-group {
    grid-template-columns: 42px minmax(0, 1fr);
  }

  .year-entry {
    grid-template-columns: minmax(0, 1fr);
  }

  .year-entry__arrow {
    display: none;
  }

  .year-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .year-entry,
  .year-entry__arrow,
  .year-back span {
    transition: none;
  }
}
</style>
