<script setup lang="ts">
import { computed } from "vue";
import { withBase } from "vitepress";
import { usePosts } from "vitepress-theme-teek";

type NotePost = {
  title?: string;
  url?: string;
  date?: string;
  capture?: string;
  relativePath?: string;
  frontmatter?: { description?: string };
};

const posts = usePosts();

const formatDate = (value?: string) => {
  if (!value) return "未标注日期";
  const day = value.slice(0, 10);
  return day ? day.replace(/-/g, ".") : "未标注日期";
};

const excerpt = (value?: string) => {
  if (!value) return "";
  const plain = value
    .replace(/<[^>]+>/g, "")
    .replace(/[#>*_`[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 92 ? `${plain.slice(0, 92)}…` : plain;
};

const summary = (note: NotePost) => excerpt(note.frontmatter?.description || note.capture);

const notes = computed<NotePost[]>(() => {
  const list = (posts.value?.sortPostsByDate ?? []) as NotePost[];
  return list
    .filter((post) => {
      const path = (post.relativePath ?? "").replace(/^\/+/, "");
      return path.startsWith("04.随笔/01.读书笔记/") && !path.endsWith("/index.md");
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
});

const noteCount = computed(() => notes.value.length);
const latestLabel = computed(() => (notes.value[0]?.date ? formatDate(notes.value[0].date) : "—"));
const essaysHref = withBase("/essays");
const currentYear = new Date().getFullYear();

const noteHref = (note: NotePost) => (note.url ? withBase(note.url) : withBase("/essays"));
</script>

<template>
  <div class="reading-page" data-pagefind-body>
    <section class="reading-hero" aria-labelledby="reading-title">
      <div class="reading-hero__copy">
        <p class="reading-kicker">READING NOTES · 读书笔记</p>
        <h1 id="reading-title">读书笔记<span class="reading-title__dot">.</span></h1>
        <p class="reading-hero__desc">
          书页翻过去，留下一点回声。这里放读书时的摘录、问题和还没想明白的地方。
        </p>
        <div class="reading-stats">
          <div class="reading-stat">
            <strong>{{ noteCount }}</strong>
            <span>篇笔记</span>
          </div>
          <div class="reading-stat">
            <strong>{{ latestLabel }}</strong>
            <span>最近更新</span>
          </div>
        </div>
      </div>

      <div class="reading-stack" aria-hidden="true" data-pagefind-ignore>
        <div class="reading-stack__halo"></div>
        <div class="reading-book reading-book--back">
          <span>THINK</span>
          <b>02</b>
        </div>
        <div class="reading-book reading-book--mid">
          <span>READ</span>
          <b>01</b>
        </div>
        <div class="reading-book reading-book--front">
          <span>KEEP</span>
          <b>03</b>
        </div>
      </div>
    </section>

    <div class="reading-grid">
      <section class="reading-shelf" aria-labelledby="shelf-title">
        <header class="reading-section-head">
          <p class="reading-kicker">THE SHELF</p>
          <h2 id="shelf-title">书架</h2>
          <p>读过的、正在读的，都会慢慢放到这里。</p>
        </header>

        <div v-if="notes.length" class="reading-list">
          <a
            v-for="note in notes"
            :key="note.url || note.title"
            class="reading-card"
            :href="noteHref(note)"
            :aria-label="note.title ? `阅读笔记：${note.title}` : '阅读笔记'"
          >
            <div class="reading-card__top">
              <time>{{ formatDate(note.date) }}</time>
              <span class="reading-card__arrow" aria-hidden="true">↗</span>
            </div>
            <h3>{{ note.title || "未命名笔记" }}</h3>
            <p v-if="summary(note)" class="reading-card__excerpt">{{ summary(note) }}</p>
          </a>
        </div>

        <div v-else class="reading-empty">
          <div class="reading-empty__mark" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p class="reading-kicker">NO NOTES YET</p>
          <h3>书架还空着</h3>
          <p>等第一本书读完，这里会慢慢长出来。急着看的话，可以先看看「读法」。</p>
        </div>
      </section>

      <aside class="reading-aside">
        <p class="reading-kicker">MARGINS</p>
        <h2>读书时，<br />我在意什么</h2>
        <ol class="reading-principles">
          <li>
            <span>01</span>
            <div>
              <h3>先读完，再做笔记</h3>
              <p>不在第一页停下来搭框架，先让书自己把话说完。</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>记下不同意的地方</h3>
              <p>赞同的部分容易忘，卡住和反驳的地方更值得留。</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>过一阵再回来</h3>
              <p>刚读完写的是感受，过一段时间留下来的才是理解。</p>
            </div>
          </li>
        </ol>
        <blockquote>“读过的书，最后会变成看世界的方式。”</blockquote>
      </aside>
    </div>

    <footer class="reading-footer">
      <a class="reading-back" :href="essaysHref">回到生活随笔 <span aria-hidden="true">→</span></a>
      <span class="reading-footer__note">READING · {{ currentYear }}</span>
    </footer>
  </div>
</template>

<style scoped>
.reading-page {
  --read-ink: var(--vp-c-text-1);
  --read-muted: var(--vp-c-text-2);
  --read-faint: var(--vp-c-text-3);
  --read-line: var(--vp-c-divider);
  --read-soft: var(--vp-c-bg-soft);
  --read-brand: var(--vp-c-brand-1);
  max-width: 1160px;
  margin: 0 auto;
  padding: 12px 20px 56px;
  overflow-x: clip;
  color: var(--read-ink);
}

.reading-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(280px, 0.92fr);
  gap: 56px;
  align-items: center;
  min-height: 360px;
  padding: 36px 0 54px;
  border-bottom: 1px solid var(--read-line);
}

.reading-hero::before {
  position: absolute;
  top: -90px;
  right: -8%;
  width: 48%;
  height: 430px;
  background: radial-gradient(ellipse at center, rgba(142, 92, 246, 0.13), transparent 68%);
  content: "";
  pointer-events: none;
}

.reading-hero__copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.reading-kicker {
  margin: 0;
  color: var(--read-brand);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.16em;
  line-height: 1.5;
  text-transform: uppercase;
}

.reading-hero h1 {
  margin: 14px 0 18px;
  color: var(--read-ink);
  font-family: var(--vp-font-family-heading);
  font-size: clamp(2.8rem, 5vw, 4.25rem);
  font-weight: 800;
  letter-spacing: -0.045em;
  line-height: 1.04;
}

.reading-title__dot {
  color: var(--read-brand);
}

.reading-hero__desc {
  max-width: 520px;
  margin: 0;
  color: var(--read-muted);
  font-size: 15.5px;
  line-height: 1.9;
}

.reading-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin-top: 30px;
}

.reading-stat {
  display: flex;
  min-width: 120px;
  flex-direction: column;
  gap: 4px;
  padding: 0 26px 0 0;
}

.reading-stat + .reading-stat {
  border-left: 1px solid var(--read-line);
  padding-left: 26px;
}

.reading-stat strong {
  color: var(--read-ink);
  font-family: var(--vp-font-family-heading);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.reading-stat span {
  color: var(--read-faint);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.reading-stack {
  position: relative;
  z-index: 1;
  height: 300px;
  min-width: 0;
}

.reading-stack__halo {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 270px;
  height: 270px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(142, 92, 246, 0.18), transparent 68%);
  filter: blur(4px);
  transform: translate(-50%, -50%);
}

.reading-book {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  width: 166px;
  height: 224px;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid var(--read-line);
  border-radius: 4px 14px 14px 4px;
  padding: 20px 18px;
  box-shadow: 0 20px 46px rgba(35, 24, 60, 0.12);
}

.reading-book::before {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 9px;
  width: 1px;
  background: currentColor;
  content: "";
  opacity: 0.16;
}

.reading-book span {
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  opacity: 0.72;
}

.reading-book b {
  font-family: var(--vp-font-family-heading);
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
  opacity: 0.9;
}

.reading-book--back {
  background: var(--vp-c-bg-soft);
  color: var(--read-faint);
  transform: translate(-70%, -50%) rotate(-10deg);
}

.reading-book--mid {
  background: var(--vp-c-bg);
  color: var(--read-muted);
  transform: translate(-50%, -54%) rotate(1.5deg);
}

.reading-book--front {
  border-color: transparent;
  background: linear-gradient(145deg, var(--vp-c-brand-1), var(--vp-c-brand-2, #ca72ea));
  color: #fff;
  box-shadow: 0 24px 54px rgba(120, 64, 190, 0.28);
  transform: translate(-31%, -46%) rotate(9deg);
}

.reading-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(258px, 0.5fr);
  gap: 56px;
  padding-top: 46px;
}

.reading-shelf {
  min-width: 0;
}

.reading-section-head {
  margin-bottom: 24px;
}

.reading-section-head h2,
.reading-aside h2 {
  margin: 8px 0 10px;
  color: var(--read-ink);
  font-family: var(--vp-font-family-heading);
  font-size: 30px;
  font-weight: 750;
  letter-spacing: -0.035em;
  line-height: 1.2;
}

.reading-section-head > p:last-child {
  margin: 0;
  color: var(--read-muted);
  font-size: 14px;
  line-height: 1.8;
}

.reading-card {
  display: block;
  padding: 20px 22px 21px;
  border: 1px solid var(--read-line);
  border-radius: 16px;
  background: var(--vp-c-bg);
  color: inherit;
  text-decoration: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.reading-card + .reading-card {
  margin-top: 12px;
}

.reading-card:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 12px 30px rgba(70, 45, 110, 0.09);
  transform: translateY(-2px);
}

.reading-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.reading-card__top time {
  color: var(--read-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  letter-spacing: 0.03em;
}

.reading-card__arrow {
  color: var(--read-brand);
  font-size: 16px;
  line-height: 1;
}

.reading-card h3 {
  margin: 9px 0 0;
  color: var(--read-ink);
  font-family: var(--vp-font-family-heading);
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.45;
}

.reading-card__excerpt {
  display: -webkit-box;
  overflow: hidden;
  margin: 8px 0 0;
  color: var(--read-muted);
  font-size: 13.5px;
  line-height: 1.75;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.reading-empty {
  padding: 38px 28px 40px;
  border: 1px dashed var(--read-line);
  border-radius: 20px;
  background:
    radial-gradient(ellipse at 50% 0%, rgba(142, 92, 246, 0.08), transparent 64%),
    var(--vp-c-bg-soft);
  text-align: center;
}

.reading-empty__mark {
  display: flex;
  height: 70px;
  align-items: flex-end;
  justify-content: center;
  gap: 7px;
  margin-bottom: 16px;
}

.reading-empty__mark span {
  display: block;
  width: 15px;
  border-radius: 4px 4px 2px 2px;
  background: var(--read-line);
}

.reading-empty__mark span:nth-child(1) {
  height: 46px;
  background: color-mix(in srgb, var(--vp-c-brand-1) 26%, var(--vp-c-bg-soft));
}

.reading-empty__mark span:nth-child(2) {
  height: 62px;
  background: color-mix(in srgb, var(--vp-c-brand-1) 48%, var(--vp-c-bg-soft));
}

.reading-empty__mark span:nth-child(3) {
  height: 52px;
  background: color-mix(in srgb, var(--vp-c-brand-1) 36%, var(--vp-c-bg-soft));
}

.reading-empty h3 {
  margin: 8px 0 8px;
  color: var(--read-ink);
  font-family: var(--vp-font-family-heading);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.reading-empty > p:last-child {
  max-width: 430px;
  margin: 0 auto;
  color: var(--read-muted);
  font-size: 13.5px;
  line-height: 1.85;
}

.reading-aside {
  align-self: start;
  border-left: 1px solid var(--read-line);
  padding-left: 32px;
}

.reading-aside h2 {
  font-size: 27px;
}

.reading-principles {
  display: grid;
  gap: 22px;
  margin: 26px 0 0;
  padding: 0;
  list-style: none;
}

.reading-principles li {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 12px;
}

.reading-principles li > span {
  padding-top: 2px;
  color: var(--read-brand);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
}

.reading-principles h3 {
  margin: 0 0 5px;
  color: var(--read-ink);
  font-size: 14.5px;
  font-weight: 650;
  line-height: 1.5;
}

.reading-principles p {
  margin: 0;
  color: var(--read-muted);
  font-size: 13px;
  line-height: 1.75;
}

.reading-aside blockquote {
  margin: 28px 0 0;
  border-left: 2px solid var(--vp-c-brand-1);
  padding: 2px 0 2px 16px;
  color: var(--read-muted);
  font-family: var(--vp-font-family-heading);
  font-size: 14px;
  line-height: 1.8;
}

.reading-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 54px;
  border-top: 1px solid var(--read-line);
  padding-top: 20px;
}

.reading-back {
  color: var(--read-ink);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.reading-back span {
  display: inline-block;
  margin-left: 5px;
  color: var(--read-brand);
  transition: transform 0.2s ease;
}

.reading-back:hover span {
  transform: translateX(4px);
}

.reading-footer__note {
  color: var(--read-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
}

@media (max-width: 960px) {
  .reading-hero {
    grid-template-columns: 1fr;
    min-height: 0;
    gap: 0;
    padding-top: 28px;
  }

  .reading-stack {
    display: none;
  }

  .reading-grid {
    grid-template-columns: 1fr;
    gap: 42px;
  }

  .reading-aside {
    border-top: 1px solid var(--read-line);
    border-left: 0;
    padding-top: 32px;
    padding-left: 0;
  }

  .reading-principles {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
  }

  .reading-principles li {
    grid-template-columns: 1fr;
    gap: 5px;
  }
}

@media (max-width: 640px) {
  .reading-page {
    padding-bottom: 44px;
  }

  .reading-hero {
    padding: 20px 0 36px;
  }

  .reading-hero h1 {
    margin-top: 12px;
    font-size: clamp(2.6rem, 11vw, 3.4rem);
  }

  .reading-hero__desc {
    font-size: 14.5px;
    line-height: 1.85;
  }

  .reading-stats {
    margin-top: 24px;
  }

  .reading-stat {
    min-width: 0;
    flex: 1 1 0;
    padding-right: 16px;
  }

  .reading-stat + .reading-stat {
    padding-left: 16px;
  }

  .reading-stat strong {
    font-size: 20px;
  }

  .reading-grid {
    padding-top: 34px;
  }

  .reading-section-head h2,
  .reading-aside h2 {
    font-size: 25px;
  }

  .reading-principles {
    grid-template-columns: 1fr;
    gap: 20px;
    margin-top: 20px;
  }

  .reading-card {
    padding: 18px 18px 19px;
    border-radius: 14px;
  }

  .reading-card h3 {
    font-size: 18px;
  }

  .reading-empty {
    padding: 30px 20px 32px;
  }

  .reading-footer {
    margin-top: 40px;
  }
}

@media (max-width: 360px) {
  .reading-hero h1 {
    font-size: 2.45rem;
  }

  .reading-stat strong {
    font-size: 18px;
  }

  .reading-card__top time {
    font-size: 10px;
  }

  .reading-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reading-card,
  .reading-back span {
    transition: none;
  }
}
</style>
