<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isCollapsed = ref(false)

const navItems = [
  { path: '/', icon: '🏠', label: '首页' },
  { path: '/settings', icon: '⚙️', label: '设置' }
]

const activeRoute = computed(() => route.path)

function toggleCollapse(): void {
  isCollapsed.value = !isCollapsed.value
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: isCollapsed }">
    <div class="sidebar-header">
      <router-link to="/" class="sidebar-logo" v-show="!isCollapsed">
        <span class="logo-icon">🐾</span>
        <span class="logo-text">桌宠</span>
      </router-link>
      <router-link to="/" class="sidebar-logo collapsed-logo" v-show="isCollapsed">
        <span class="logo-icon">🐾</span>
      </router-link>
    </div>

    <nav class="sidebar-nav">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: activeRoute === item.path }"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span class="nav-label" v-show="!isCollapsed">{{ item.label }}</span>
      </router-link>
    </nav>

    <div class="sidebar-footer">
      <button class="collapse-btn" @click="toggleCollapse" :title="isCollapsed ? '展开' : '收起'">
        <span class="collapse-icon">{{ isCollapsed ? '▶' : '◀' }}</span>
        <span class="nav-label" v-show="!isCollapsed">收起</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 200px;
  min-width: 200px;
  height: 100vh;
  background-color: var(--ev-c-black-soft);
  border-right: 1px solid var(--ev-c-gray-3);
  transition: width 0.25s ease, min-width 0.25s ease;
  overflow: hidden;
  user-select: none;
}

.sidebar.collapsed {
  width: 60px;
  min-width: 60px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  border-bottom: 1px solid var(--ev-c-gray-3);
  flex-shrink: 0;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.15s;
}

.sidebar-logo:hover {
  opacity: 0.75;
}

.logo-icon {
  font-size: 24px;
  line-height: 1;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: var(--ev-c-text-1);
  white-space: nowrap;
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px 8px;
  gap: 4px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--ev-c-text-2);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.15s, color 0.15s;
  cursor: pointer;
  white-space: nowrap;
}

.nav-item:hover {
  background-color: var(--ev-c-gray-3);
  color: var(--ev-c-text-1);
}

.nav-item.active {
  background-color: var(--ev-c-gray-2);
  color: var(--ev-c-text-1);
}

.nav-icon {
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
}

.nav-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-footer {
  border-top: 1px solid var(--ev-c-gray-3);
  padding: 8px;
  flex-shrink: 0;
}

.collapse-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ev-c-text-2);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.collapse-btn:hover {
  background-color: var(--ev-c-gray-3);
  color: var(--ev-c-text-1);
}

.collapse-icon {
  font-size: 12px;
  line-height: 1;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
}
</style>
