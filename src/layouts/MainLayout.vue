<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />

        <q-toolbar-title> Local Doc Tools </q-toolbar-title>

        <q-space />
        <q-btn flat dense icon="home" label="Home" :to="{ path: '/' }" class="q-mr-sm" />
        <div v-for="tool in toolsList" :key="tool.id" class="q-ml-sm">
          <q-btn
            color="primary"
            unelevated
            :icon="tool.icon"
            :label="tool.label"
            :to="{ name: tool.route.name }"
          />
        </div>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above bordered>
      <q-list>
        <q-item-label header> Navigation </q-item-label>

        <q-item clickable v-ripple :to="{ path: '/' }">
          <q-item-section avatar>
            <q-icon name="home" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Home</q-item-label>
          </q-item-section>
        </q-item>

        <q-item
          v-for="tool in toolsList"
          :key="tool.id"
          clickable
          v-ripple
          :to="{ name: tool.route.name }"
        >
          <q-item-section avatar>
            <q-icon :name="tool.icon" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ tool.label }}</q-item-label>
            <q-item-label v-if="tool.shortDescription" caption>
              {{ tool.shortDescription }}
            </q-item-label>
            <q-item-label caption>
              <q-badge dense outline :color="maturityColor(tool.maturity)">
                {{ maturityLabel(tool.maturity) }}
              </q-badge>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { tools } from 'src/tools'

const leftDrawerOpen = ref(false)
const toolsList = tools

const maturityLabelMap = {
  stable: 'Stable',
  beta: 'Beta',
  experimental: 'Experimental',
} as const

const maturityColorMap = {
  stable: 'positive',
  beta: 'warning',
  experimental: 'grey',
} as const

function maturityLabel(maturity: (typeof toolsList)[number]['maturity']) {
  return maturityLabelMap[maturity]
}

function maturityColor(maturity: (typeof toolsList)[number]['maturity']) {
  return maturityColorMap[maturity]
}

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value
}
</script>

<style scoped>
.maturity-caption {
  font-size: 0.65rem;
}
</style>
