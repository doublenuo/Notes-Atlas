<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import type { Connections, NoteRef } from '../../plugins/knowledgeGraph'

const { page } = useData()

const isArticle = computed(() => {
  const frontmatter = page.value.frontmatter
  return frontmatter.article !== false
    && (frontmatter.layout === undefined || frontmatter.layout === 'doc')
})

// transformPageData 注入的字段不在 PageData 官方类型里，集中在这里断言一次
const connections = computed<Connections>(() =>
  (page.value as unknown as { connections?: Connections }).connections
  ?? { backlinks: [], related: [] },
)

const related = computed(() => (isArticle.value ? connections.value.related : []))
const backlinks = computed(() => (isArticle.value ? connections.value.backlinks : []))
const visibleBacklinks = computed(() => backlinks.value.slice(0, 5))
const restBacklinks = computed(() => backlinks.value.slice(5))

const hrefOf = (item: NoteRef) => withBase(item.url)
</script>

<template>
  <nav v-if="related.length || backlinks.length" class="na-knowledge" aria-label="知识网络">
    <section v-if="related.length" class="na-knowledge__section">
      <h2 class="na-knowledge__title">相关笔记</h2>
      <ul class="na-knowledge__list">
        <li v-for="item in related" :key="item.rel" class="na-knowledge__item">
          <a class="na-knowledge__link" :href="hrefOf(item)">{{ item.title }}</a>
          <span class="na-knowledge__meta">
            {{ item.section }}<template v-if="item.section && item.reason"> · </template>{{ item.reason }}
          </span>
        </li>
      </ul>
    </section>

    <section v-if="backlinks.length" class="na-knowledge__section">
      <h2 class="na-knowledge__title">
        被引用 <span class="na-knowledge__count">· {{ backlinks.length }}</span>
      </h2>
      <ul class="na-knowledge__list">
        <li v-for="item in visibleBacklinks" :key="item.rel" class="na-knowledge__item">
          <a class="na-knowledge__link" :href="hrefOf(item)">{{ item.title }}</a>
          <span v-if="item.section" class="na-knowledge__meta">{{ item.section }}</span>
        </li>
      </ul>
      <details v-if="restBacklinks.length" class="na-knowledge__more">
        <summary>展开其余 {{ restBacklinks.length }} 篇</summary>
        <ul class="na-knowledge__list">
          <li v-for="item in restBacklinks" :key="item.rel" class="na-knowledge__item">
            <a class="na-knowledge__link" :href="hrefOf(item)">{{ item.title }}</a>
            <span v-if="item.section" class="na-knowledge__meta">{{ item.section }}</span>
          </li>
        </ul>
      </details>
    </section>
  </nav>
</template>

<style scoped>
.na-knowledge {
  display: grid;
  gap: 24px;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid var(--vp-c-divider);
}

.na-knowledge__title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.na-knowledge__count {
  font-size: 13px;
  font-weight: 400;
  color: var(--vp-c-text-3);
}

.na-knowledge__list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.na-knowledge__item {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: baseline;
  font-size: 14px;
  line-height: 1.6;
}

.na-knowledge__link {
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.na-knowledge__link:hover {
  text-decoration: underline;
}

.na-knowledge__meta {
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.na-knowledge__more {
  margin-top: 8px;
  font-size: 13px;
}

.na-knowledge__more summary {
  color: var(--vp-c-text-2);
  cursor: pointer;
}
</style>
