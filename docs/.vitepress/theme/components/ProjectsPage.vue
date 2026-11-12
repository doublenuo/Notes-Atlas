<script setup lang="ts">
import { computed } from "vue";
import { withBase } from "vitepress";
import { usePosts } from "vitepress-theme-teek";

type ProjectFrontmatter = {
  description?: string;
  stack?: string[] | string;
  status?: string;
};

type ProjectPost = {
  title?: string;
  url?: string;
  date?: string;
  capture?: string;
  relativePath?: string;
  frontmatter?: ProjectFrontmatter;
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
  return plain.length > 96 ? `${plain.slice(0, 96)}…` : plain;
};

const summary = (project: ProjectPost) => excerpt(project.frontmatter?.description || project.capture);

const projectTags = (project: ProjectPost) => {
  const stack = project.frontmatter?.stack;
  const list = Array.isArray(stack) ? stack : typeof stack === "string" ? stack.split(/[,，/|]/) : [];
  return list.map((item) => item.trim()).filter(Boolean).slice(0, 4);
};

const projects = computed<ProjectPost[]>(() => {
  const list = (posts.value?.sortPostsByDate ?? []) as ProjectPost[];
  return list
    .filter((post) => {
      const path = (post.relativePath ?? "").replace(/^\/+/, "");
      return path.startsWith("05.项目实践/") && !path.endsWith("/index.md");
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
});

const projectCount = computed(() => projects.value.length);
const latestLabel = computed(() => (projects.value[0]?.date ? formatDate(projects.value[0].date) : "—"));
const materialHref = withBase("/material-intro");
const currentYear = new Date().getFullYear();

const projectHref = (project: ProjectPost) => (project.url ? withBase(project.url) : materialHref);
</script>

<template>
  <div class="projects-page" data-pagefind-body>
    <section class="projects-hero" aria-labelledby="projects-title">
      <div class="projects-hero__copy">
        <p class="projects-kicker">PROJECTS · 项目实践</p>
        <h1 id="projects-title">项目实践<span class="projects-title__dot">.</span></h1>
        <p class="projects-hero__desc">
          把想法做成能跑的东西。这里记录项目的过程、取舍，以及最后真正留下来的部分。
        </p>
        <div class="projects-stats">
          <div class="projects-stat">
            <strong>{{ projectCount }}</strong>
            <span>个项目</span>
          </div>
          <div class="projects-stat">
            <strong>{{ latestLabel }}</strong>
            <span>最近更新</span>
          </div>
        </div>
        <div class="projects-tags" aria-label="关注方向">
          <span>强化学习</span>
          <span>机器人</span>
          <span>具身智能</span>
          <span>工程实现</span>
        </div>
      </div>

      <div class="projects-visual" aria-hidden="true" data-pagefind-ignore>
        <div class="projects-blueprint"></div>
        <div class="projects-board">
          <div class="projects-board__bar">
            <span>BUILD LOG / WENO</span>
            <span class="projects-board__dots"><i></i><i></i><i></i></span>
          </div>
          <div class="projects-board__body">
            <p class="projects-board__prompt"><b>$</b> make it work</p>
            <div class="projects-board__flow">
              <span>IDEA</span>
              <b>→</b>
              <span>BUILD</span>
              <b>→</b>
              <span>LOG</span>
            </div>
            <ul class="projects-board__steps">
              <li><em>01</em><span>problem</span><i></i></li>
              <li><em>02</em><span>prototype</span><i></i></li>
              <li><em>03</em><span>reflection</span><i></i></li>
            </ul>
            <p class="projects-board__status"><i></i>READY WHEN IT RUNS</p>
          </div>
        </div>
        <div class="projects-board__shadow"></div>
      </div>
    </section>

    <div class="projects-grid">
      <section class="projects-archive" aria-labelledby="projects-archive-title">
        <header class="projects-section-head">
          <p class="projects-kicker">THE LAB</p>
          <h2 id="projects-archive-title">项目档案</h2>
          <p>正在做的、做完的，都按时间放在这里。</p>
        </header>

        <div v-if="projects.length" class="projects-list">
          <a
            v-for="(project, index) in projects"
            :key="project.url || project.title"
            class="project-card"
            :href="projectHref(project)"
            :aria-label="project.title ? `项目：${project.title}` : '项目记录'"
          >
            <div class="project-card__top">
              <span class="project-card__num">{{ String(index + 1).padStart(2, "0") }}</span>
              <time :datetime="project.date">{{ formatDate(project.date) }}</time>
              <span class="project-card__arrow" aria-hidden="true">↗</span>
            </div>
            <div class="project-card__body">
              <div class="project-card__heading">
                <h3>{{ project.title || "未命名项目" }}</h3>
                <span v-if="project.frontmatter?.status" class="project-card__status">
                  {{ project.frontmatter.status }}
                </span>
              </div>
              <p v-if="summary(project)" class="project-card__excerpt">{{ summary(project) }}</p>
              <ul v-if="projectTags(project).length" class="project-card__tags" aria-label="技术栈">
                <li v-for="tag in projectTags(project)" :key="tag">{{ tag }}</li>
              </ul>
            </div>
          </a>
        </div>

        <div v-else class="projects-empty">
          <div class="projects-empty__mark" aria-hidden="true">&gt;_</div>
          <p class="projects-kicker">NO BUILDS YET</p>
          <h3>工作台还空着</h3>
          <p>项目还在整理。等第一个能跑起来的结果落地，这里会留下它的过程。</p>
          <a class="projects-empty__link" :href="materialHref">先看看组会材料 <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <aside class="projects-aside">
        <p class="projects-kicker">PRINCIPLES</p>
        <h2>我怎么做<br />项目</h2>
        <ol class="projects-principles">
          <li>
            <span>01</span>
            <div>
              <h3>先跑起来，再整理</h3>
              <p>先做能运行的最小版本，再补结构和文档。</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>把失败也留下</h3>
              <p>报错、取舍和没走通的路，往往比结果更有用。</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>让结果可复现</h3>
              <p>命令、环境和参数尽量写清楚，让下一次能重新跑。</p>
            </div>
          </li>
        </ol>
        <blockquote>“项目不是作品集，是把想法逼到能运行的地方。”</blockquote>
      </aside>
    </div>

    <footer class="projects-footer">
      <a class="projects-back" :href="materialHref">看看组会材料 <span aria-hidden="true">→</span></a>
      <span class="projects-footer__note">PROJECTS · {{ currentYear }}</span>
    </footer>
  </div>
</template>

<style scoped>
.projects-page {
  --pj-ink: var(--vp-c-text-1);
  --pj-muted: var(--vp-c-text-2);
  --pj-faint: var(--vp-c-text-3);
  --pj-line: var(--vp-c-divider);
  --pj-soft: var(--vp-c-bg-soft);
  --pj-brand: var(--vp-c-brand-1);
  --pj-terminal: #17151f;
  position: relative;
  isolation: isolate;
  max-width: 1160px;
  margin: 0 auto;
  padding: 12px 20px 56px;
  overflow-x: clip;
  color: var(--pj-ink);
}

.projects-page::before {
  content: "";
  position: absolute;
  z-index: -1;
  top: -30px;
  left: 50%;
  width: 100vw;
  height: 520px;
  transform: translateX(-50%);
  pointer-events: none;
  background-image:
    linear-gradient(rgba(109, 92, 255, 0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(109, 92, 255, 0.055) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: linear-gradient(180deg, #000 0%, transparent 82%);
}

.projects-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
  gap: 54px;
  align-items: center;
  min-height: 370px;
  padding: 34px 0 50px;
  border-bottom: 1px solid var(--pj-line);
}

.projects-kicker {
  margin: 0;
  color: var(--pj-brand);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.17em;
  line-height: 1.5;
}

.projects-hero h1 {
  margin: 12px 0 0;
  color: var(--pj-ink);
  font-size: clamp(3.1rem, 5.2vw, 4.4rem);
  font-weight: 760;
  letter-spacing: -0.055em;
  line-height: 1.02;
}

.projects-title__dot {
  color: var(--pj-brand);
}

.projects-hero__desc {
  max-width: 510px;
  margin: 24px 0 0;
  color: var(--pj-muted);
  font-size: 1.02rem;
  line-height: 1.85;
}

.projects-stats {
  display: flex;
  gap: 28px;
  margin-top: 32px;
}

.projects-stat {
  display: flex;
  min-width: 108px;
  flex-direction: column;
  gap: 7px;
  padding-right: 28px;
  border-right: 1px solid var(--pj-line);
}

.projects-stat:last-child {
  padding-right: 0;
  border-right: 0;
}

.projects-stat strong {
  color: var(--pj-ink);
  font-size: 1.3rem;
  font-weight: 750;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.projects-stat span {
  color: var(--pj-faint);
  font-size: 0.78rem;
}

.projects-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 26px;
}

.projects-tags span {
  padding: 5px 10px;
  border: 1px solid var(--pj-line);
  border-radius: 999px;
  color: var(--pj-muted);
  font-size: 0.72rem;
  line-height: 1.3;
}

.projects-visual {
  position: relative;
  min-height: 330px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.projects-blueprint {
  position: absolute;
  inset: 26px 10px 24px;
  border: 1px dashed color-mix(in srgb, var(--pj-brand) 28%, transparent);
  border-radius: 22px;
  background:
    linear-gradient(90deg, transparent 49.6%, rgba(109, 92, 255, 0.1) 49.8%, rgba(109, 92, 255, 0.1) 50.2%, transparent 50.4%),
    linear-gradient(0deg, transparent 49.6%, rgba(109, 92, 255, 0.1) 49.8%, rgba(109, 92, 255, 0.1) 50.2%, transparent 50.4%);
  transform: rotate(-2.5deg);
}

.projects-board {
  position: relative;
  z-index: 2;
  width: min(336px, 88%);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 17px;
  background: var(--pj-terminal);
  box-shadow:
    0 26px 56px rgba(24, 18, 58, 0.22),
    0 2px 0 rgba(255, 255, 255, 0.05) inset;
  transform: rotate(1.6deg);
}

.projects-board__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 35px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.54);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
}

.projects-board__dots {
  display: flex;
  gap: 5px;
}

.projects-board__dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.23);
}

.projects-board__dots i:first-child {
  background: #7c6bff;
}

.projects-board__body {
  padding: 19px 17px 17px;
  color: #eeeafc;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.projects-board__prompt {
  margin: 0;
  color: #b2a9ff;
  font-size: 0.78rem;
}

.projects-board__prompt b {
  color: #79d8b1;
  font-weight: 600;
}

.projects-board__flow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 18px;
  padding: 11px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 9px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.64rem;
  letter-spacing: 0.05em;
}

.projects-board__flow b {
  color: rgba(255, 255, 255, 0.28);
  font-size: 0.75rem;
}

.projects-board__steps {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin: 17px 0 0;
  padding: 0;
  list-style: none;
}

.projects-board__steps li {
  display: grid;
  grid-template-columns: 24px 1fr 46px;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.66rem;
}

.projects-board__steps em {
  color: rgba(255, 255, 255, 0.34);
  font-style: normal;
}

.projects-board__steps i {
  display: block;
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, #7c6bff, rgba(124, 107, 255, 0.12));
}

.projects-board__steps li:nth-child(2) i {
  width: 70%;
}

.projects-board__steps li:nth-child(3) i {
  width: 42%;
}

.projects-board__status {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 18px 0 0;
  color: #79d8b1;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
}

.projects-board__status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #79d8b1;
  box-shadow: 0 0 0 4px rgba(121, 216, 177, 0.12);
}

.projects-board__shadow {
  position: absolute;
  z-index: 1;
  bottom: 29px;
  width: 240px;
  height: 32px;
  border-radius: 50%;
  background: rgba(36, 25, 85, 0.2);
  filter: blur(18px);
  transform: rotate(1.6deg);
}

.projects-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(230px, 0.7fr);
  gap: 52px;
  padding: 48px 0 0;
}

.projects-section-head {
  margin-bottom: 26px;
}

.projects-section-head h2,
.projects-aside h2 {
  margin: 8px 0 0;
  color: var(--pj-ink);
  font-size: 2.2rem;
  font-weight: 750;
  letter-spacing: -0.045em;
  line-height: 1.1;
}

.projects-section-head > p:last-child {
  margin: 11px 0 0;
  color: var(--pj-muted);
  font-size: 0.92rem;
  line-height: 1.75;
}

.projects-list {
  display: grid;
  gap: 12px;
}

.project-card {
  display: block;
  padding: 19px 20px 20px;
  border: 1px solid var(--pj-line);
  border-radius: 14px;
  background: var(--vp-c-bg);
  color: inherit;
  text-decoration: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.project-card:hover {
  border-color: color-mix(in srgb, var(--pj-brand) 42%, var(--pj-line));
  box-shadow: 0 12px 28px rgba(34, 24, 82, 0.07);
  transform: translateY(-2px);
}

.project-card__top {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--pj-faint);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.7rem;
}

.project-card__num {
  color: var(--pj-brand);
}

.project-card__arrow {
  margin-left: auto;
  color: var(--pj-brand);
  font-size: 1rem;
}

.project-card__body {
  margin-top: 12px;
}

.project-card__heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px;
}

.project-card h3 {
  margin: 0;
  color: var(--pj-ink);
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.4;
}

.project-card__status {
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--pj-brand) 10%, transparent);
  color: var(--pj-brand);
  font-size: 0.65rem;
  line-height: 1.5;
}

.project-card__excerpt {
  margin: 8px 0 0;
  color: var(--pj-muted);
  font-size: 0.86rem;
  line-height: 1.75;
}

.project-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.project-card__tags li {
  padding: 3px 7px;
  border: 1px solid var(--pj-line);
  border-radius: 4px;
  color: var(--pj-faint);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.65rem;
}

.projects-empty {
  display: flex;
  min-height: 300px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 38px 24px;
  border: 1px dashed color-mix(in srgb, var(--pj-brand) 24%, var(--pj-line));
  border-radius: 16px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--pj-brand) 4%, transparent), transparent 58%),
    var(--vp-c-bg-soft);
  text-align: center;
}

.projects-empty__mark {
  display: grid;
  width: 66px;
  height: 66px;
  margin-bottom: 17px;
  place-items: center;
  border: 1px dashed color-mix(in srgb, var(--pj-brand) 35%, var(--pj-line));
  border-radius: 15px;
  background: color-mix(in srgb, var(--pj-brand) 7%, transparent);
  color: var(--pj-brand);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 1.35rem;
  letter-spacing: -0.08em;
}

.projects-empty h3 {
  margin: 12px 0 0;
  color: var(--pj-ink);
  font-size: 1.22rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.projects-empty > p:not(.projects-kicker) {
  max-width: 420px;
  margin: 9px 0 0;
  color: var(--pj-muted);
  font-size: 0.88rem;
  line-height: 1.8;
}

.projects-empty__link,
.projects-back {
  color: var(--pj-brand);
  font-size: 0.86rem;
  font-weight: 600;
  text-decoration: none;
}

.projects-empty__link {
  margin-top: 18px;
}

.projects-empty__link span,
.projects-back span {
  display: inline-block;
  transition: transform 0.2s ease;
}

.projects-empty__link:hover span,
.projects-back:hover span {
  transform: translateX(3px);
}

.projects-aside {
  padding-top: 2px;
}

.projects-aside h2 {
  font-size: 1.9rem;
}

.projects-principles {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin: 24px 0 0;
  padding: 0;
  list-style: none;
}

.projects-principles li {
  display: grid;
  grid-template-columns: 26px 1fr;
  gap: 10px;
}

.projects-principles li > span {
  padding-top: 2px;
  color: var(--pj-brand);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.65rem;
}

.projects-principles h3 {
  margin: 0;
  color: var(--pj-ink);
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.5;
}

.projects-principles p {
  margin: 4px 0 0;
  color: var(--pj-muted);
  font-size: 0.78rem;
  line-height: 1.75;
}

.projects-aside blockquote {
  margin: 27px 0 0;
  padding: 0 0 0 15px;
  border-left: 2px solid var(--pj-brand);
  color: var(--pj-muted);
  font-size: 0.82rem;
  line-height: 1.8;
}

.projects-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 52px;
  padding-top: 18px;
  border-top: 1px solid var(--pj-line);
}

.projects-footer__note {
  color: var(--pj-faint);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.64rem;
  letter-spacing: 0.08em;
}

@media (max-width: 960px) {
  .projects-hero {
    grid-template-columns: minmax(0, 1fr);
    gap: 22px;
    min-height: 0;
    padding-top: 24px;
  }

  .projects-visual {
    min-height: 300px;
    margin-top: -4px;
  }

  .projects-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 34px;
    padding-top: 38px;
  }

  .projects-aside {
    padding-top: 24px;
    border-top: 1px solid var(--pj-line);
  }

  .projects-principles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px 24px;
  }
}

@media (max-width: 640px) {
  .projects-page {
    padding-bottom: 44px;
  }

  .projects-hero h1 {
    font-size: clamp(2.45rem, 11vw, 3.2rem);
  }

  .projects-hero__desc {
    margin-top: 18px;
    font-size: 0.94rem;
    line-height: 1.8;
  }

  .projects-stats {
    gap: 20px;
    margin-top: 26px;
  }

  .projects-stat {
    min-width: 0;
    padding-right: 20px;
  }

  .projects-stat strong {
    font-size: 1.16rem;
  }

  .projects-tags {
    margin-top: 20px;
  }

  .projects-visual {
    min-height: 250px;
  }

  .projects-board {
    width: min(296px, 94%);
  }

  .projects-blueprint {
    inset: 20px 4px 16px;
  }

  .projects-section-head h2 {
    font-size: 1.85rem;
  }

  .projects-aside h2 {
    font-size: 1.65rem;
  }

  .projects-empty {
    min-height: 260px;
    padding: 30px 18px;
  }

  .projects-principles {
    grid-template-columns: minmax(0, 1fr);
  }

  .projects-footer {
    margin-top: 38px;
    padding-right: 38px;
  }
}

@media (max-width: 360px) {
  .projects-hero h1 {
    font-size: 2.25rem;
  }

  .projects-stat strong {
    font-size: 1.02rem;
  }

  .projects-board {
    transform: rotate(0deg);
  }

  .projects-empty h3 {
    font-size: 1.08rem;
  }
}

html.dark .projects-page {
  --pj-terminal: #121019;
}

html.dark .projects-page .projects-board {
  border-color: rgba(255, 255, 255, 0.13);
  box-shadow:
    0 26px 56px rgba(0, 0, 0, 0.42),
    0 1px 0 rgba(255, 255, 255, 0.06) inset;
}

html.dark .projects-page .project-card {
  background: var(--vp-c-bg-soft);
}
</style>
