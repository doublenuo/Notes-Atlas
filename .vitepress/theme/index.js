import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import ExportControls from './components/ExportControls.vue';
import LastUpdatedLabel from './components/LastUpdatedLabel.vue';
import OthersProtectedNotice from './components/OthersProtectedNotice.vue';
import './styles.css';
import '../../static/css/custom.css';
import 'katex/dist/katex.min.css';

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'doc-before': () => [
        h(OthersProtectedNotice),
        h(LastUpdatedLabel),
        h(ExportControls)
      ]
    });
  }
};

