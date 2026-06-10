<!-- ThumbnailView — 异步加载图片缩略图 -->
<script setup lang="ts">
import { ref, watch } from 'vue'

export interface FileEntry {
  name: string
  ext: string
}

const props = defineProps<{
  entry: FileEntry
  getThumb: (entry: FileEntry) => Promise<string | null>
}>()

const url = ref<string | null>(null)

watch(
  () => props.entry,
  async (entry) => {
    url.value = await props.getThumb(entry)
  },
  { immediate: true }
)
</script>

<template>
  <div class="thumb-wrapper">
    <img v-if="url" :src="url" :alt="entry.name" class="thumb-img" />
    <div v-else class="thumb-placeholder">
      <span>🖼️</span>
    </div>
  </div>
</template>

<style scoped>
.thumb-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  background-color: var(--ev-c-gray-3);
  border-radius: 8px;
}
</style>
