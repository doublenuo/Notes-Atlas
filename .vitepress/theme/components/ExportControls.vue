<script setup>
import { computed, ref } from 'vue';
import { useRoute } from 'vitepress';
import { makeHtmlDocument, toSafeFileName } from '../utils/export.mjs';

const route = useRoute();
const loading = ref(false);
const visible = computed(() => route.path !== '/');

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
}

function exportHtml() {
  const content = document.querySelector('.vp-doc');
  if (!content) return;
  const title = document.title || 'Notes-Atlas';
  const html = makeHtmlDocument(title, content.innerHTML);
  const name = toSafeFileName(route.path);
  downloadBlob(html, `${name}.html`, 'text/html;charset=utf-8');
}

function exportPdf() {
  const content = document.querySelector('.vp-doc');
  if (!content) return;

  const title = document.title || 'Notes-Atlas';
  const html = makeHtmlDocument(title, content.innerHTML);
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function handleExport(action) {
  loading.value = true;
  try {
    action();
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div v-if="visible" class="notes-export">
    <button type="button" :disabled="loading" @click="handleExport(exportPdf)">
      导出 PDF
    </button>
    <button type="button" :disabled="loading" @click="handleExport(exportHtml)">
      导出 HTML
    </button>
  </div>
</template>

