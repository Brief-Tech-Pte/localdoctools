<template>
  <q-page class="q-pa-xl">
    <div class="column items-center q-gutter-xl">
      <div class="text-center" style="max-width: 920px">
        <div class="text-h3 text-weight-bold q-mb-md">
          Local Doc Tools — Private, Fast, In‑Browser
        </div>
        <div class="text-subtitle1 text-grey-7">
          A suite of document tools that run entirely in your browser. No uploads. No servers. Your files never leave your device.
        </div>
        <div class="q-mt-lg">
          <q-btn color="primary" label="Try Word → Markdown" :to="{ name: 'word-to-markdown' }" size="lg" class="q-mr-sm" />
          <q-btn flat color="primary" label="Explore Tools" to="/" @click="scrollToFeatures" size="lg" />
        </div>
      </div>

      <q-card flat bordered class="q-pa-lg q-mt-xl" style="max-width: 1024px; width: 100%">
        <q-card-section>
          <div class="text-h5 text-weight-medium q-mb-md" id="features">Why Local Doc Tools?</div>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-4">
              <q-item>
                <q-item-section avatar>
                  <q-icon name="lock" color="primary" size="md" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-subtitle1 text-weight-medium">Privacy by Design</q-item-label>
                  <q-item-label caption>Your documents never leave your device. All processing is done locally in your browser.</q-item-label>
                </q-item-section>
              </q-item>
            </div>
            <div class="col-12 col-md-4">
              <q-item>
                <q-item-section avatar>
                  <q-icon name="bolt" color="primary" size="md" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-subtitle1 text-weight-medium">Fast & Convenient</q-item-label>
                  <q-item-label caption>Instant results. No waiting for uploads or worrying about connection speed.</q-item-label>
                </q-item-section>
              </q-item>
            </div>
            <div class="col-12 col-md-4">
              <q-item>
                <q-item-section avatar>
                  <q-icon name="open_in_browser" color="primary" size="md" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-subtitle1 text-weight-medium">No Sign‑ups, No Backends</q-item-label>
                  <q-item-label caption>Use powerful tools without creating an account or sending data to any server.</q-item-label>
                </q-item-section>
              </q-item>
            </div>
          </div>
        </q-card-section>

        <q-separator spaced />

        <q-card-section>
          <div class="text-h6 text-weight-medium q-mb-md">Tools (Growing Library)</div>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-4">
              <q-card bordered class="fit">
                <q-card-section>
                  <div class="text-subtitle1 text-weight-medium">Word → Markdown</div>
                  <div class="text-caption text-grey-7">Convert .docx to clean Markdown with images preserved.</div>
                </q-card-section>
                <q-card-actions align="right">
                  <q-btn color="primary" flat label="Open" :to="{ name: 'word-to-markdown' }" />
                </q-card-actions>
              </q-card>
            </div>
            <div class="col-12 col-md-4">
              <q-card bordered class="fit">
                <q-card-section>
                  <div class="text-subtitle1 text-weight-medium">PDF Tools</div>
                  <div class="text-caption text-grey-7">Split, merge, compress (coming soon).</div>
                </q-card-section>
                <q-card-actions align="right">
                  <q-btn disable flat label="Coming soon" />
                </q-card-actions>
              </q-card>
            </div>
            <div class="col-12 col-md-4">
              <q-card bordered class="fit">
                <q-card-section>
                  <div class="text-subtitle1 text-weight-medium">More Local Tools</div>
                  <div class="text-caption text-grey-7">CSV, images, and more (coming soon).</div>
                </q-card-section>
                <q-card-actions align="right">
                  <q-btn disable flat label="Coming soon" />
                </q-card-actions>
              </q-card>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
function scrollToFeatures() {
  const el = document.getElementById('features');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>
