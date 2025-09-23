<template>
  <q-page class="q-pa-xl">
    <div class="column items-center">
      <q-card flat bordered class="q-pa-xl" style="max-width: 960px; width: 100%">
        <q-card-section>
          <div class="text-h4 text-weight-bold q-mb-md">Privacy Notice</div>
          <div class="text-caption text-grey-6 q-mb-xl">Last updated: {{ lastUpdated }}</div>

          <div class="q-gutter-md">
            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">Definitions</h2>
              <p>
                "Local Doc Tools" (the "Service") refers to the website located at
                <a href="https://localdoctools.com" target="_blank" rel="noopener"
                  >https://localdoctools.com</a
                >
                and any document utilities made available through it by Brief Tech Pte Ltd.
              </p>
            </section>

            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">Overview</h2>
              <p>
                Local Doc Tools is operated by Brief Tech Pte Ltd ("Brief Tech"). It runs entirely
                in your browser. We do not collect, transmit, or store the contents of documents you
                process with the Service.
              </p>
            </section>

            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">Analytics</h2>
              <p>
                We use Cloudflare Web Analytics to understand how the site is used. Cloudflare Web
                Analytics does not use cookies and provides only aggregated metrics such as page
                views, device types, and referrers. No personal data is stored or shared.
              </p>
            </section>

            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">Third Parties</h2>
              <p>
                Cloudflare is the only third party that receives analytics information. Their
                service logs aggregate data without identifying individual visitors. We do not sell
                or rent any data.
              </p>
            </section>

            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">Your Choices</h2>
              <p>
                You can block analytics by using browser tracking protection or by filtering
                requests to Cloudflare’s analytics endpoint. Doing so will not affect your ability
                to use the Service.
              </p>
            </section>

            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">Contact</h2>
              <p>
                For privacy questions or requests, email Brief Tech Pte Ltd at
                <a href="mailto:admin@localdoctools.com">admin@localdoctools.com</a>.
              </p>
            </section>

            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">Updates</h2>
              <p>
                We may update this Privacy Notice from time to time. The updated version will be
                posted on this page. Your continued use of the Service after changes take effect
                signifies your acknowledgement of the updated notice.
              </p>
            </section>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
const lastUpdated = '4 October 2024'
</script>

<style scoped>
section p {
  margin: 0;
}
</style>
