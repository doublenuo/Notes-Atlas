<script setup lang="ts" name="ContributeChart">
import { ref, watch, nextTick, computed, useTemplateRef, onMounted, onBeforeUnmount } from "vue";
import { useData } from "vitepress";
import { formatDate, usePosts, useIntersectionObserver } from "vitepress-theme-teek";

const { isDark } = useData();
const posts = usePosts();

// 今天
const today = formatDate(new Date(), "yyyy-MM-dd");
// 获取一年前的时间
const beforeOnYear = formatDate(new Date(new Date().getTime() - 364 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
// 手机端只展示最近半年：一年 53 列在 390px 宽度下每格不足 6px，
// 既看不清也会撑出横向滚动，半年 26 列可以用 10px 格子完整放下。
const beforeHalfYear = formatDate(new Date(new Date().getTime() - 182 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

// 贡献图数据
const contributeList = computed(() => {
  const contributeObject = ref({});

  posts.value.sortPostsByDate.forEach(item => {
    if (!item.date) return;

    const date = item.date.substring(0, 10);
    if (contributeObject.value[date]) contributeObject.value[date]++;
    else contributeObject.value[date] = 1;
  });

  const contributeDays = Object.keys(contributeObject.value);

  return contributeDays.map((item: string) => [item, contributeObject.value[item]]).reverse();
});

const chartRef = useTemplateRef("chartRef");
const contributeChart = ref();

const { create } = useIntersectionObserver(
  chartRef,
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // 使用 requestAnimationFrame 确保在下一帧执行
        requestAnimationFrame(() => {
          try {
            renderChart(contributeList.value);
          } catch (error) {
            console.error("初始化动画失败:", error);
          }
        });
      }
    });
  },
  0.1
);

// Echarts 配置项
const option = {
  tooltip: {
    formatter: function (params) {
      return `${params.value[0]} <br/> ${params.value[1]} 篇文章`;
    },
  },
  visualMap: {
    show: false,
    min: 0,
    max: 5,
    inRange: {
      color: ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127", "#196127"],
    },
  },
  calendar: {
    left: "center",
    itemStyle: {
      color: "#ebedf0",
      borderWidth: 5,
      borderColor: "#fff",
      shadowBlur: 0,
    },
    cellSize: [20, 20],
    range: [beforeOnYear, today],
    splitLine: true,
    dayLabel: {
      show: true,
      firstDay: 7,
      nameMap: "ZH",
      color: "#3c3c43",
      fontSize: 12,
      margin: 8,
    },
    monthLabel: {
      color: "#3c3c43",
      fontSize: 12,
      margin: 8,
    },
    yearLabel: {
      show: true,
      position: "right",
    },
    silent: {
      show: false,
    },
  },
  series: {
    type: "heatmap",
    coordinateSystem: "calendar",
    data: [],
  },
};

// ECharts 模块引用（动态加载）
let echartsModule: any = null;

// 动态按需加载 ECharts（仅首屏可见时加载，减少初始包体积 ~1MB）
const loadECharts = async () => {
  if (!echartsModule) {
    echartsModule = await import("echarts");
  }
  return echartsModule;
};

// 渲染贡献图
const renderChart = async (data: any) => {
  const echarts = await loadECharts();

  // 按容器宽度自适应：手机端半年 + 小格子；宽屏按可用宽度分摊 53 列，
  // 避免再靠固定 1220px 页面宽度来迁就日历（那会让手机整页横向溢出）。
  const chartWidth = chartRef.value?.clientWidth ?? 0;
  const compact = chartWidth > 0 && chartWidth < 640;
  const cellSize = compact
    ? Math.max(6, Math.min(14, Math.floor((chartWidth - 40) / 26)))
    : Math.max(12, Math.min(20, Math.floor((chartWidth - 80) / 53)));

  option.calendar.range = [compact ? beforeHalfYear : beforeOnYear, today];
  option.calendar.cellSize = [cellSize, cellSize];
  option.calendar.itemStyle.borderWidth = compact ? 2 : cellSize >= 18 ? 5 : 3;
  option.calendar.yearLabel.show = !compact;
  option.calendar.itemStyle.borderColor = isDark.value ? "#1b1b1f" : "#fff";
  option.calendar.itemStyle.color = isDark.value ? "#787878" : "#ebedf0";
  // 手机端 10px 格高放不下 7 个完整星期标签，隐藏星期标签，保留月份轴
  option.calendar.dayLabel.show = !compact;
  option.calendar.dayLabel.color = isDark.value ? "#c9c9d1" : "#3c3c43";
  option.calendar.monthLabel.color = isDark.value ? "#c9c9d1" : "#3c3c43";
  option.calendar.monthLabel.fontSize = compact ? (chartWidth < 300 ? 9 : 11) : 12;
  option.calendar.monthLabel.margin = compact ? 4 : 8;

  if (contributeChart.value) echarts.dispose(contributeChart.value);
  if (chartRef.value) contributeChart.value = echarts.init(chartRef.value);

  option.series.data = data;
  contributeChart.value?.setOption(option);
};

watch(
  contributeList,
  async newValue => {
    await nextTick();
    renderChart(newValue);
  },
  { flush: "post" }
);

watch(isDark, async () => {
  await nextTick();
  renderChart(contributeList.value);
});

// 视口变化时重算格子尺寸（去抖，避免拖动窗口时反复 dispose/init ECharts）
let resizeTimer: ReturnType<typeof setTimeout> | undefined;
const handleResize = () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderChart(contributeList.value), 200);
};

onMounted(() => {
  if (chartRef.value) create();
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  if (resizeTimer) clearTimeout(resizeTimer);
});
</script>

<template>
  <div class="contribute__chart">
    <div class="chart__box" ref="chartRef"></div>
  </div>
</template>

<style>
.tk-article-page.tk-archives {
  width: 100%;
  max-width: 1220px;
}

.tk-archives .contribute__chart {
  width: 100%;
  height: 260px;
}

/* 手机端半年视图无需 260px 高，缩短后给下方的归档时间线让位 */
@media (max-width: 768px) {
  .tk-archives .contribute__chart {
    height: 170px;
  }
}

.tk-archives .contribute__chart .chart__box {
  margin: auto;
  width: 100%;
  height: 100%;
}
</style>
